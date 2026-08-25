// The one rule for how a message enters the thread.
//
// Adapters emit the same message more than once by design — an optimistic
// bubble, then the server's echo, then possibly a WebSocket push of the same
// row — so every arrival goes through here rather than being appended. Kept as
// a pure function, apart from React, because the failure it prevents
// (duplicate bubbles, a message jumping to the bottom of the thread) is
// invisible until it happens in front of a customer.
//
// Precedence:
//   1. `unsendAt`   → server tombstone, drop the row.
//   2. `replacesId` → supersedes an optimistic bubble; swap in place.
//   3. known `id`   → merge over the existing row (edits, read receipts).
//   4. otherwise    → append.
//
/**
 * @param {Array<Object>} prev     Current thread, oldest first.
 * @param {Object}        msg      Incoming message.
 * @returns {Array<Object>}        Next thread. Same reference is never reused.
 */
export const mergeMessage = (prev, msg) => {
  if (!msg) return prev;

  if (msg.unsendAt) return prev.filter((m) => m.id !== msg.id);

  if (msg.replacesId != null) {
    const at = prev.findIndex((m) => m.id === msg.replacesId);
    if (at !== -1) {
      const next = prev.slice();
      next[at] = msg;
      // Position matters: the optimistic bubble may already have messages
      // below it that arrived while it was in flight. Appending and filtering
      // afterwards would reorder the conversation under the visitor's eyes.
      // The filter only guards the case where the server id also arrived by
      // another route.
      return next.filter((m, i) => i === at || m.id !== msg.id);
    }
    // The bubble is gone (session reset mid-flight). Fall through and treat
    // this as an ordinary arrival rather than dropping the message.
  }

  const index = prev.findIndex((m) => m.id === msg.id);
  if (index === -1) return [...prev, msg];

  const next = prev.slice();
  // Merge rather than replace: a partial update (a read receipt) must not
  // erase fields the fuller original carried.
  next[index] = { ...prev[index], ...msg };
  return next;
};

export default mergeMessage;
