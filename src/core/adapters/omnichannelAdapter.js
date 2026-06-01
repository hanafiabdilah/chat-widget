// Backend adapter for the Nuvemchat Live Chat Widget API (see API.md).
//
// Responsibilities, in order of `start()`:
//   1. GET /widget-api/config/{appId}      → template, brand color, realtime creds
//   2. Bootstrap session:
//        - If localStorage has a session_token  → GET history
//        - Else                                  → POST session, store token
//   3. Open Reverb WebSocket subscription on `widget-session.{token}`
//      and forward `widget-message-received` events as MessageResource.
//
// Outbound:
//   - send(text)              → POST /widget-api/session/{token}/messages
//   - selectQuickReply(reply) → same endpoint; we forward the visible label.
//
// Reset / 404 handling:
//   - If the backend returns 404 on history/send, the saved session_token is
//     stale (deleted server-side). We clear localStorage and bootstrap a new
//     session transparently.

import { createRestClient, ApiError } from '../api/restClient.js';
import { createRealtimeClient } from '../api/realtimeClient.js';
import { createWidgetStorage } from '../api/storage.js';
import { mapMessage, agentFromResource } from '../api/messageMapper.js';

const WIDGET_EVENT = 'widget-message-received';
// Stable client-side id for the synthetic greeting we materialise from
// `connection.accept_message`. Strings can't collide with server-side
// numeric MessageResource ids, so the upsert dedupe in useConversation
// treats it as a distinct row.
const ACCEPT_MESSAGE_ID = 'accept-message';

const channelName = (token) => `widget-session.${token}`;

const padTwo = (n) => String(n).padStart(2, '0');
const nowHHMM = () => {
  const d = new Date();
  return `${padTwo(d.getHours())}:${padTwo(d.getMinutes())}`;
};

// MessageResource has no notion of "id is temporary" — we use a numeric-id
// presence check to upsert. Server ids are always numbers; our optimistic
// placeholders use a `temp-` string prefix so they never collide.
const isServerId = (id) => typeof id === 'number';

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
  const emitMessage = (resource) => {
    if (!resource) return;
    const mapped = mapMessage(resource, { locale });
    handlers.onMessage?.(mapped);
    // Update header agent when an outgoing message arrives (so it tracks
    // whichever agent / bot replied last).
    const agent = agentFromResource(resource);
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

  const openRealtime = (rtConfig, sessionToken) => {
    if (!rtConfig || !rtConfig.key || !rtConfig.host) {
      log('skip realtime — config missing');
      return;
    }
    realtime = createRealtimeClient({
      host: rtConfig.host,
      port: rtConfig.port,
      scheme: rtConfig.scheme,
      key: rtConfig.key,
      debug,
    });
    unsubscribeChannel = realtime.subscribe(channelName(sessionToken), (event, data) => {
      if (event !== WIDGET_EVENT) return;
      // Per API.md, the broadcast payload IS a MessageResource.
      emitMessage(data);
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
      time: nowHHMM(),
      agent: { type: 'bot', name: config.connection.name || 'Suporte' },
    });
  };

  // Returns { token, historyCount }. `historyCount = 0` covers both
  // brand-new sessions (just created via POST) and existing sessions that
  // happen to have no messages yet — both are valid triggers for the
  // accept_message greeting.
  const bootstrapSession = async () => {
    const existing = storage.getSessionToken();
    if (existing) {
      const { ok, count } = await loadHistory(existing);
      if (ok) return { token: existing, historyCount: count };
      // history said the token was bad — fall through and create a new one.
    }

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
    return { token: result.session_token, historyCount: 0 };
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

    let session;
    try {
      session = await bootstrapSession();
      log('session ready', { token: session.token, historyCount: session.historyCount });
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

    openRealtime(config.realtime, session.token);

    // Stash for outbound calls. Captured via closure to avoid stale refs.
    state.sessionToken = session.token;
    handlers.onStatus?.('ready');
    log('ready');
  };

  // Mutable shared state — exposed only inside this factory so `send` can
  // see the token resolved by the async `boot` flow.
  const state = { sessionToken: null };

  const postMessage = async (text) => {
    if (!state.sessionToken) {
      log('send called before session ready — dropping');
      return;
    }
    try {
      log('POST message', `${baseUrl}/widget-api/session/${state.sessionToken}/messages`, { message: text });
      const result = await api.sendMessage(state.sessionToken, text);
      log('message sent', result?.message?.id);
      // The server-echoed message is authoritative — render from this rather
      // than what the user typed. (Realtime channel will also broadcast it,
      // but the id dedupe in templates' upsert logic handles that.)
      if (result?.message) emitMessage(result.message);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        // Session vanished mid-conversation. Reset and re-bootstrap quietly.
        log('send 404 → re-bootstrapping');
        storage.clearSessionToken();
        state.sessionToken = null;
        try { await bootstrapSession().then(({ token }) => { state.sessionToken = token; }); } catch (_e) { /* swallow */ }
        return;
      }
      if (err instanceof ApiError && err.status === 403) {
        // Connection was disabled while the visitor was chatting. Tear down
        // the UI to match the static-load behaviour.
        log('send 403 → connection inactive');
        handlers.onStatus?.('inactive', err);
      }
      log('send failed', err);
      handlers.onError?.(err);
    }
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

    send(text) {
      const trimmed = (text || '').trim();
      if (!trimmed) return;
      postMessage(trimmed);
    },

    selectQuickReply(reply) {
      if (!reply?.label) return;
      // The widget API doesn't have a structured payload endpoint yet, so
      // we forward the visible label as a plain visitor message. The
      // backend's flow rules / agents handle interpretation.
      postMessage(reply.label);
    },
  };
};

export default createOmnichannelAdapter;
