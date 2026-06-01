import React, { useEffect, useRef, useState } from 'react';
import {
  Bot, Check, CheckCheck, FileText, Loader2, MessageCircle, Paperclip,
  RotateCcw, Send, Smile, Upload, X,
} from 'lucide-react';
import { COPYRIGHT } from '../../core/config.js';

// Pretty-prints a file size in KB / MB. Used in attachment chips and the
// document renderer; rough precision is fine for UI.
const formatSize = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// ProxyBR-branded template. Consumes the host project's theme object (`t`)
// so colors stay consistent with the rest of the dashboard. All chat state
// is provided by the parent ChatWidget — this file is presentational.
//
// `DEFAULT_THEME` makes the template safe to render without a host theme —
// every leaf component reaches for keys like `t.accent`, `t.bg`, `t.text`,
// so a missing prop would throw at render time and the widget would never
// appear. Embedders that don't pass `theme` get this sensible dark fallback.
const DEFAULT_THEME = {
  bg: '#0a0a0a',
  surface: '#171717',
  surfaceAlt: '#1f1f1f',
  border: '#262626',
  borderSubtle: '#1f1f1f',
  text: '#fafafa',
  textMuted: '#a3a3a3',
  textFaint: '#737373',
  accent: '#c5f825',
  accentText: '#0a0a0a',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
};

const FloatingButton = ({ onClick, unreadCount, hasNew, t }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="cw-root fixed z-[45] flex items-center justify-center transition-all"
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

// Renders the attachment inline inside a message bubble. The picker for
// which element to render (img / audio / video / document chip) is
// driven by `messageType` returned by the backend — we never trust the
// MIME guess from the client.
const AttachmentBlock = ({ url, messageType, meta, t, isClient }) => {
  if (!url) return null;
  if (messageType === 'image') {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block" style={{ marginBottom: 4 }}>
        <img
          src={url}
          alt={meta?.filename || 'attachment'}
          style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 8, display: 'block' }}
        />
      </a>
    );
  }
  if (messageType === 'video') {
    return (
      <video
        controls
        src={url}
        style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 8, display: 'block', marginBottom: 4 }}
      />
    );
  }
  if (messageType === 'audio') {
    return (
      <audio
        controls
        src={url}
        style={{ width: '100%', display: 'block', marginBottom: 4 }}
      />
    );
  }
  // Document / unknown: file chip with download link. Color tracks the
  // bubble side — client bubbles use accent contrast, agent bubbles use
  // the muted surface palette.
  const fg = isClient ? t.accentText : t.text;
  const fgMuted = isClient ? `${t.accentText}99` : t.textFaint;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      download={meta?.filename || undefined}
      className="flex items-center gap-2.5 rounded-lg"
      style={{
        padding: 8,
        background: isClient ? 'rgba(0,0,0,0.08)' : t.bg,
        border: `1px solid ${isClient ? 'rgba(0,0,0,0.12)' : t.border}`,
        marginBottom: 4,
        textDecoration: 'none',
        color: fg,
        minWidth: 0,
      }}
    >
      <div
        className="flex items-center justify-center flex-shrink-0"
        style={{ width: 32, height: 32, borderRadius: 8, background: isClient ? 'rgba(0,0,0,0.1)' : t.surfaceAlt }}
      >
        <FileText size={16} />
      </div>
      <div className="flex flex-col min-w-0">
        <div className="text-[12px] truncate" style={{ color: fg, maxWidth: 200 }}>
          {meta?.filename || 'arquivo'}
        </div>
        {meta?.size != null && (
          <div className="font-mono text-[10px]" style={{ color: fgMuted }}>
            {formatSize(meta.size)}
          </div>
        )}
      </div>
    </a>
  );
};

