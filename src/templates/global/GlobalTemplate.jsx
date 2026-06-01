import React, { useEffect, useRef, useState } from 'react';
import {
  FileText, Loader2, MessageCircle, Paperclip, RotateCcw, Send, Smile, Upload, X,
} from 'lucide-react';
import { COPYRIGHT } from '../../core/config.js';
import { EmojiPicker } from '../EmojiPicker.jsx';

const formatSize = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

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
      className="cw-root fixed z-[45] flex items-center justify-center transition-all"
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

// Renders the attachment inline inside a message bubble.
const AttachmentBlock = ({ url, messageType, meta, isClient }) => {
  if (!url) return null;
  if (messageType === 'image') {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block" style={{ marginBottom: 4 }}>
        <img
          src={url}
          alt={meta?.filename || 'attachment'}
          style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 12, display: 'block' }}
        />
      </a>
    );
  }
  if (messageType === 'video') {
    return (
      <video controls src={url} style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 12, display: 'block', marginBottom: 4 }} />
    );
  }
  if (messageType === 'audio') {
    return (
      <audio controls src={url} style={{ width: '100%', display: 'block', marginBottom: 4 }} />
    );
  }
  const fg = isClient ? palette.accentText : palette.text;
  const fgMuted = isClient ? `${palette.accentText}99` : palette.textFaint;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      download={meta?.filename || undefined}
      className="flex items-center gap-2.5 rounded-lg"
      style={{
        padding: 8,
        background: isClient ? 'rgba(0,0,0,0.08)' : palette.bg,
        border: `1px solid ${isClient ? 'rgba(0,0,0,0.12)' : palette.border}`,
        marginBottom: 4,
        textDecoration: 'none',
        color: fg,
      }}
    >
      <div
        className="flex items-center justify-center flex-shrink-0"
        style={{ width: 32, height: 32, borderRadius: 8, background: isClient ? 'rgba(0,0,0,0.1)' : palette.surfaceAlt }}
      >
        <FileText size={16} />
      </div>
      <div className="flex flex-col min-w-0">
        <div className="text-[12px] truncate" style={{ color: fg, maxWidth: 200 }}>
          {meta?.filename || 'file'}
        </div>
        {meta?.size != null && (
          <div className="text-[10px]" style={{ color: fgMuted }}>{formatSize(meta.size)}</div>
        )}
      </div>
    </a>
  );
};

const MessageBubble = ({ msg, agent }) => {
  const isClient = msg.from === 'client';
  const hasAttachment = !!msg.attachmentUrl && msg.messageType && msg.messageType !== 'text';
  const hasCaption = msg.text && msg.text.trim().length > 0;
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
          style={{
            // Tight padding for media-only bubbles; chat-bubble feel
            // for text or captioned media.
            padding: hasAttachment && !hasCaption ? 4 : '6px 12px',
            background: isClient ? palette.accent : palette.surfaceAlt,
            color: isClient ? palette.accentText : palette.text,
            borderRadius: 18,
            borderBottomRightRadius: isClient ? 6 : 18,
            borderBottomLeftRadius: isClient ? 18 : 6,
            fontSize: 14,
            lineHeight: 1.45,
          }}
        >
          {hasAttachment && (
            <AttachmentBlock
              url={msg.attachmentUrl}
              messageType={msg.messageType}
              meta={msg.attachmentMeta}
              isClient={isClient}
            />
          )}
          {hasCaption && <div className="whitespace-pre-wrap">{msg.text}</div>}
        </div>
        <div className="text-[10px] mt-1 px-1" style={{ color: palette.textFaint }}>
          {msg.time}
        </div>
      </div>
    </div>
  );
};

