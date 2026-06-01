import React, { useEffect, useRef, useState } from 'react';
import {
  Bot, Check, CheckCheck, MessageCircle, Paperclip, Send, Smile, Sparkles, X,
} from 'lucide-react';

// ProxyBR-branded template. Consumes the host project's theme object (`t`)
// so colors stay consistent with the rest of the dashboard. All chat state
// is provided by the parent ChatWidget — this file is presentational.

const FloatingButton = ({ onClick, unreadCount, hasNew, t }) => {
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
        background: t.accent, color: t.accentText,
        boxShadow: `0 8px 32px ${t.accent}40, 0 2px 8px rgba(0,0,0,0.3)`,
        transform: hovered ? 'translateY(-2px) scale(1.05)' : 'none',
      }}
      title="Falar com a gente"
      aria-label="Abrir chat de suporte"
    >
      <MessageCircle size={22} strokeWidth={2} />
      {unreadCount > 0 && (
        <span
          className="absolute flex items-center justify-center font-mono text-[10px] font-bold"
          style={{
            top: -2, right: -2, minWidth: 20, height: 20, borderRadius: 10,
            padding: '0 6px', background: t.danger, color: '#fff',
            border: `2px solid ${t.bg}`,
          }}
        >
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
      {hasNew && (
        <span
          className="absolute pointer-events-none"
          style={{
            inset: -2, borderRadius: '50%',
            border: `2px solid ${t.accent}`,
            animation: 'cw-proxybr-pulse 2s ease-out infinite',
          }}
        />
      )}
    </button>
  );
};

const Avatar = ({ agent, size = 32, t }) => {
  if (!agent) return null;
  const isBot = agent.type === 'bot';
  return (
    <div
      className="flex items-center justify-center flex-shrink-0"
      style={{
        width: size, height: size, borderRadius: '50%',
        background: isBot ? `${t.accent}20` : `${agent.avatarColor || t.accent}25`,
        border: `1.5px solid ${isBot ? `${t.accent}50` : `${agent.avatarColor || t.accent}50`}`,
      }}
    >
      {isBot ? (
        <Bot size={size * 0.5} style={{ color: t.accent }} strokeWidth={1.75} />
      ) : (
        <span
          className="font-mono font-medium"
          style={{ fontSize: size * 0.34, color: agent.avatarColor || t.accent, letterSpacing: '0.04em' }}
        >
          {agent.initials || agent.name?.slice(0, 2).toUpperCase()}
        </span>
      )}
    </div>
  );
};

const MessageBubble = ({ msg, agentForMessage, t }) => {
  const isClient = msg.from === 'client';
  const agent = isClient ? null : agentForMessage;
  return (
    <div className={`flex gap-2 ${isClient ? 'flex-row-reverse' : 'flex-row'}`} style={{ marginBottom: 14 }}>
      {!isClient && <Avatar agent={agent} size={28} t={t} />}
      <div className={`flex flex-col ${isClient ? 'items-end' : 'items-start'}`} style={{ maxWidth: '78%' }}>
        {!isClient && agent && (
          <div className="font-mono text-[10px] uppercase mb-1 px-0.5" style={{ color: t.textFaint, letterSpacing: '0.08em' }}>
            {agent.name}{agent.role && ` · ${agent.role}`}
          </div>
        )}
        <div
          className="rounded-lg px-3 py-2"
          style={{
            background: isClient ? t.accent : t.surfaceAlt,
            color: isClient ? t.accentText : t.text,
            border: isClient ? 'none' : `1px solid ${t.borderSubtle || t.border}`,
            borderTopRightRadius: isClient ? 4 : 8,
            borderTopLeftRadius: isClient ? 8 : 4,
          }}
        >
          <div className="text-[13px] leading-relaxed whitespace-pre-wrap">{msg.text}</div>
        </div>
        <div className="font-mono text-[10px] mt-1 px-1 flex items-center gap-1" style={{ color: t.textFaint }}>
          {msg.time}
          {isClient && (msg.seen ? <CheckCheck size={11} style={{ color: t.accent }} /> : <Check size={11} />)}
        </div>
      </div>
    </div>
  );
};

const QuickRepliesRow = ({ options, onSelect, t }) => (
  <div className="flex flex-wrap gap-2 mb-3" style={{ paddingLeft: 36 }}>
    {options.map((option) => {
      const color = option.color || t[option.colorKey] || t.accent;
      const Icon = option.icon;
      return (
        <button
          key={option.id}
          type="button"
          onClick={() => onSelect(option)}
          className="px-2.5 py-1.5 rounded-full font-mono text-[10px] uppercase flex items-center gap-1.5 transition-all"
          style={{ background: `${color}10`, color, border: `1px solid ${color}40`, letterSpacing: '0.1em' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = `${color}20`; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = `${color}10`; }}
        >
          {Icon && <Icon size={11} />}
          {option.label}
        </button>
      );
    })}
  </div>
);

const TypingIndicator = ({ agent, t }) => (
  <div className="flex gap-2 items-end" style={{ marginBottom: 14 }}>
    <Avatar agent={agent} size={28} t={t} />
    <div
      className="rounded-lg px-3 py-2.5 flex items-center gap-1"
      style={{ background: t.surfaceAlt, border: `1px solid ${t.borderSubtle || t.border}`, borderTopLeftRadius: 4 }}
    >
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          style={{
            width: 6, height: 6, borderRadius: '50%', background: t.textMuted,
            animation: `cw-proxybr-typing 1.4s ease-in-out ${index * 0.2}s infinite`,
          }}
        />
      ))}
    </div>
  </div>
);

