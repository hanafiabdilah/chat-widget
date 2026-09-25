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

/*
 * How many past conversations this browser keeps a handle on.
 *
 * Each one is a session token, and a token is the only way back to a
 * conversation the visitor has already had: the widget API is addressed by
 * session, and there is no endpoint that lists a visitor's conversations. Drop
 * the token and the conversation becomes unreachable — which is what used to
 * happen on "start a new conversation".
 *
 * Bounded because the home screen reads each one with its own request. Five is
 * more than the list shows and far more than anyone scrolls back through.
 */
const MAX_REMEMBERED = 5;

const readList = (k) => {
  const raw = safeGet(k);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string' && item) : [];
  } catch (_e) {
    // Written by an older build, or corrupted. An empty history costs the
    // visitor a list; a throw here costs them the whole widget.
    return [];
  }
};

export const createWidgetStorage = (appId) => ({
  getSessionToken: () => safeGet(key('session', appId)),
  setSessionToken: (token) => safeSet(key('session', appId), token),
  clearSessionToken: () => safeRemove(key('session', appId)),

  /*
   * Every conversation this browser has had, newest first — including the
   * active one, which is not the same list as `session`: that key is a pointer
   * to the conversation being written in, and it is cleared when the visitor
   * starts a new one. This is the archive, and it is what the home screen
   * lists.
   */
  getSessionTokens: () => readList(key('sessions', appId)),

  rememberSessionToken: (token) => {
    if (!token) return;
    const existing = readList(key('sessions', appId)).filter((item) => item !== token);
    safeSet(key('sessions', appId), JSON.stringify([token, ...existing].slice(0, MAX_REMEMBERED)));
  },

  // Called when the server says a token is gone (404). Keeping it would mean
  // one wasted request per home screen, for ever.
  forgetSessionToken: (token) => {
    if (!token) return;
    const remaining = readList(key('sessions', appId)).filter((item) => item !== token);
    safeSet(key('sessions', appId), JSON.stringify(remaining));
  },

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
