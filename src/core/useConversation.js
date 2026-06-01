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
    });
    return typeof cleanup === 'function' ? cleanup : undefined;
  }, [adapter]);

  const sendMessage = useCallback((text) => {
    adapterRef.current?.send?.(text);
  }, []);

  const selectQuickReply = useCallback((reply) => {
    adapterRef.current?.selectQuickReply?.(reply);
  }, []);

  return {
    messages,
    isTyping,
    currentAgent,
    quickReplies,
    config,
    error,
    status,
    sendMessage,
    selectQuickReply,
  };
};

export default useConversation;