const MessageBubble = ({ msg, agentForMessage, t }) => {
  const isClient = msg.from === 'client';
  const agent = isClient ? null : agentForMessage;
  const hasAttachment = !!msg.attachmentUrl && msg.messageType && msg.messageType !== 'text';
  const hasCaption = msg.text && msg.text.trim().length > 0;
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
          className="rounded-lg"
          style={{
            // Tighter padding for media bubbles so the attachment fills
            // edge-to-edge; text-only keeps the chat-bubble feel.
            padding: hasAttachment && !hasCaption ? 4 : '6px 12px',
            background: isClient ? t.accent : t.surfaceAlt,
            color: isClient ? t.accentText : t.text,
            border: isClient ? 'none' : `1px solid ${t.borderSubtle || t.border}`,
            borderTopRightRadius: isClient ? 4 : 8,
            borderTopLeftRadius: isClient ? 8 : 4,
          }}
        >
          {hasAttachment && (
            <AttachmentBlock
              url={msg.attachmentUrl}
              messageType={msg.messageType}
              meta={msg.attachmentMeta}
              t={t}
              isClient={isClient}
            />
          )}
          {hasCaption && (
            <div className="text-[13px] leading-relaxed whitespace-pre-wrap">{msg.text}</div>
          )}
        </div>
        <div className="font-mono text-[10px] mt-1 px-1 flex items-center gap-1" style={{ color: t.textFaint }}>
          {msg.time}
          {isClient && (msg.seen ? <CheckCheck size={11} style={{ color: t.accent }} /> : <Check size={11} />)}
        </div>
      </div>
    </div>
  );
};

// Bar shown above the input while an attachment is staged for sending.
// Three visual states match adapter lifecycle: uploading (spinner),
// ready (full preview), failed (error chip with retry). Visitor can
// cancel at any state.
const AttachmentPreview = ({ pending, onCancel, t }) => {
  const { file, localUrl, status, uploaded } = pending;
  const guessedType = uploaded?.message_type || (
    file.type.startsWith('image/') ? 'image'
      : file.type.startsWith('video/') ? 'video'
        : file.type.startsWith('audio/') ? 'audio'
          : 'document'
  );
  return (
    <div
      className="flex items-center gap-3 px-3 py-2 flex-shrink-0"
      style={{
        background: t.surfaceAlt,
        borderTop: `1px solid ${t.borderSubtle || t.border}`,
        borderBottom: `1px solid ${t.borderSubtle || t.border}`,
      }}
    >
      {guessedType === 'image' ? (
        <img
          src={localUrl}
          alt={file.name}
          style={{ width: 44, height: 44, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }}
        />
      ) : (
        <div
          className="flex items-center justify-center flex-shrink-0"
          style={{ width: 44, height: 44, borderRadius: 6, background: t.bg, border: `1px solid ${t.border}`, color: t.textMuted }}
        >
          <FileText size={18} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-[12px] truncate" style={{ color: t.text }}>{file.name}</div>
        <div className="font-mono text-[10px] flex items-center gap-1.5" style={{ color: t.textFaint }}>
          {status === 'uploading' && (
            <>
              <Loader2 size={10} className="animate-spin" />
              Enviando…
            </>
          )}
          {status === 'ready' && (
            <span>{formatSize(file.size)} · pronto</span>
          )}
          {status === 'failed' && (
            <span style={{ color: t.danger }}>Falhou ao enviar — cancele e tente novamente</span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="p-1 rounded transition-colors"
        style={{ color: t.textMuted }}
        onMouseEnter={(e) => { e.currentTarget.style.color = t.text; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = t.textMuted; }}
        aria-label="Cancelar anexo"
        title="Cancelar"
      >
        <X size={14} />
      </button>
    </div>
  );
};

// Full-panel translucent overlay shown while a file is being dragged
// over the panel — purely visual feedback, the drop handler is on the
// panel root.
const DropOverlay = ({ t }) => (
  <div
    className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
    style={{
      zIndex: 2,
      background: `${t.bg}E6`,
      border: `2px dashed ${t.accent}`,
      borderRadius: 14,
      color: t.accent,
    }}
  >
    <Upload size={32} />
    <div className="font-mono text-[11px] uppercase mt-2" style={{ letterSpacing: '0.12em' }}>
      Solte o arquivo aqui
    </div>
  </div>
);

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

// Quick-reply chips driven by the host-supplied `initialChatOptions`
// prop. Shown above the input until the visitor sends their first
// message; clicking one fires a normal `POST /messages`, so the agent
// receives it identically to a typed message.
const InitialOptionsRow = ({ options, onSelect, t }) => (
  <div className="space-y-2" style={{ paddingLeft: 36 }}>
    {options.map((option) => {
      const color = option.color || t.accent;
      return (
        <div
          key={option.id}
          onClick={() => onSelect(option)}
          className="px-2.5 py-1.5 cursor-pointer rounded-full font-mono text-[10px] uppercase flex items-center gap-1.5 transition-all"
          style={{ background: `${color}10`, color, border: `1px solid ${color}40`, letterSpacing: '0.1em' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = `${color}25`; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = `${color}10`; }}
        >
          {option.label}
        </div>
      );
    })}
  </div>
);

// Replaces the input bar when the conversation has been resolved by the
// agent. Visitor can read the history (the messages list above is still
// visible) but can't send anything new — the only action is starting a
// fresh conversation via reset().
const ResolvedFooter = ({ t, onReset }) => (
  <div
    className="flex flex-col items-center gap-2 px-4 py-3 flex-shrink-0"
    style={{ background: t.surface, borderTop: `1px solid ${t.border}` }}
  >
    <div className="font-mono text-[10px] uppercase text-center" style={{ color: t.textFaint, letterSpacing: '0.1em' }}>
      Conversa encerrada pelo atendente
    </div>
    <button
      type="button"
      onClick={onReset}
      className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] transition-all"
      style={{
        background: t.accent,
        color: t.accentText,
        boxShadow: `0 4px 12px ${t.accent}30`,
      }}
    >
      <RotateCcw size={11} />
      Iniciar nova conversa
    </button>
  </div>
);

// Placeholder shown when the adapter hasn't reported `status: 'ready'` yet
// (i.e. still loading config / session, or got a 422 invalid app_id from
// the backend). Intentionally generic — no error text, no retry button —
// so a misconfigured embed looks like a chat that's still warming up
// rather than something broken.
const NotReadyBody = ({ t }) => (
  <div className="flex-1 flex flex-col items-center justify-center px-6" style={{ background: t.bg }}>
    <div className="flex items-center gap-1.5 mb-4" aria-hidden>
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          style={{
            width: 8, height: 8, borderRadius: '50%', background: t.textMuted,
            animation: `cw-proxybr-typing 1.4s ease-in-out ${index * 0.2}s infinite`,
          }}
        />
      ))}
    </div>
    <div className="font-mono text-[11px] uppercase" style={{ color: t.textFaint, letterSpacing: '0.12em' }}>
      Preparando atendimento
    </div>
  </div>
);

