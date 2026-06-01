// Minimal Pusher-protocol client used to subscribe to Laravel Reverb's
// public widget channel (API.md §5). Implemented in ~150 LOC so the widget
// bundle doesn't have to drag in `laravel-echo` + `pusher-js` (~30KB
// gzipped combined) just to receive one event type on one channel.
//
// Protocol reference: https://pusher.com/docs/channels/library_auth_reference/pusher-websockets-protocol/
//
// Flow:
//   1. Open `wss://{host}:{port}/app/{key}?protocol=7&client=...&version=...`
//   2. Server sends `pusher:connection_established` → we know we're up.
//   3. Send `pusher:subscribe` with channel name (public channel — no auth).
//   4. Server sends `pusher_internal:subscription_succeeded`.
//   5. Custom event payloads arrive as `{"event":"<name>","channel":"...","data":"<json-string>"}`.
//      Note: `data` is double-encoded JSON, just like the Pusher spec.
//
// Reconnection strategy:
//   Exponential backoff capped at 30s. We don't queue outbound messages
//   because the widget never publishes via WS — only subscribes.

const CLIENT_NAME = 'nuvemchat-widget';
const CLIENT_VERSION = '0.1';

const buildUrl = ({ host, port, scheme, key }) => {
  const wsScheme = scheme === 'https' ? 'wss' : 'ws';
  const portPart = port ? `:${port}` : '';
  const query = `protocol=7&client=${CLIENT_NAME}&version=${CLIENT_VERSION}&flash=false`;
  return `${wsScheme}://${host}${portPart}/app/${key}?${query}`;
};

// Pusher wraps custom-event payloads in a JSON-encoded string. Internal
// frames (connection_established, error, subscription_succeeded) use the
// same shape but with structured data — handle both gracefully.
const safeParseData = (raw) => {
  if (raw == null) return null;
  if (typeof raw !== 'string') return raw;
  try { return JSON.parse(raw); } catch (_e) { return raw; }
};

export const createRealtimeClient = ({ host, port, scheme, key, debug = false } = {}) => {
  if (!host || !key) {
    throw new Error('createRealtimeClient: host and key are required');
  }

  const url = buildUrl({ host, port, scheme, key });
  // channel name → Set of listener fns
  const listeners = new Map();
  // channels we want to be subscribed to (re-applied on reconnect)
  const desiredChannels = new Set();

  let socket = null;
  let reconnectAttempts = 0;
  let reconnectTimer = null;
  let intentionallyClosed = false;

  const log = (...args) => { if (debug) console.log('[widget-rt]', ...args); };

  const sendRaw = (payload) => {
    if (!socket || socket.readyState !== 1) return false;
    socket.send(JSON.stringify(payload));
    return true;
  };

  const subscribeOnWire = (channel) => {
    sendRaw({ event: 'pusher:subscribe', data: { channel } });
  };

  const fireListeners = (channel, event, data) => {
    const set = listeners.get(channel);
    if (!set) return;
    set.forEach((fn) => {
      try { fn(event, data); } catch (err) { log('listener error', err); }
    });
  };

  const handleMessage = (raw) => {
    let frame;
    try { frame = JSON.parse(raw); } catch (_e) { return; }
    const { event, channel, data } = frame;
    const parsed = safeParseData(data);

    if (event === 'pusher:connection_established') {
      reconnectAttempts = 0;
      log('connected', parsed);
      // Re-subscribe to all desired channels on reconnect.
      desiredChannels.forEach(subscribeOnWire);
      return;
    }
    if (event === 'pusher:error') {
      log('pusher error', parsed);
      return;
    }
    if (event === 'pusher:ping') {
      sendRaw({ event: 'pusher:pong', data: {} });
      return;
    }
    if (event && event.startsWith('pusher_internal:')) {
      log('internal', event, channel);
      return;
    }
    if (channel) fireListeners(channel, event, parsed);
  };

  const scheduleReconnect = () => {
    if (intentionallyClosed) return;
    if (reconnectTimer) return;
    reconnectAttempts += 1;
    // 1s, 2s, 4s, ... capped at 30s — jitter keeps clients from stampeding.
    const base = Math.min(30000, 1000 * 2 ** (reconnectAttempts - 1));
    const delay = base + Math.floor(Math.random() * 500);
    log(`reconnect in ${delay}ms`);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      open();
    }, delay);
  };

  const open = () => {
    if (typeof WebSocket === 'undefined') {
      log('WebSocket not available — realtime disabled');
      return;
    }
    try {
      socket = new WebSocket(url);
    } catch (err) {
      log('ws construct failed', err);
      scheduleReconnect();
      return;
    }
    socket.onmessage = (event) => handleMessage(event.data);
    socket.onerror = (err) => log('ws error', err);
    socket.onclose = () => {
      log('ws closed');
      socket = null;
      scheduleReconnect();
    };
  };

  open();

  return {
    subscribe(channel, listener) {
      if (!listeners.has(channel)) listeners.set(channel, new Set());
      listeners.get(channel).add(listener);
      const wasDesired = desiredChannels.has(channel);
      desiredChannels.add(channel);
      // Send subscribe immediately if the socket is open AND this is the
      // first listener for the channel. On a fresh connect the
      // connection_established handler will replay desiredChannels.
      if (!wasDesired && socket && socket.readyState === 1) {
        subscribeOnWire(channel);
      }
      return () => {
        const set = listeners.get(channel);
        if (!set) return;
        set.delete(listener);
        if (set.size === 0) {
          listeners.delete(channel);
          desiredChannels.delete(channel);
          sendRaw({ event: 'pusher:unsubscribe', data: { channel } });
        }
      };
    },

    close() {
      intentionallyClosed = true;
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
      listeners.clear();
      desiredChannels.clear();
      if (socket) {
        try { socket.close(); } catch (_e) { /* ignore */ }
        socket = null;
      }
    },
  };
};

export default createRealtimeClient;