const Panel = ({
  t, onClose, conversation, brandTitle = 'ProxyBR · Suporte', statusLine = '3 atendentes online · resposta em ~2min',
}) => {
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

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  // Quick replies are tied to the first bot message — show them inline
  // right under it (matches the previous SupportChat behaviour).
  const showQuickReplies = quickReplies && quickReplies.length > 0 && messages.length <= 1;

  return (
    <div
      className="fixed z-[60] flex flex-col overflow-hidden"
      style={{
        bottom: 92, right: 24, width: 380, height: 580,
        background: t.bg, border: `1px solid ${t.border}`, borderRadius: 14,
        boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 4px 12px rgba(0,0,0,0.3)',
        animation: 'cw-proxybr-slide-up 0.25s ease-out',
      }}
    >
      <div
        className="flex items-center gap-3 px-4 py-3 relative overflow-hidden flex-shrink-0"
        style={{ background: t.surface, borderBottom: `1px solid ${t.border}` }}
      >
        <div
          className="absolute pointer-events-none"
          style={{
            top: -40, right: -40, width: 160, height: 160,
            background: `radial-gradient(circle, ${t.accent}15 0%, transparent 65%)`,
          }}
        />
        <Avatar agent={currentAgent || { type: 'bot' }} size={36} t={t} />
        <div className="flex-1 min-w-0 relative">
          <div className="text-sm font-medium" style={{ color: t.text }}>{brandTitle}</div>
          <div className="font-mono text-[10px] flex items-center gap-1.5" style={{ color: t.textMuted, letterSpacing: '0.04em' }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: t.success }} />
            {statusLine}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded transition-colors relative"
          style={{ color: t.textMuted }}
          onMouseEnter={(e) => { e.currentTarget.style.background = t.surfaceAlt; e.currentTarget.style.color = t.text; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = t.textMuted; }}
          aria-label="Fechar chat"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-thin" style={{ background: t.bg }}>
        {messages.map((message) => (
          <MessageBubble key={message.id} msg={message} agentForMessage={currentAgent} t={t} />
        ))}
        {showQuickReplies && <QuickRepliesRow options={quickReplies} onSelect={selectQuickReply} t={t} />}
        {isTyping && <TypingIndicator agent={currentAgent || { type: 'bot' }} t={t} />}
        <div ref={messagesEndRef} />
      </div>

      {messages.length > 1 && (
        <div
          className="px-4 py-2 flex items-center gap-2 flex-shrink-0"
          style={{ background: t.surfaceAlt, borderTop: `1px solid ${t.borderSubtle || t.border}` }}
        >
          <Sparkles size={11} style={{ color: t.textFaint }} />
          <span className="font-mono text-[10px]" style={{ color: t.textFaint, letterSpacing: '0.04em' }}>
            Conversa criptografada · histórico salvo no painel
          </span>
        </div>
      )}

      <div
        className="flex items-end gap-2 px-3 py-3 flex-shrink-0"
        style={{ background: t.surface, borderTop: `1px solid ${t.border}` }}
      >
        <button type="button" className="p-2 rounded transition-colors" style={{ color: t.textMuted }} title="Anexar arquivo">
          <Paperclip size={15} />
        </button>
        <div
          className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{ background: t.bg, border: `1px solid ${t.border}` }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua mensagem..."
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: t.text }}
          />
          <button type="button" className="p-0.5 rounded transition-colors" style={{ color: t.textMuted }} title="Emoji">
            <Smile size={14} />
          </button>
        </div>
        <button
          type="button"
          onClick={handleSend}
          disabled={!input.trim()}
          className="flex items-center justify-center transition-all flex-shrink-0"
          style={{
            width: 36, height: 36, borderRadius: 10,
            background: input.trim() ? t.accent : t.surfaceAlt,
            color: input.trim() ? t.accentText : t.textFaint,
            cursor: input.trim() ? 'pointer' : 'not-allowed',
            boxShadow: input.trim() ? `0 4px 12px ${t.accent}30` : 'none',
          }}
          title="Enviar mensagem"
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  );
};

// Each template owns both its launcher (FAB) and its panel. The orchestrator
// only flips `isOpen`; everything visual is local to the template.
export const ProxybrTemplate = ({ isOpen, onOpen, onClose, theme, conversation, brand }) => (
  <>
    <style>{`
      @keyframes cw-proxybr-pulse { 0% { transform: scale(1); opacity: 0.6; } 100% { transform: scale(1.6); opacity: 0; } }
      @keyframes cw-proxybr-typing { 0%, 60%, 100% { opacity: 0.3; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-3px); } }
      @keyframes cw-proxybr-slide-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    `}</style>
    <FloatingButton onClick={onOpen} unreadCount={isOpen ? 0 : 2} hasNew={!isOpen} t={theme} />
    {isOpen && (
      <Panel
        t={theme}
        onClose={onClose}
        conversation={conversation}
        brandTitle={brand?.title || 'ProxyBR · Suporte'}
        statusLine={brand?.statusLine}
      />
    )}
  </>
);

export default ProxybrTemplate;
