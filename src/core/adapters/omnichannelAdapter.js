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

const channelName = (token) => `widget-session.${token}`;

// MessageResource has no notion of "id is temporary" — we use a numeric-id
// presence check to upsert. Server ids are always numbers; our optimistic
// placeholders use a `temp-` string prefix so they never collide.
const isServerId = (id) => typeof id === 'number';

export const createOmnichannelAdapter = ({
  appId,
  baseUrl,
  identify,            // { name, email, meta } — optional pre-chat data
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

  const loadHistory = async (sessionToken) => {
    try {
      const result = await api.getHistory(sessionToken);
      if (stopped) return true;
      const messages = result?.messages || [];
      // API guarantees ASC (oldest first) — forward as-is.
      messages.forEach(emitMessage);
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        // Session expired / deleted server-side. Clear and tell the caller
        // to bootstrap fresh.
        log('history 404 → resetting session');
        storage.clearSessionToken();
        return false;
      }
      log('history failed', err);
      // Network / 5xx — fail soft: visitor can still send new messages.
      return true;
    }
  };

  const bootstrapSession = async () => {
    const existing = storage.getSessionToken();
    if (existing) {
      const ok = await loadHistory(existing);
      if (ok) return existing;
      // history said the token was bad — fall through and create a new one.
    }

    const payload = {
      visitor_id: storage.getOrCreateVisitorId(),
      page_url: pageUrl || (typeof window !== 'undefined' ? window.location.href : null),
      ...(identify || {}),
    };
    const result = await api.createSession(appId, payload);
    if (!result?.session_token) throw new Error('createSession returned no token');
    storage.setSessionToken(result.session_token);
    return result.session_token;
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
    handlers.onStatus?.('loading');

    let config;
    try {
      config = await api.getConfig(appId);
    } catch (err) {
      log('config failed', err);
      handlers.onStatus?.(statusForBootError(err), err);
      handlers.onError?.(err);
      return;
    }
    if (stopped) return;
    emitConfig(config);

    let sessionToken;
    try {
      sessionToken = await bootstrapSession();
    } catch (err) {
      log('session failed', err);
      handlers.onStatus?.(statusForBootError(err), err);
      handlers.onError?.(err);
      return;
    }
    if (stopped) return;

    openRealtime(config.realtime, sessionToken);

    // Stash for outbound calls. Captured via closure to avoid stale refs.
    state.sessionToken = sessionToken;
    handlers.onStatus?.('ready');
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
      const result = await api.sendMessage(state.sessionToken, text);
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
        try { await bootstrapSession().then((t) => { state.sessionToken = t; }); } catch (_e) { /* swallow */ }
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
