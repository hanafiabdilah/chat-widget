// Backend adapter for the Nuvemchat Live Chat Widget API (see API.md).
//
// Responsibilities, in order of `start()`:
//   1. GET /widget-api/config/{appId}      → template, brand color, realtime creds
//   2. Bootstrap session:
//        - If localStorage has a session_token  → GET history
//        - Else                                  → POST session, store token
//   3. GET /widget-api/session/{token}      → conversation status, agent, unread
//   4. Open Reverb WebSocket subscription on `widget-session.{token}`
//      and forward `widget-message-received` events as MessageResource.
//
// Outbound:
//   - send(text)              → POST /widget-api/session/{token}/messages
//                               (no-op if conversation is `resolved`)
//   - markSeen()              → POST /widget-api/session/{token}/seen
//   - reset()                 → clear local token + bootstrap fresh session
//
// Reset / 404 handling:
//   - 404 on history/send → clear localStorage and bootstrap a new session.
//   - reset() is the manual equivalent for "Start new conversation" buttons.

import { createRestClient, ApiError } from '../api/restClient.js';
import { createRealtimeClient } from '../api/realtimeClient.js';
import { createWidgetStorage } from '../api/storage.js';
import { mapMessage, agentFromResource, formatTime } from '../api/messageMapper.js';

const WIDGET_EVENT = 'widget-message-received';
// Status change broadcast (API.md §5.2b). Fires on accept / resolve /
// other lifecycle transitions. Payload shape:
//   { conversation_id, old_status, new_status, agent, changed_at }
const STATUS_EVENT = 'widget-conversation-status-changed';
// An agent is (or has stopped) writing a reply. Payload:
//   { conversation_id, typing, agent }
// Ephemeral by design: nothing is stored, and the hook expires it on its own
// if the `typing: false` never arrives.
const TYPING_EVENT = 'widget-typing';
// An agent opened the thread and read what the visitor wrote. Payload:
//   { conversation_id, message_ids, read_at }
// The ids are the visitor's own messages, which is why this only ever turns a
// tick that is already drawn — nothing here creates or changes a message.
const READ_EVENT = 'widget-messages-read';
// Stable client-side id for the synthetic greeting we materialise from
// `connection.accept_message`. Strings can't collide with server-side
// numeric MessageResource ids, so the upsert dedupe in useConversation
// treats it as a distinct row.
// Exported because it is the one bubble in the thread that nobody sent: the
// widget writes it locally from the dashboard's accept message. Anything
// asking "has this visitor got a conversation?" has to be able to discount it.
export const ACCEPT_MESSAGE_ID = 'accept-message';

// Client-side ids for messages drawn before the server has seen them. Strings
// can't collide with MessageResource's numeric ids — the same property that
// makes ACCEPT_MESSAGE_ID safe — so the hook's upsert treats them as their own
// rows until the real message arrives to replace them.
let pendingSeq = 0;
const nextPendingId = () => `pending:${++pendingSeq}`;

const channelName = (token) => `widget-session.${token}`;

// Locally-built messages get their timestamp through the same formatter the
// mapper uses, so they read identically to the server's.
const nowFormatted = (locale) => formatTime(Math.floor(Date.now() / 1000), locale);
const nowUnix = () => Math.floor(Date.now() / 1000);

// Build an Agent object from the API.md §4.3 `conversation.agent` shape.
// Mirrors `messageMapper.agentFromResource` so the header avatar / name
// stays consistent whether the agent info came from a message sender or
// the session status check.
const agentFromSession = (rawAgent) => {
  if (!rawAgent || !rawAgent.name) return null;
  const name = String(rawAgent.name).trim();
  const parts = name.split(/\s+/);
  const initials = (parts[0]?.[0] || '') + (parts[1]?.[0] || '');
  return {
    type: 'human',
    name,
    role: 'Suporte',
    initials: initials.toUpperCase() || name.slice(0, 2).toUpperCase(),
  };
};