const Panel = ({ t, onClose, conversation, initialChatOptions }) => {
  // Brand title comes from the API config (`connection.name`). Falls back
  // to the current agent name, then to a generic label when neither is
  // available yet (e.g. during boot or with an invalid app_id).
  const brandTitle = conversation.config?.brand?.title;
  const resolvedTitle = brandTitle || conversation.currentAgent?.name || 'Suporte';
  // While not ready, never claim "Online" — that would lie about availability.
  const resolvedStatus = conversation.status !== 'ready'
    ? 'Conectando…'
    : (conversation.currentAgent ? `${conversation.currentAgent.name} · online` : 'Online');
  const { messages, isTyping, currentAgent, quickReplies, sendMessage, selectQuickReply, uploadAttachment } = conversation;
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Attachment staging state. Shape:
  //   null  →  nothing pending
  //   { file, localUrl, status: 'uploading' | 'ready' | 'failed', uploaded? }
  // `localUrl` is a blob: URL created via URL.createObjectURL so the
  // preview can render before the server's signed URL is back. We
  // revoke it on cancel / successful send to free memory.
  const [pending, setPending] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragDepthRef = useRef(0);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Revoke the blob URL when the panel unmounts so we don't leak object
  // URLs across mount/unmount cycles.
  useEffect(() => () => {
    if (pending?.localUrl) URL.revokeObjectURL(pending.localUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startUpload = (file) => {
    if (!file) return;
    if (pending?.localUrl) URL.revokeObjectURL(pending.localUrl);
    const localUrl = URL.createObjectURL(file);
    setPending({ file, localUrl, status: 'uploading' });
    uploadAttachment(file)
      .then((uploaded) => {
        setPending((prev) => (prev?.file === file ? { ...prev, status: 'ready', uploaded } : prev));
      })
      .catch((err) => {
        setPending((prev) => (prev?.file === file ? { ...prev, status: 'failed', error: err } : prev));
      });
  };

  const cancelPending = () => {
    if (pending?.localUrl) URL.revokeObjectURL(pending.localUrl);
    setPending(null);
  };

  const handlePickFile = () => {
    fileInputRef.current?.click();
  };
  const handleFileInput = (e) => {
    const file = e.target.files?.[0];
    if (file) startUpload(file);
    e.target.value = '';
  };

  // Native HTML5 drag-and-drop. dragenter/leave fire on every child
  // element transition which causes flicker, so we ref-count enter/leave
  // to know when the cursor has actually left the panel.
  const handleDragEnter = (e) => {
    e.preventDefault();
    dragDepthRef.current += 1;
    setIsDragOver(true);
  };
  const handleDragLeave = (e) => {
    e.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDragOver(false);
  };
  const handleDragOver = (e) => {
    e.preventDefault();
  };
  const handleDrop = (e) => {
    e.preventDefault();
    dragDepthRef.current = 0;
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) startUpload(file);
  };

  const canSendCaption = input.trim().length > 0;
  const canSendAttachment = pending?.status === 'ready';
  const canSend = canSendCaption || canSendAttachment;

  const handleSend = () => {
    if (!canSend) return;
    const caption = input.trim();
    if (canSendAttachment) {
      sendMessage(caption || '', { attachmentUrl: pending.uploaded.url });
      URL.revokeObjectURL(pending.localUrl);
      setPending(null);
      setInput('');
      return;
    }
    sendMessage(caption);
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
  // Host-defined chat options stay visible until the visitor sends their
  // first message (whether via input or by tapping a chip — that fires the
  // same POST under the hood and adds a `from: 'client'` bubble).
  const visitorHasSpoken = messages.some((m) => m.from === 'client');
  const showInitialOptions = Array.isArray(initialChatOptions)
    && initialChatOptions.length > 0
    && !visitorHasSpoken;

  // Tapping an option just sends its message text via the adapter — there's
  // no special endpoint, so the agent sees it identically to typed input.
  const handleSelectOption = (option) => {
    const text = option.message || option.label;
    if (text) sendMessage(text);
  };
  // Only render the live chat surface (history + input) once the adapter
  // says it's ready. Until then (loading, invalid app_id, transient errors)
  // we show a neutral "warming up" placeholder so the embed never looks
  // broken from the visitor's point of view.
  const isReady = conversation.status === 'ready';
  // When the agent resolves the conversation, history stays readable but
  // the input is replaced by a "Start new conversation" CTA — visitor
  // controls when to spin up a fresh session.
  const isResolved = conversation.conversationStatus === 'resolved';

  return (
    <div
      className="cw-root fixed z-[60] flex flex-col overflow-hidden"
      style={{
        bottom: 92, right: 24, width: 380, height: 580,
        background: t.bg, border: `1px solid ${t.border}`, borderRadius: 14,
        boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 4px 12px rgba(0,0,0,0.3)',
        animation: 'cw-proxybr-slide-up 0.25s ease-out',
        position: 'fixed',
      }}
      onDragEnter={isResolved ? undefined : handleDragEnter}
      onDragLeave={isResolved ? undefined : handleDragLeave}
      onDragOver={isResolved ? undefined : handleDragOver}
      onDrop={isResolved ? undefined : handleDrop}
    >
      {isDragOver && !isResolved && <DropOverlay t={t} />}
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileInput}
        style={{ display: 'none' }}
      />
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
          <div className="text-sm font-medium" style={{ color: t.text }}>{resolvedTitle}</div>
          <div className="font-mono text-[10px] flex items-center gap-1.5" style={{ color: t.textMuted, letterSpacing: '0.04em' }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: conversation.status === 'ready' ? t.success : t.textFaint }} />
            {resolvedStatus}
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

      {isReady ? (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-thin" style={{ background: t.bg }}>
            {messages.map((message) => (
              <MessageBubble key={message.id} msg={message} agentForMessage={currentAgent} t={t} />
            ))}
            {showQuickReplies && <QuickRepliesRow options={quickReplies} onSelect={selectQuickReply} t={t} />}
            {showInitialOptions && !isResolved && <InitialOptionsRow options={initialChatOptions} onSelect={handleSelectOption} t={t} />}
            {isTyping && <TypingIndicator agent={currentAgent || { type: 'bot' }} t={t} />}
            <div ref={messagesEndRef} />
          </div>

          {isResolved ? (
            <ResolvedFooter t={t} onReset={conversation.reset} />
          ) : (
          <>
            {pending && (
              <AttachmentPreview pending={pending} onCancel={cancelPending} t={t} />
            )}
            <div
              className="flex items-end gap-2 px-3 py-3 flex-shrink-0"
              style={{ background: t.surface, borderTop: `1px solid ${t.border}` }}
            >
              <button
                type="button"
                onClick={handlePickFile}
                className="p-2 rounded transition-colors"
                style={{ color: t.textMuted }}
                onMouseEnter={(e) => { e.currentTarget.style.color = t.text; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = t.textMuted; }}
                title="Anexar arquivo"
                aria-label="Anexar arquivo"
              >
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
                  placeholder={pending ? 'Adicione uma legenda…' : 'Digite sua mensagem...'}
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
                disabled={!canSend}
                className="flex items-center justify-center transition-all flex-shrink-0"
                style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: canSend ? t.accent : t.surfaceAlt,
                  color: canSend ? t.accentText : t.textFaint,
                  cursor: canSend ? 'pointer' : 'not-allowed',
                  boxShadow: canSend ? `0 4px 12px ${t.accent}30` : 'none',
                }}
                title="Enviar mensagem"
              >
                <Send size={15} />
              </button>
            </div>
          </>
          )}
        </>
      ) : (
        <NotReadyBody t={t} />
      )}
      <div
        className="flex items-center justify-center py-1.5 flex-shrink-0"
        style={{ background: t.surface, borderTop: `1px solid ${t.borderSubtle || t.border}` }}
      >
        <span className="font-mono text-[9px]" style={{ color: t.textFaint, letterSpacing: '0.08em' }}>
          {COPYRIGHT}
        </span>
      </div>
    </div>
  );
};