// Bar shown above the input while an attachment is staged for sending.
const AttachmentPreview = ({ pending, onCancel }) => {
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
        background: palette.surfaceAlt,
        borderTop: `1px solid ${palette.borderSubtle || palette.border}`,
        borderBottom: `1px solid ${palette.borderSubtle || palette.border}`,
      }}
    >
      {guessedType === 'image' ? (
        <img src={localUrl} alt={file.name} style={{ width: 44, height: 44, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
      ) : (
        <div
          className="flex items-center justify-center flex-shrink-0"
          style={{ width: 44, height: 44, borderRadius: 6, background: palette.bg, border: `1px solid ${palette.border}`, color: palette.textMuted }}
        >
          <FileText size={18} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-xs truncate" style={{ color: palette.text }}>{file.name}</div>
        <div className="text-[10px] flex items-center gap-1.5" style={{ color: palette.textFaint }}>
          {status === 'uploading' && (<><Loader2 size={10} className="animate-spin" /> Uploading…</>)}
          {status === 'ready' && <span>{formatSize(file.size)} · ready</span>}
          {status === 'failed' && <span style={{ color: palette.danger }}>Upload failed — cancel and retry</span>}
        </div>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="p-1 rounded-full transition-colors"
        style={{ color: palette.textMuted }}
        onMouseEnter={(e) => { e.currentTarget.style.color = palette.text; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = palette.textMuted; }}
        aria-label="Cancel attachment"
      >
        <X size={14} />
      </button>
    </div>
  );
};

const DropOverlay = () => (
  <div
    className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
    style={{
      zIndex: 2,
      background: 'rgba(255,255,255,0.95)',
      border: `2px dashed ${palette.accent}`,
      borderRadius: 16,
      color: palette.accent,
    }}
  >
    <Upload size={32} />
    <div className="text-xs mt-2" style={{ fontWeight: 600 }}>Drop file here</div>
  </div>
);

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

// Quick-reply chips driven by the host-supplied `initialChatOptions`
// prop. Shown above the input until the visitor sends their first
// message; clicking one fires a normal `POST /messages`, so the agent
// receives it identically to a typed message.
const InitialOptionsRow = ({ options, onSelect }) => (
  <div className="flex flex-wrap gap-2 mb-3" style={{ paddingLeft: 36 }}>
    {options.map((option) => {
      const color = option.color || palette.accent;
      return (
        <div
          key={option.id}
          onClick={() => onSelect(option)}
          className="px-3 cursor-pointer py-1.5 text-xs transition-colors"
          style={{
            background: palette.bg,
            color,
            border: `1px solid ${color}`,
            borderRadius: 999,
            fontWeight: 500,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = color; e.currentTarget.style.color = palette.bg; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = palette.bg; e.currentTarget.style.color = color; }}
        >
          {option.label}
        </div>
      );
    })}
  </div>
);

// Footer shown in place of the input when the conversation has been
// resolved by the agent. Visitor can still scroll the history but the
// only forward action is starting a fresh session.
const ResolvedFooter = ({ onReset }) => (
  <div
    className="flex flex-col items-center gap-2 px-4 py-3 flex-shrink-0"
    style={{ background: palette.surface, borderTop: `1px solid ${palette.border}` }}
  >
    <div className="text-xs text-center" style={{ color: palette.textMuted }}>
      This conversation has ended
    </div>
    <button
      type="button"
      onClick={onReset}
      className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all"
      style={{
        background: palette.accent,
        color: palette.accentText,
        boxShadow: `0 4px 12px ${palette.accent}40`,
        fontWeight: 500,
      }}
    >
      <RotateCcw size={12} />
      Start new conversation
    </button>
  </div>
);

// Placeholder body shown until the adapter reports `status: 'ready'`
// (covers normal config/session loading AND the 422 invalid-app_id case).
// Deliberately neutral so a misconfigured embed reads as "still warming
// up" rather than "broken" to visitors.
const NotReadyBody = () => (
  <div className="flex-1 flex flex-col items-center justify-center px-6" style={{ background: palette.bg }}>
    <div className="flex items-center gap-1.5 mb-3" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 8, height: 8, borderRadius: '50%', background: palette.textMuted,
            animation: `cw-global-typing 1.4s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </div>
    <div className="text-xs" style={{ color: palette.textFaint }}>
      Setting up your chat
    </div>
  </div>
);

const Panel = ({ onClose, conversation, initialChatOptions }) => {
  // Brand title comes from the API config (`connection.name`).
  const brandTitle = conversation.config?.brand?.title;
  const { messages, isTyping, currentAgent, quickReplies, sendMessage, selectQuickReply, uploadAttachment } = conversation;
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const textInputRef = useRef(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [pending, setPending] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragDepthRef = useRef(0);

  const insertEmoji = (emoji) => {
    const el = textInputRef.current;
    if (!el || typeof el.selectionStart !== 'number') {
      setInput((prev) => prev + emoji);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd ?? start;
    setInput((prev) => prev.slice(0, start) + emoji + prev.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + emoji.length;
      try { el.setSelectionRange(pos, pos); } catch (_e) { /* ignore */ }
    });
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

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

  const handlePickFile = () => fileInputRef.current?.click();
  const handleFileInput = (e) => {
    const file = e.target.files?.[0];
    if (file) startUpload(file);
    e.target.value = '';
  };

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
  const handleDragOver = (e) => { e.preventDefault(); };
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

  const showQuickReplies = quickReplies && quickReplies.length > 0 && messages.length <= 1;
  // Only show the live chat surface once the adapter is ready. Otherwise
  // (loading, 422 unavailable, transient error) render a neutral
  // "setting up" placeholder so visitors never face a broken-looking chat.
  const isReady = conversation.status === 'ready';
  const isResolved = conversation.conversationStatus === 'resolved';
  // Host-supplied chat options visible until the visitor sends anything
  // (typed or via chip — both produce a `from: 'client'` bubble).
  const visitorHasSpoken = messages.some((m) => m.from === 'client');
  const showInitialOptions = Array.isArray(initialChatOptions)
    && initialChatOptions.length > 0
    && !visitorHasSpoken;
  const handleSelectOption = (option) => {
    const text = option.message || option.label;
    if (text) sendMessage(text);
  };

  return (
    <div
      className="cw-root fixed z-[60] flex flex-col overflow-hidden"
      style={{
        bottom: 92, right: 24, width: 380, height: 580,
        background: palette.bg, border: `1px solid ${palette.border}`,
        borderRadius: 16, boxShadow: palette.shadow,
        animation: 'cw-global-slide-up 0.25s ease-out',
      }}
      onDragEnter={isResolved ? undefined : handleDragEnter}
      onDragLeave={isResolved ? undefined : handleDragLeave}
      onDragOver={isResolved ? undefined : handleDragOver}
      onDrop={isResolved ? undefined : handleDrop}
    >
      {isDragOver && !isResolved && <DropOverlay />}
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileInput}
        style={{ display: 'none' }}
      />
      <div
        className="px-5 py-4 flex items-start gap-3 flex-shrink-0"
        style={{ background: palette.surface, borderBottom: `1px solid ${palette.border}` }}
      >
        <div className="flex-1 min-w-0">
          <div className="text-base" style={{ color: palette.text, fontWeight: 600 }}>
            {brandTitle || currentAgent?.name || 'Support'}
          </div>
          <div className="text-xs mt-0.5 flex items-center gap-1.5" style={{ color: palette.textMuted }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: isReady ? palette.success : palette.textFaint }} />
            {!isReady ? 'Connecting…' : (currentAgent ? `${currentAgent.name} · online` : 'Online')}
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

      {isReady ? (
        <>
          <div className="flex-1 overflow-y-auto px-5 py-4" style={{ background: palette.bg }}>
            {messages.map((message) => (
              <MessageBubble key={message.id} msg={message} agent={currentAgent} />
            ))}
            {showQuickReplies && <QuickRepliesRow options={quickReplies} onSelect={selectQuickReply} />}
            {showInitialOptions && !isResolved && <InitialOptionsRow options={initialChatOptions} onSelect={handleSelectOption} />}
            {isTyping && <TypingIndicator agent={currentAgent || { type: 'bot' }} />}
            <div ref={messagesEndRef} />
          </div>

          {isResolved ? (
            <ResolvedFooter onReset={conversation.reset} />
          ) : (
          <div style={{ position: 'relative' }}>
            {emojiOpen && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: 8,
                  right: 8,
                  marginBottom: 8,
                  zIndex: 3,
                }}
              >
                <EmojiPicker
                  onSelect={insertEmoji}
                  onClose={() => setEmojiOpen(false)}
                  colors={{
                    bg: palette.surface,
                    surfaceAlt: palette.surfaceAlt,
                    border: palette.border,
                    borderSubtle: palette.borderSubtle || palette.border,
                    text: palette.text,
                    textMuted: palette.textMuted,
                    accent: palette.accent,
                    hover: palette.surfaceAlt,
                  }}
                />
              </div>
            )}
            {pending && <AttachmentPreview pending={pending} onCancel={cancelPending} />}
            <div
              className="px-4 py-3 flex items-end gap-2 flex-shrink-0"
              style={{ background: palette.surface, borderTop: `1px solid ${palette.border}` }}
            >
              <button
                type="button"
                onClick={handlePickFile}
                className="p-2 rounded-full transition-colors flex-shrink-0"
                style={{ color: palette.textMuted }}
                onMouseEnter={(e) => { e.currentTarget.style.color = palette.text; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = palette.textMuted; }}
                aria-label="Attach file"
                title="Attach file"
              >
                <Paperclip size={16} />
              </button>
              <div
                className="flex-1 flex items-center px-3 py-2"
                style={{ background: palette.surfaceAlt, borderRadius: 999 }}
              >
                <input
                  ref={textInputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder={pending ? 'Add a caption…' : 'Write a message...'}
                  className="flex-1 bg-transparent outline-none text-sm"
                  style={{ color: palette.text }}
                />
                <button
                  type="button"
                  onClick={() => setEmojiOpen((v) => !v)}
                  className="p-0.5 rounded-full transition-colors"
                  style={{ color: emojiOpen ? palette.accent : palette.textMuted }}
                  aria-label="Pick emoji"
                  aria-expanded={emojiOpen}
                  title="Emoji"
                >
                  <Smile size={16} />
                </button>
              </div>
              <button
                type="button"
                onClick={handleSend}
                disabled={!canSend}
                className="flex items-center justify-center transition-all flex-shrink-0"
                style={{
                  width: 38, height: 38, borderRadius: '50%',
                  background: canSend ? palette.accent : palette.surfaceAlt,
                  color: canSend ? palette.accentText : palette.textFaint,
                  cursor: canSend ? 'pointer' : 'not-allowed',
                  boxShadow: canSend ? `0 6px 16px ${palette.accent}40` : 'none',
                }}
                aria-label="Send"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
          )}
        </>
      ) : (
        <NotReadyBody />
      )}
      <div
        className="flex items-center justify-center py-1.5 flex-shrink-0"
        style={{ background: palette.surface, borderTop: `1px solid ${palette.borderSubtle || palette.border}` }}
      >
        <span className="text-[10px]" style={{ color: palette.textFaint }}>
          {COPYRIGHT}
        </span>
      </div>
    </div>
  );
};

export const GlobalTemplate = ({ isOpen, onOpen, onClose, conversation, initialChatOptions }) => {
  // Unread badge driven by API.md §4.3 `unread_count`. Hidden when the
  // panel is open or the adapter isn't ready yet.
  const ready = conversation.status === 'ready';
  const fabUnread = ready && !isOpen ? conversation.unreadCount : 0;
  return (
    <>
      <style>{`
        @keyframes cw-global-typing { 0%, 60%, 100% { opacity: 0.3; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-3px); } }
        @keyframes cw-global-slide-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      <FloatingButton onClick={onOpen} unreadCount={fabUnread} />
      {isOpen && <Panel onClose={onClose} conversation={conversation} initialChatOptions={initialChatOptions} />}
    </>
  );
};

export default GlobalTemplate;