export const createOmnichannelAdapter = ({
  appId,
  baseUrl,
  identify,            // { name, email, meta } — optional static pre-chat data
  getIdentify,         // () => { name, email, meta } — read lazily at POST
                       // /session time. Preferred when the host's user object
                       // identity isn't stable (e.g. inline JSX literals); the
                       // adapter avoids being recreated on every parent
                       // re-render.
  pageUrl,             // override; defaults to window.location.href
  fetchImpl,
  locale,              // forwarded to message mapper for time formatting
  virtualAssistantName, // host override for the bot (AI/flow) display name
  // Don't create the conversation until the visitor actually writes.
  //
  // `POST /session` is what brings a Contact + Conversation row into being,
  // and boot calls it on the first page view — so with the widget embedded on
  // a public site every visitor who never says a word still lands in the
  // database (one production workspace collected 4.591 of them). With this on,
  // boot only *restores* a session the browser already has; a brand new
  // visitor gets one the moment they send their first message, which is also
  // the first moment anyone on the other side could see them.
  //
  // Off by default: hosts that already ship the npm package keep the exact
  // boot they have. The embed turns it on.
  deferSession = false,
  debug = false,
} = {}) => {
  if (!appId) throw new Error('createOmnichannelAdapter: appId is required');
  if (!baseUrl) throw new Error('createOmnichannelAdapter: baseUrl is required');

  const api = createRestClient({ baseUrl, fetchImpl });
  const storage = createWidgetStorage(appId);

  let handlers = {};
  let realtime = null;
  let unsubscribeChannel = null;
  let started = false;        // guards double-start (StrictMode mounts twice)
  let stopped = false;        // set in cleanup so async tasks bail

  const log = (...args) => { if (debug) console.log('[widget-adapter]', ...args); };

  // Treat any successful message arrival as the canonical event — both REST
  // responses and WS pushes go through here so the dedupe / upsert logic
  // lives in one place.
  // `replacesId` names an optimistic bubble this message supersedes, so the
  // hook can swap it in place instead of appending a second one.
  const emitMessage = (resource, { replacesId } = {}) => {
    if (!resource) return;
    const mapped = mapMessage(resource, { locale, virtualAssistantName });
    handlers.onMessage?.(replacesId ? { ...mapped, replacesId } : mapped);
    // Update header agent when an outgoing message arrives (so it tracks
    // whichever agent / bot replied last).
    const agent = agentFromResource(resource, { virtualAssistantName });
    if (agent) handlers.onAgent?.(agent);
  };

  const emitConfig = (config) => {
    if (!config) return;
    const conn = config.connection || {};
    handlers.onConfig?.({
      template: config.template_type === 'global' ? 'global' : 'proxybr',
      brand: {
        title: conn.name || 'Suporte',
        accentColor: conn.color || null,
        acceptMessage: conn.accept_message || null,
        connectionId: conn.id || null,
      },
      raw: config,
    });
  };

  // Pushes the API.md §4.3 session response shape to the host. Hooks
  // consume this to render the agent badge ("Agent Sari is helping you"),
  // the unread count on the FAB, and the resolved-state CTA.
  const emitSession = (sessionRes) => {
    if (!sessionRes) return;
    const conv = sessionRes.conversation || {};
    state.conversationStatus = conv.status || null;
    handlers.onSession?.({
      conversationId: conv.id || null,
      status: conv.status || null,
      unreadCount: typeof sessionRes.unread_count === 'number' ? sessionRes.unread_count : 0,
      lastSeenAt: sessionRes.session?.last_seen_at || null,
      agent: agentFromSession(conv.agent),
      raw: sessionRes,
    });
    const agent = agentFromSession(conv.agent);
    if (agent) handlers.onAgent?.(agent);
  };

  const openRealtime = (rtConfig, sessionToken) => {
    if (!rtConfig || !rtConfig.key || !rtConfig.host) {
      log('skip realtime — config missing', rtConfig);
      return;
    }
    const wsScheme = rtConfig.scheme === 'https' ? 'wss' : 'ws';
    const portStr = rtConfig.port ? `:${rtConfig.port}` : '';
    log('openRealtime',
      `${wsScheme}://${rtConfig.host}${portStr}/app/${rtConfig.key}`,
      `channel: widget-session.${sessionToken}`);
    realtime = createRealtimeClient({
      host: rtConfig.host,
      port: rtConfig.port,
      scheme: rtConfig.scheme,
      key: rtConfig.key,
      debug,
    });
    unsubscribeChannel = realtime.subscribe(channelName(sessionToken), (event, data) => {
      // Laravel's Pusher broadcaster MAY prefix the event with a dot when
      // `broadcastAs()` is used (per Echo's `.event-name` convention). We
      // accept both forms to stay robust regardless of the server's quirk.
      const normalized = typeof event === 'string' && event.startsWith('.') ? event.slice(1) : event;

      if (normalized === WIDGET_EVENT) {
        log('received', WIDGET_EVENT, data?.id);
        // Per API.md, the broadcast payload IS a MessageResource.
        emitMessage(data);
        // Agent reply increments unread (visitor hasn't seen this yet unless
        // they explicitly mark seen). We don't refetch /session — we just
        // bump locally for the FAB badge. The next markSeen() resets it.
        if (data?.sender_type === 'outgoing') {
          handlers.onUnreadIncrement?.();
        }
        return;
      }

      if (normalized === TYPING_EVENT) {
        log('agent typing', data?.typing);
        handlers.onTyping?.(!!data?.typing);
        // The agent's name may arrive here before their first message does,
        // which is the case where the indicator would otherwise be drawn
        // against the generic bot avatar. Built through the same helper as
        // every other path so the initials and role match what the header
        // already shows.
        if (data?.typing && data?.agent) {
          const agent = agentFromSession({ name: data.agent });
          if (agent) handlers.onAgent?.(agent);
        }
        return;
      }

      if (normalized === READ_EVENT) {
        // The visitor's own bubbles already carry a tick drawn from `read_at`,
        // but that value only ever arrived with a fetch — so a visitor sitting
        // with the panel open watched a single tick until they reloaded. This
        // is the same fact pushed while they are still looking.
        const ids = Array.isArray(data?.message_ids) ? data.message_ids : [];
        log('agent read', ids.length, 'message(s)');
        ids.forEach((id) => handlers.onMessageSeen?.(id));
        return;
      }

      if (normalized === STATUS_EVENT) {
        // Per API.md §5.2b payload:
        //   { conversation_id, old_status, new_status, agent, changed_at }
        log('status changed', data?.old_status, '→', data?.new_status, 'agent:', data?.agent?.name);
        const newStatus = data?.new_status;
        if (newStatus) {
          state.conversationStatus = newStatus;
          handlers.onSession?.({
            conversationId: data.conversation_id || null,
            status: newStatus,
            agent: agentFromSession(data.agent),
            raw: data,
          });
          // When an agent accepts the conversation, the payload carries
          // the assigned agent — bubble it up so the header avatar /
          // name updates instantly (instead of waiting for their first
          // message to flow through emitMessage).
          const agent = agentFromSession(data.agent);
          if (agent) handlers.onAgent?.(agent);
        }
        return;
      }

      log('ignoring event', event);
    });
  };

  // Returns { ok, count }. `ok=false` means the session token was bad and
  // the caller should bootstrap a fresh one. `count` is the number of
  // messages successfully fetched — used to decide whether to inject the
  // `accept_message` greeting (only on truly empty conversations).
  const loadHistory = async (sessionToken) => {
    try {
      log('GET history', `${baseUrl}/widget-api/session/${sessionToken}/messages`);
      const result = await api.getHistory(sessionToken);
      if (stopped) return { ok: true, count: 0 };
      const messages = result?.messages || [];
      log('history loaded', { count: messages.length });
      // API guarantees ASC (oldest first) — forward as-is.
      messages.forEach(emitMessage);
      return { ok: true, count: messages.length };
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        // Session expired / deleted server-side. Clear and tell the caller
        // to bootstrap fresh.
        log('history 404 → resetting session');
        storage.clearSessionToken();
        return { ok: false, count: 0 };
      }
      log('history failed', err);
      // Network / 5xx — fail soft: visitor can still send new messages.
      return { ok: true, count: 0 };
    }
  };

  // Fetch session status (API.md §4.3). 404 means the token is dead and
  // we should bootstrap fresh (same recovery path as history). Other errors
  // fail soft — the visitor can still chat, we just won't show the agent
  // badge / unread count until next reconnect.
  const loadSessionStatus = async (sessionToken) => {
    try {
      log('GET session', `${baseUrl}/widget-api/session/${sessionToken}`);
      const result = await api.getSession(sessionToken);
      if (stopped) return { ok: true };
      log('session status', result?.conversation?.status, 'unread:', result?.unread_count);
      emitSession(result);
      return { ok: true };
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        log('session 404 → resetting');
        storage.clearSessionToken();
        return { ok: false };
      }
      log('session status failed', err);
      return { ok: true };
    }
  };

  // Public-facing wrapper used by:
  //   - WS `conversation-status-changed` event when no embedded status
  //   - Host calling `conversation.refreshStatus()` (e.g. on panel open)
  // Bails if we don't have a session token yet (boot still pending).
  const refreshSessionStatus = async () => {
    if (!state.sessionToken) return;
    await loadSessionStatus(state.sessionToken);
  };

  // Inject the dashboard-configured greeting as the conversation's first
  // bot bubble. Only emitted when there's no real history yet, so it never
  // shadows an actual agent message on returning visits.
  const emitAcceptMessage = (config) => {
    const text = config?.connection?.accept_message;
    if (!text) return;
    handlers.onMessage?.({
      id: ACCEPT_MESSAGE_ID,
      from: 'bot',
      text,
      time: nowFormatted(locale),
      sentAt: nowUnix(),
      agent: { type: 'bot', name: config.connection.name || 'Suporte' },
    });
  };

  // Returns { token, historyCount, fresh }. `fresh=true` means we just
  // created the session (no existing token), so `getSession` after this
  // is just for unread/agent — there's no resolved-state to worry about.
  const bootstrapSession = async ({ createIfMissing = true } = {}) => {
    const existing = storage.getSessionToken();
    if (existing) {
      const { ok, count } = await loadHistory(existing);
      if (ok) return { token: existing, historyCount: count, fresh: false };
      // history said the token was bad — fall through and create a new one.
    }

    // Deferred boot: nothing stored yet, and the visitor hasn't asked for a
    // conversation. Return empty-handed; `ensureSession()` creates it later.
    if (!createIfMissing) return { token: null, historyCount: 0, fresh: false };

    const identifyData = typeof getIdentify === 'function' ? getIdentify() : identify;
    const payload = {
      visitor_id: storage.getOrCreateVisitorId(),
      page_url: pageUrl || (typeof window !== 'undefined' ? window.location.href : null),
      ...(identifyData || {}),
    };
    log('POST session', `${baseUrl}/widget-api/session/${appId}`, payload);
    const result = await api.createSession(appId, payload);
    if (!result?.session_token) throw new Error('createSession returned no token');
    storage.setSessionToken(result.session_token);
    return { token: result.session_token, historyCount: 0, fresh: true };
  };

  // Map an ApiError from a boot-time call to a lifecycle status. 422 / 403
  // are fatal per API.md §9 — UI must hide / block. Everything else is a
  // transient "error" the host can render as a soft retry-able state.
  const statusForBootError = (err) => {
    if (err instanceof ApiError) {
      if (err.status === 422) return 'unavailable';
      if (err.status === 403) return 'inactive';
    }
    return 'error';
  };

  const boot = async () => {
    log('boot start', { appId, baseUrl });
    handlers.onStatus?.('loading');

    let config;
    try {
      log('GET config', `${baseUrl}/widget-api/config/${appId}`);
      config = await api.getConfig(appId);
      log('config loaded', config);
    } catch (err) {
      log('config failed', err.status, err.body || err.message);
      handlers.onStatus?.(statusForBootError(err), err);
      handlers.onError?.(err);
      return;
    }
    if (stopped) return;
    emitConfig(config);

    // Kept for `ensureSession()`, which may only run minutes later — when the
    // visitor finally writes — long after `config` has gone out of scope.
    state.realtimeConfig = config.realtime;

    let session;
    try {
      session = await bootstrapSession({ createIfMissing: !deferSession });
      log('session ready', { token: session.token, historyCount: session.historyCount, fresh: session.fresh });
    } catch (err) {
      log('session failed', err.status, err.body || err.message);
      handlers.onStatus?.(statusForBootError(err), err);
      handlers.onError?.(err);
      return;
    }
    if (stopped) return;

    // Synthetic greeting AFTER history is loaded so it lands below any real
    // agent messages chronologically — and only when the conversation is
    // genuinely empty (no historical messages from the visitor's prior visits).
    if (session.historyCount === 0) emitAcceptMessage(config);

    // Stash for outbound calls. Captured via closure to avoid stale refs.
    // Null while deferred — the visitor has no conversation yet.
    state.sessionToken = session.token;

    // Fetch session status (unread, agent, conversation.status). Skipping
    // this on a freshly created session is a small optimisation — a new
    // session is always { status: 'pending', unread: 0, agent: null } so
    // we save one round trip during the typical first-visit flow.
    if (session.token && !session.fresh) {
      const statusResult = await loadSessionStatus(session.token);
      if (stopped) return;
      if (!statusResult.ok) {
        // Token rejected by /session — rebuild from scratch. Under deferral
        // that rebuild waits for the visitor, same as a first visit would.
        const fresh = await bootstrapSession({ createIfMissing: !deferSession });
        if (stopped) return;
        if (fresh.historyCount === 0) emitAcceptMessage(config);
        state.sessionToken = fresh.token;
        session = fresh;
      }
    }

    // No token yet (deferred, first visit): there is no channel to listen on.
    // `ensureSession()` opens it the moment the session is created.
    if (state.sessionToken) openRealtime(config.realtime, state.sessionToken);
    handlers.onStatus?.('ready');
    log('ready', state.sessionToken ? '' : '(session deferred)');
  };

  /**
   * Resolve a session token, creating the session if this is the visitor's
   * first word. Concurrent callers share one in-flight POST — two quick sends
   * must not open two conversations.
   */
  const ensureSession = async () => {
    if (state.sessionToken) return state.sessionToken;
    if (!state.sessionPromise) {
      state.sessionPromise = (async () => {
        const created = await bootstrapSession({ createIfMissing: true });
        if (stopped || !created.token) return null;
        state.sessionToken = created.token;
        openRealtime(state.realtimeConfig, created.token);
        log('session created on demand', created.token);
        return created.token;
      })();
      // Clearing it either way is what makes a failed creation retryable:
      // the next send tries again instead of awaiting a rejected promise.
      state.sessionPromise.catch(() => {}).then(() => { state.sessionPromise = null; });
    }
    return state.sessionPromise;
  };

  // Mutable shared state — exposed only inside this factory so `send` can
  // see the token resolved by the async `boot` flow.
  const state = {
    sessionToken: null,
    conversationStatus: null,
    // Set at boot, read by `ensureSession()` when the session is created late.
    realtimeConfig: null,
    sessionPromise: null,
  };

  // Visitor messages that are on screen but not yet acknowledged, keyed by
  // their client-side id. The composer is cleared the moment the bubble is
  // drawn, so this is the only remaining copy of what they wrote — it is what
  // makes a failed send retryable instead of lost.
  const outbox = new Map();

  // A visitor bubble built from what we know locally, before the server has
  // seen it. Deliberately the same shape mapMessage() produces, so templates
  // render it through the existing path and only `deliveryStatus` tells the
  // two apart.
  const optimisticMessage = (id, { text, attachment, time, sentAt }, deliveryStatus) => ({
    id,
    from: 'client',
    text: text || '',
    // Stamped once when the draft was made, not on each redraw: a send that
    // takes half a minute to fail would otherwise have its bubble jump to a
    // later time at the moment it is marked failed.
    time,
    sentAt,
    seen: false,
    editedAt: null,
    unsendAt: null,
    // The upload already happened, so an attached image can be drawn from its
    // real URL — the visitor sees the picture, not a placeholder.
    messageType: attachment?.message_type || 'text',
    attachmentUrl: attachment?.url || null,
    attachmentMeta: attachment
      ? { filename: attachment.filename, mime_type: attachment.mime_type, size: attachment.size }
      : null,
    agent: null,
    deliveryStatus,
  });

  /**
   * Send a visitor message, drawing it immediately.
   *
   * The bubble appears before the request leaves, then moves to `sent` (server
   * echo swaps in) or `failed` (retryable). Waiting for the round trip first
   * meant that on a slow connection the visitor watched an empty thread after
   * pressing send, and pressed it again.
   *
   * `resendOf` reuses an existing bubble's id instead of drawing a new one —
   * used by retryMessage() and by the one automatic retry after a dead
   * session is rebuilt. `recovered` stops that retry from recursing.
   */
  const postMessage = async ({ text, attachment, resendOf, recovered = false } = {}) => {
    // Without deferral a missing token means boot hasn't finished (or failed),
    // and there is nothing to wait for — drop it, as before. With deferral a
    // missing token is the normal first-message case: the bubble is drawn
    // first and the session is created below, inside the try.
    if (!state.sessionToken && !deferSession) {
      log('send called before session ready — dropping');
      return;
    }
    // Block sends once the conversation is resolved. The host's reset()
    // call is the only way out — this matches the "tunggu visitor klik
    // reset" decision from product.
    if (state.conversationStatus === 'resolved') {
      log('send blocked — conversation resolved');
      return;
    }
    // Backend requires at least one of message or attachment_url.
    const body = text ? text.trim() : '';
    if (!body && !attachment?.url) return;

    const id = resendOf || nextPendingId();
    const draft = { text: body, attachment: attachment || null, time: nowFormatted(locale), sentAt: nowUnix() };
    outbox.set(id, draft);
    handlers.onMessage?.(optimisticMessage(id, draft, 'pending'));

    try {
      // First message of a deferred session: this is where the conversation
      // is actually born. The bubble is already on screen, so the extra round
      // trip costs the visitor nothing visible.
      const token = state.sessionToken || await ensureSession();
      if (!token) throw new Error('could not start a session');
      log('POST message', `${baseUrl}/widget-api/session/${token}/messages`, { message: body, attachmentUrl: attachment?.url });
      const result = await api.sendMessage(token, {
        message: body || undefined,
        attachmentUrl: attachment?.url,
      });
      log('message sent', result?.message?.id);
      outbox.delete(id);
      // The server-echoed message is authoritative — render from this rather
      // than what the user typed. It carries `replacesId` so the optimistic
      // row is swapped in place; appending and then removing would flash a
      // duplicate and move the message to the bottom of the thread.
      if (result?.message) {
        emitMessage(result.message, { replacesId: id });
      } else {
        // Accepted with no echo. Nothing to reconcile against, but the bubble
        // must stop looking unsent.
        handlers.onMessage?.(optimisticMessage(id, draft, 'sent'));
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 404 && !recovered) {
        // Session vanished mid-conversation. Rebuild it and send once more —
        // the visitor never asked for a new session and should not have to
        // retype a message to find out they got one.
        log('send 404 → re-bootstrapping');
        storage.clearSessionToken();
        state.sessionToken = null;
        try {
          const { token } = await bootstrapSession();
          state.sessionToken = token;
        } catch (_e) { /* fall through to the failed marker below */ }
        if (state.sessionToken && !stopped) {
          return postMessage({ text: body, attachment, resendOf: id, recovered: true });
        }
      }
      if (err instanceof ApiError && err.status === 403) {
        // Connection was disabled while the visitor was chatting. Tear down
        // the UI to match the static-load behaviour.
        log('send 403 → connection inactive');
        handlers.onStatus?.('inactive', err);
      }
      log('send failed', err);
      // The draft stays in the outbox: the bubble now offers a retry, and this
      // is what that retry sends.
      handlers.onMessage?.(optimisticMessage(id, draft, 'failed'));
      handlers.onError?.(err);
    }
    return undefined;
  };

  // Re-send a bubble the visitor tapped "try again" on. Unknown ids are
  // ignored — the draft is dropped as soon as a send succeeds, so a double
  // tap on an already-recovered message does nothing.
  const retryMessage = (id) => {
    const draft = outbox.get(id);
    if (!draft) return;
    log('retrying', id);
    postMessage({ ...draft, resendOf: id });
  };

  // Multipart upload (API.md §4.5). Resolves to the upload payload
  // (`{ url, message_type, filename, mime_type, size, expires_at }`) which
  // the host then passes back to `send()` as `attachmentUrl`. Splitting
  // upload from send is what the API recommends: the UI can show an
  // optimistic preview the moment the upload completes, then attach a
  // caption before the visitor actually sends.
  const uploadAttachment = async (file) => {
    // Uploads are addressed to the session (the token is in the path), so a
    // deferred session has to exist before the file can go anywhere. Attaching
    // a file is the visitor speaking, same as typing.
    if (!state.sessionToken && deferSession) await ensureSession();
    if (!state.sessionToken) {
      throw new Error('upload called before session ready');
    }
    if (state.conversationStatus === 'resolved') {
      throw new Error('upload blocked — conversation resolved');
    }
    log('POST upload', `${baseUrl}/widget-api/session/${state.sessionToken}/uploads`, file?.name, file?.size);
    const result = await api.uploadAttachment(state.sessionToken, file);
    log('upload ok', result?.url);
    return result;
  };

  // Sends `POST /seen` so subsequent /session calls return unread_count: 0.
  // Safe to call repeatedly — backend is idempotent. We also locally clear
  // the unread badge so the UI updates immediately without waiting for the
  // server roundtrip.
  const markSeen = async () => {
    if (!state.sessionToken) return;
    handlers.onUnreadReset?.();
    try {
      log('POST seen', `${baseUrl}/widget-api/session/${state.sessionToken}/seen`);
      await api.markSeen(state.sessionToken);
    } catch (err) {
      log('seen failed', err);
      // Non-fatal — the local unread reset is already applied.
    }
  };

  // Clears the session token and re-bootstraps. Used as the "Start a new
  // conversation" CTA when status is resolved, or as an escape hatch the
  // host can wire to its own logout/clear flow.
  const reset = async () => {
    log('reset requested');
    storage.clearSessionToken();
    state.sessionToken = null;
    state.conversationStatus = null;
    // Drafts belong to the conversation being discarded; their bubbles are
    // about to be cleared, and retrying one into a fresh session would post a
    // message the visitor thinks they abandoned.
    outbox.clear();
    // Tear down the existing realtime subscription — the new session has
    // a different token and therefore a different channel.
    if (unsubscribeChannel) { try { unsubscribeChannel(); } catch (_e) {} unsubscribeChannel = null; }
    if (realtime) { try { realtime.close(); } catch (_e) {} realtime = null; }
    // Re-run boot; the host's useConversation hook listens for state
    // updates as they're emitted (config, messages, status), so the UI
    // refreshes without needing a remount.
    handlers.onReset?.();
    boot();
  };

  return {
    start(nextHandlers = {}) {
      if (started) return () => {};
      started = true;
      stopped = false;
      handlers = nextHandlers;
      boot();

      return () => {
        stopped = true;
        started = false;
        handlers = {};
        if (unsubscribeChannel) { try { unsubscribeChannel(); } catch (_e) {} unsubscribeChannel = null; }
        if (realtime) { try { realtime.close(); } catch (_e) {} realtime = null; }
      };
    },

    // `text` may be a string (text-only) or an options object
    // `{ text, attachmentUrl }` when sending an attachment with optional
    // caption. The two-arg variant exists for ergonomic callers that
    // already prepared an attachment via `uploadAttachment`.
    //
    // Pass the whole upload payload as `attachment` (what uploadAttachment
    // resolved to) rather than just `attachmentUrl` when you can: the extra
    // fields are what let the optimistic bubble draw the image and its
    // filename instead of an empty box. `attachmentUrl` alone still works.
    send(textOrOpts, opts) {
      const source = (typeof textOrOpts === 'string' || textOrOpts == null)
        ? { text: textOrOpts || '', ...(opts || {}) }
        : textOrOpts;
      const attachment = source.attachment
        || (source.attachmentUrl ? { url: source.attachmentUrl } : null);
      postMessage({ text: source.text || '', attachment });
    },

    retryMessage,

    selectQuickReply(reply) {
      if (!reply?.label) return;
      // The widget API doesn't have a structured payload endpoint yet, so
      // we forward the visible label as a plain visitor message. The
      // backend's flow rules / agents handle interpretation.
      postMessage({ text: reply.label });
    },

    uploadAttachment,
    markSeen,
    reset,
    refreshStatus: refreshSessionStatus,
  };
};

export default createOmnichannelAdapter;
