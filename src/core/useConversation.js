import { useCallback, useEffect, useRef, useState } from 'react';
import { mergeMessage } from './mergeMessage.js';

// Bridges a ChatAdapter to React state. Templates consume the returned
// object and render whatever shape they like — they don't know whether the
// underlying transport is mock, WebSocket, polling, or omnichannel.
//
// How a message enters the thread (append / swap / merge / tombstone) lives in
// `mergeMessage` — it is the part adapters depend on being exactly right, so
// it is kept pure and out of here.
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

  // "Agent is typing" is asserted on a timer by the dashboard and withdrawn
  // when they stop — but the withdrawal is the message most likely to be lost
  // (tab closed, socket dropped, agent walked away mid-sentence), and an
  // indicator stuck on forever reads as a broken widget. So it expires here on
  // its own, and each new assertion pushes the deadline back.
  const typingTimerRef = useRef(null);
  const TYPING_TTL_MS = 12000;

  const clearTypingTimer = () => {
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
  };

  useEffect(() => clearTypingTimer, []);

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
      onMessage: (msg) => {
        // The reply landing IS the end of typing. Said here as well as over the
        // wire because the two race, and an indicator still spinning underneath
        // the message it announced looks broken.
        if (msg.from !== 'client') {
          clearTypingTimer();
          setIsTyping(false);
        }

        setMessages((prev) => mergeMessage(prev, msg));
      },
      onMessageSeen: (id) => setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, seen: true } : m))),
      onTyping: (typing) => {
        clearTypingTimer();
        setIsTyping(!!typing);
        if (typing) {
          typingTimerRef.current = setTimeout(() => setIsTyping(false), TYPING_TTL_MS);
        }
      },
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
        clearTypingTimer();
        setIsTyping(false);
      },
    });
    return typeof cleanup === 'function' ? cleanup : undefined;
  }, [adapter]);

  // `sendMessage(text)` or `sendMessage(text, { attachmentUrl })` — the
  // adapter handles both legacy and attachment-aware call shapes.
  const sendMessage = useCallback((text, opts) => {
    adapterRef.current?.send?.(text, opts);
  }, []);

  // Re-send a message whose `deliveryStatus` is 'failed'. The adapter still
  // holds the draft, so nothing has to be passed back in.
  const retryMessage = useCallback((id) => {
    adapterRef.current?.retryMessage?.(id);
  }, []);

  // Multipart upload — resolves to `{ url, message_type, filename,
  // mime_type, size, expires_at }`. Templates upload first, then call
  // `sendMessage(caption, { attachmentUrl: url })` to dispatch.
  const uploadAttachment = useCallback((file) => {
    const fn = adapterRef.current?.uploadAttachment;
    if (!fn) return Promise.reject(new Error('adapter does not support uploads'));
    return fn(file);
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

  // Every conversation this browser has had, newest first — what the home
  // screen lists. Resolves to `[]` on an adapter that does not keep an
  // archive (a host's own, or a mock), so the caller renders an empty list
  // rather than having to know which kind of adapter it was given.
  const listConversations = useCallback(() => {
    const fn = adapterRef.current?.listConversations;
    if (!fn) return Promise.resolve([]);
    return Promise.resolve(fn()).catch(() => []);
  }, []);

  // Switch the live thread to one picked from that list.
  const openConversation = useCallback((token) => {
    const fn = adapterRef.current?.openConversation;
    if (!fn) return Promise.resolve();
    return Promise.resolve(fn(token)).catch(() => {});
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
    retryMessage,
    selectQuickReply,
    uploadAttachment,
    markSeen,
    reset,
    refreshStatus,
    listConversations,
    openConversation,
  };
};

export default useConversation;
