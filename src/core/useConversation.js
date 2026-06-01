import { useCallback, useEffect, useRef, useState } from 'react';

// Bridges a ChatAdapter to React state. Templates consume the returned
// object and render whatever shape they like — they don't know whether the
// underlying transport is mock, WebSocket, polling, or omnichannel.
//
// Message handling supports upsert / edit / delete based on `id`:
//   - new id          → append
//   - existing id     → replace (handles edits via `editedAt`)
//   - `unsendAt` set  → remove (server tombstone)
// This makes it safe for adapters to emit the same message twice (e.g. the
// omnichannel adapter sees both the REST POST response and the WS broadcast).
export const useConversation = (adapter) => {
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [currentAgent, setCurrentAgent] = useState(null);
  const [quickReplies, setQuickReplies] = useState([]);
  const [config, setConfig] = useState(null);
  const [error, setError] = useState(null);
  // 'idle' = no adapter signal yet (mock adapter never emits status; treat
  // as ready for UI purposes). Real adapters move through loading → ready.
  const [status, setStatus] = useState('idle');
  // Session-level state from API.md §4.3. Updated by the adapter whenever
  // it re-fetches /widget-api/session/{token}.
  //   conversationStatus: 'pending' | 'active' | 'resolved' | null
  //   unreadCount: pesan outgoing yang lebih baru dari last_seen_at
  const [conversationStatus, setConversationStatus] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;

  useEffect(() => {
    if (!adapter) return undefined;

    // Reset state when the adapter identity changes — otherwise switching
    // adapters mid-session would replay messages onto an old conversation.
    setMessages([]);
    setIsTyping(false);
    setCurrentAgent(null);
    setQuickReplies([]);
    setConfig(null);
    setError(null);
    setStatus('idle');
    setConversationStatus(null);
    setUnreadCount(0);

    const cleanup = adapter.start({
      onMessage: (msg) => setMessages((prev) => {
        if (msg.unsendAt) return prev.filter((m) => m.id !== msg.id);
        const index = prev.findIndex((m) => m.id === msg.id);
        if (index === -1) return [...prev, msg];
        const next = prev.slice();
        next[index] = { ...prev[index], ...msg };
        return next;
      }),
      onMessageSeen: (id) => setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, seen: true } : m))),
      onTyping: setIsTyping,
      onAgent: setCurrentAgent,
      onQuickReplies: setQuickReplies,
      onConfig: setConfig,
      onError: setError,
      onStatus: (next) => setStatus(next),
      // API.md §4.3 session payload — refreshed at boot / reconnect.
      onSession: (sessionData) => {
        setConversationStatus(sessionData?.status || null);
        if (typeof sessionData?.unreadCount === 'number') {
          setUnreadCount(sessionData.unreadCount);
        }
      },
      // Optimistic FAB badge updates: WS push (agent reply) bumps it;
      // widget open / markSeen clears it. Avoids waiting for the next
      // /session round trip just to see the badge change.
      onUnreadIncrement: () => setUnreadCount((n) => n + 1),
      onUnreadReset: () => setUnreadCount(0),
      // Adapter-driven reset (`adapter.reset()`) clears all state so the
      // hook re-runs through `idle → loading → ready` cleanly.
      onReset: () => {
        setMessages([]);
        setConversationStatus(null);
        setUnreadCount(0);
        setCurrentAgent(null);
      },
    });
    return typeof cleanup === 'function' ? cleanup : undefined;
  }, [adapter]);

  const sendMessage = useCallback((text) => {
    adapterRef.current?.send?.(text);
  }, []);

  const selectQuickReply = useCallback((reply) => {
    adapterRef.current?.selectQuickReply?.(reply);
  }, []);

  // POST /seen + clear local unread badge. Templates call this when the
  // panel opens (or when the visitor scrolls to the bottom of new messages).
  const markSeen = useCallback(() => {
    adapterRef.current?.markSeen?.();
  }, []);

  // "Start new conversation" — clears the session token, POSTs a fresh
  // session, and rebuilds realtime + history. Used when the conversation
  // is resolved.
  const reset = useCallback(() => {
    adapterRef.current?.reset?.();
  }, []);

  // Forces a /session refetch. Hosts call this on panel open so a
  // conversation that was resolved while the widget was closed gets
  // detected without a full reload.
  const refreshStatus = useCallback(() => {
    adapterRef.current?.refreshStatus?.();
  }, []);

  return {
    messages,
    isTyping,
    currentAgent,
    quickReplies,
    config,
    error,
    status,
    conversationStatus,
    unreadCount,
    sendMessage,
    selectQuickReply,
    markSeen,
    reset,
    refreshStatus,
  };
};

export default useConversation;
