// Per-appId localStorage helpers. Keys are namespaced so multiple widgets
// (different connections) can coexist on the same domain without colliding.
// All accessors are SSR-safe — they no-op if `window.localStorage` is not
// reachable so the widget can be imported in Next.js / Remix server bundles.

const hasStorage = () => {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch (_e) {
    return false;
  }
};

const key = (kind, appId) => `nuvemchat:${kind}:${appId}`;

const safeGet = (k) => {
  if (!hasStorage()) return null;
  try { return window.localStorage.getItem(k); } catch (_e) { return null; }
};

const safeSet = (k, value) => {
  if (!hasStorage()) return;
  try { window.localStorage.setItem(k, value); } catch (_e) { /* ignore quota / private mode */ }
};

const safeRemove = (k) => {
  if (!hasStorage()) return;
  try { window.localStorage.removeItem(k); } catch (_e) { /* ignore */ }
};

// crypto.randomUUID is available in evergreen browsers and Node 19+. Fallback
// keeps tests / very old browsers from crashing.
const newUuid = () => {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch (_e) { /* fall through */ }
  return `vid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

export const createWidgetStorage = (appId) => ({
  getSessionToken: () => safeGet(key('session', appId)),
  setSessionToken: (token) => safeSet(key('session', appId), token),
  clearSessionToken: () => safeRemove(key('session', appId)),

  // visitor_id is created once per browser per appId so the backend can
  // de-duplicate Contacts when the visitor resets their session.
  getOrCreateVisitorId: () => {
    const k = key('visitorId', appId);
    let existing = safeGet(k);
    if (!existing) {
      existing = newUuid();
      safeSet(k, existing);
    }
    return existing;
  },

  getLastSeenMessageId: () => {
    const raw = safeGet(key('lastSeenMessageId', appId));
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  },
  setLastSeenMessageId: (id) => safeSet(key('lastSeenMessageId', appId), String(id)),
});

export default createWidgetStorage;