// Each template owns both its launcher (FAB) and its panel. The orchestrator
// only flips `isOpen`; everything visual is local to the template.
export const ProxybrTemplate = ({ isOpen, onOpen, onClose, theme, conversation, initialChatOptions }) => {
  // If the host didn't pass a theme, fall back to DEFAULT_THEME so children
  // (FAB, Panel, MessageBubble, etc.) always receive a complete palette.
  // Hosts that DO pass `theme` keep full control.
  const t = theme || DEFAULT_THEME;
  // Unread badge + pulse ring are driven by real `unreadCount` from API.md
  // §4.3 (outgoing messages newer than `last_seen_at`). When the panel is
  // open or the adapter isn't ready, suppress both — opening the panel
  // triggers POST /seen which resets the count anyway.
  const ready = conversation.status === 'ready';
  const fabUnread = ready && !isOpen ? conversation.unreadCount : 0;
  const fabHasNew = fabUnread > 0;
  return (
  <>
    <style>{`
      @keyframes cw-proxybr-pulse { 0% { transform: scale(1); opacity: 0.6; } 100% { transform: scale(1.6); opacity: 0; } }
      @keyframes cw-proxybr-typing { 0%, 60%, 100% { opacity: 0.3; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-3px); } }
      @keyframes cw-proxybr-slide-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    `}</style>
    <FloatingButton onClick={onOpen} unreadCount={fabUnread} hasNew={fabHasNew} t={t} />
    {isOpen && (
      <Panel
        t={t}
        onClose={onClose}
        conversation={conversation}
        initialChatOptions={initialChatOptions}
      />
    )}
  </>
  );
};

export default ProxybrTemplate;
