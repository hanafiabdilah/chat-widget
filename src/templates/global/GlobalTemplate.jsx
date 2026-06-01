import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';

// Brand-neutral Intercom-style template. Does NOT consume the host's `t`
// theme — uses its own fixed palette so it looks the same regardless of
// where it's embedded. Suitable as the default for any project that
// doesn't have an established brand chrome.

const palette = {
  bg: '#ffffff',
  surface: '#ffffff',
  surfaceAlt: '#f3f4f6',
  border: '#e5e7eb',
  borderSubtle: '#f3f4f6',
  text: '#111827',
  textMuted: '#6b7280',
  textFaint: '#9ca3af',
  accent: '#2563eb',
  accentText: '#ffffff',
  success: '#10b981',
  danger: '#ef4444',
  shadow: '0 24px 80px rgba(15, 23, 42, 0.18), 0 4px 12px rgba(15, 23, 42, 0.08)',
};

const FloatingButton = ({ onClick, unreadCount }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="fixed z-[45] flex items-center justify-center transition-all"
      style={{
        bottom: 24, right: 24, width: 56, height: 56, borderRadius: '50%',
        background: palette.accent, color: palette.accentText,
        boxShadow: `0 10px 28px ${palette.accent}55, 0 2px 6px rgba(15,23,42,0.18)`,
        transform: hovered ? 'translateY(-2px) scale(1.04)' : 'none',
      }}
      aria-label="Open support chat"
    >
      <MessageCircle size={22} strokeWidth={2} />
      {unreadCount > 0 && (
        <span
          className="absolute flex items-center justify-center text-[11px] font-semibold"
          style={{
            top: -2, right: -2, minWidth: 20, height: 20, borderRadius: 10,
            padding: '0 6px', background: palette.danger, color: '#fff',
            border: `2px solid ${palette.bg}`,
          }}
        >
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  );
};

const Avatar = ({ agent, size = 32 }) => {
  if (!agent) return null;
  const isBot = agent.type === 'bot';
  const initials = agent.initials || agent.name?.slice(0, 1).toUpperCase() || '?';
  return (
    <div
      className="flex items-center justify-center flex-shrink-0"
      style={{
        width: size, height: size, borderRadius: '50%',
        background: isBot ? '#dbeafe' : agent.avatarColor ? `${agent.avatarColor}26` : '#e0e7ff',
        color: isBot ? palette.accent : agent.avatarColor || '#4f46e5',
        fontSize: size * 0.36, fontWeight: 600,
      }}
    >
      {isBot ? <MessageCircle size={size * 0.5} strokeWidth={2} /> : initials}
    </div>
  );
};

const MessageBubble = ({ msg, agent }) => {
  const isClient = msg.from === 'client';
  return (
    <div className={`flex gap-2 ${isClient ? 'flex-row-reverse' : 'flex-row'}`} style={{ marginBottom: 12 }}>
      {!isClient && <Avatar agent={agent} size={28} />}
      <div className={`flex flex-col ${isClient ? 'items-end' : 'items-start'}`} style={{ maxWidth: '78%' }}>
        {!isClient && agent && (
          <div className="text-[11px] mb-1 px-0.5" style={{ color: palette.textFaint }}>
            {agent.name}
          </div>
        )}
        <div
          className="px-3 py-2"
          style={{
            background: isClient ? palette.accent : palette.surfaceAlt,
            color: isClient ? palette.accentText : palette.text,
            borderRadius: 18,
            borderBottomRightRadius: isClient ? 6 : 18,
            borderBottomLeftRadius: isClient ? 18 : 6,
            fontSize: 14,
            lineHeight: 1.45,
          }}
        >
          <div className="whitespace-pre-wrap">{msg.text}</div>
        </div>
        <div className="text-[10px] mt-1 px-1" style={{ color: palette.textFaint }}>
          {msg.time}
        </div>
      </div>
    </div>
  );
};

const QuickRepliesRow = ({ options, onSelect }) => (
  <div className="flex flex-wrap gap-2 mb-3" style={{ paddingLeft: 36 }}>
    {options.map((option) => (
      <button
        key={option.id}
        type="button"
        onClick={() => onSelect(option)}
        className="px-3 py-1.5 text-xs transition-colors"
        style={{
          background: palette.bg,
          color: palette.accent,
          border: `1px solid ${palette.accent}`,
          borderRadius: 999,
          fontWeight: 500,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = palette.accent; e.currentTarget.style.color = palette.accentText; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = palette.bg; e.currentTarget.style.color = palette.accent; }}
      >
        {option.label}
      </button>
    ))}
  </div>
);

const TypingIndicator = ({ agent }) => (
  <div className="flex gap-2 items-end" style={{ marginBottom: 12 }}>
    <Avatar agent={agent} size={28} />
    <div
      className="px-3 py-2.5 flex items-center gap-1"
      style={{ background: palette.surfaceAlt, borderRadius: 18, borderBottomLeftRadius: 6 }}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 6, height: 6, borderRadius: '50%', background: palette.textMuted,
            animation: `cw-global-typing 1.4s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </div>
  </div>
);

const Panel = ({ onClose, conversation, brand }) => {
  const { messages, isTyping, currentAgent, quickReplies, sendMessage, selectQuickReply } = conversation;
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    sendMessage(trimmed);
    setInput('');
  };

  const showQuickReplies = quickReplies && quickReplies.length > 0 && messages.length <= 1;

  return (
    <div
      className="fixed z-[60] flex flex-col overflow-hidden"
      style={{
        bottom: 92, right: 24, width: 380, height: 580,
        background: palette.bg, border: `1px solid ${palette.border}`,
        borderRadius: 16, boxShadow: palette.shadow,
        animation: 'cw-global-slide-up 0.25s ease-out',
      }}
    >
      <div
        className="px-5 py-4 flex items-start gap-3 flex-shrink-0"
        style={{ background: palette.surface, borderBottom: `1px solid ${palette.border}` }}
      >
        <div className="flex-1 min-w-0">
          <div className="text-base" style={{ color: palette.text, fontWeight: 600 }}>
            {brand?.title || 'Support'}
          </div>
          <div className="text-xs mt-0.5 flex items-center gap-1.5" style={{ color: palette.textMuted }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: palette.success }} />
            {brand?.statusLine || "We're online · replies in ~2 min"}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-full transition-colors"
          style={{ color: palette.textMuted, background: 'transparent' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = palette.surfaceAlt; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          aria-label="Close chat"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4" style={{ background: palette.bg }}>
        {messages.map((message) => (
          <MessageBubble key={message.id} msg={message} agent={currentAgent} />
        ))}
        {showQuickReplies && <QuickRepliesRow options={quickReplies} onSelect={selectQuickReply} />}
        {isTyping && <TypingIndicator agent={currentAgent || { type: 'bot' }} />}
        <div ref={messagesEndRef} />
      </div>

      <div
        className="px-4 py-3 flex items-end gap-2 flex-shrink-0"
        style={{ background: palette.surface, borderTop: `1px solid ${palette.border}` }}
      >
        <div
          className="flex-1 flex items-center px-3 py-2"
          style={{ background: palette.surfaceAlt, borderRadius: 999 }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Write a message..."
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: palette.text }}
          />
        </div>
        <button
          type="button"
          onClick={handleSend}
          disabled={!input.trim()}
          className="flex items-center justify-center transition-all flex-shrink-0"
          style={{
            width: 38, height: 38, borderRadius: '50%',
            background: input.trim() ? palette.accent : palette.surfaceAlt,
            color: input.trim() ? palette.accentText : palette.textFaint,
            cursor: input.trim() ? 'pointer' : 'not-allowed',
            boxShadow: input.trim() ? `0 6px 16px ${palette.accent}40` : 'none',
          }}
          aria-label="Send"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
};

export const GlobalTemplate = ({ isOpen, onOpen, onClose, conversation, brand }) => (
  <>
    <style>{`
      @keyframes cw-global-typing { 0%, 60%, 100% { opacity: 0.3; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-3px); } }
      @keyframes cw-global-slide-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    `}</style>
    <FloatingButton onClick={onOpen} unreadCount={isOpen ? 0 : 0} />
    {isOpen && <Panel onClose={onClose} conversation={conversation} brand={brand} />}
  </>
);

export default GlobalTemplate;
