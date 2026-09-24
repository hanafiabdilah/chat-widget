/*
 * The conversation itself: header, thread, composer.
 *
 * This is the widget as it was before the home screen existed, with two
 * changes. Its colours now come from the palette rather than a fixed object,
 * and its header has a back arrow, because home is where it was opened from
 * and a view you cannot leave is a trap — that arrow is the whole reason no
 * bottom tab bar is needed.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Paperclip, RotateCcw, Send, Smile, X } from 'lucide-react';
import { EmojiPicker } from '../EmojiPicker.jsx';
import {
  AttachmentPreview, Avatar, BrandMark, ChipRow, DropOverlay, IconButton,
  MessageBubble, NotReadyBody, TypingIndicator,
} from './parts.jsx';

const ResolvedFooter = ({ onReset, palette, strings }) => (
  <div
    className="flex flex-col items-center gap-2 px-4 py-3 flex-shrink-0"
    style={{ background: palette.surface, borderTop: `1px solid ${palette.border}` }}
  >
    <div className="text-xs text-center" style={{ color: palette.textMuted }}>{strings.conversationEnded}</div>
    <button
      type="button"
      onClick={onReset}
      className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all"
      style={{
        background: palette.accent,
        color: palette.accentText,
        boxShadow: `0 4px 12px ${palette.accentGlow}`,
        fontWeight: 500,
      }}
    >
      <RotateCcw size={12} />
      {strings.startNewConversation}
    </button>
  </div>
);

export const ChatView = ({
  palette,
  strings,
  conversation,
  initialChatOptions,
  brandTitle,
  onClose,
  onBack,
  showBack,
}) => {
  const {
    messages, isTyping, currentAgent, quickReplies,
    sendMessage, retryMessage, selectQuickReply, uploadAttachment,
  } = conversation;

  const [input, setInput] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [pending, setPending] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const textInputRef = useRef(null);
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

  // Focus the composer when the view opens. Arriving here is always a
  // deliberate act — a card was tapped — so the keyboard should already be up.
  useEffect(() => {
    const id = requestAnimationFrame(() => textInputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);

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
      .then((uploaded) => setPending((prev) => (prev?.file === file ? { ...prev, status: 'ready', uploaded } : prev)))
      .catch((err) => setPending((prev) => (prev?.file === file ? { ...prev, status: 'failed', error: err } : prev)));
  };

  const cancelPending = () => {
    if (pending?.localUrl) URL.revokeObjectURL(pending.localUrl);
    setPending(null);
  };

  const handleFileInput = (e) => {
    const file = e.target.files?.[0];
    if (file) startUpload(file);
    e.target.value = '';
  };

  const handleDragEnter = (e) => { e.preventDefault(); dragDepthRef.current += 1; setIsDragOver(true); };
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

  // Paste a screenshot straight into the composer — a screen capture is bytes
  // on the clipboard, not a file on disk. Bound to the input, not the panel: a
  // document-level listener in an embedded widget would swallow pastes meant
  // for the host page.
  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.kind !== 'file' || !item.type.startsWith('image/')) continue;
      const file = item.getAsFile();
      if (!file) continue;
      // Chrome also offers a text flavour for a copied image; without this its
      // filename lands in the input next to the upload.
      e.preventDefault();
      startUpload(file);
      return;
    }
  };

  const canSendCaption = input.trim().length > 0;
  const canSendAttachment = pending?.status === 'ready';
  const canSend = canSendCaption || canSendAttachment;

  const handleSend = () => {
    if (!canSend) return;
    const caption = input.trim();
    if (canSendAttachment) {
      // The whole upload payload, not just the URL — the optimistic bubble
      // needs the message type and filename to draw the image straight away.
      sendMessage(caption || '', { attachment: pending.uploaded });
      URL.revokeObjectURL(pending.localUrl);
      setPending(null);
      setInput('');
      return;
    }
    sendMessage(caption);
    setInput('');
  };

  const isReady = conversation.status === 'ready';
  const isResolved = conversation.conversationStatus === 'resolved';
  const showQuickReplies = quickReplies && quickReplies.length > 0 && messages.length <= 1;
  // Host-supplied chips stay up until the visitor says anything at all — typed
  // or tapped, both produce a `from: 'client'` bubble.
  const visitorHasSpoken = messages.some((m) => m.from === 'client');
  const showInitialOptions = Array.isArray(initialChatOptions)
    && initialChatOptions.length > 0
    && !visitorHasSpoken;

  const handleSelectOption = (option) => {
    const text = option.message || option.label;
    if (text) sendMessage(text);
  };

  // The agent's name is already the header title when we know it, so the line
  // underneath says what the title cannot: whether anyone is there.
  const statusLine = !isReady ? strings.connecting
    : isTyping ? strings.typing
      : strings.online;

  return (
    <div
      className="flex-1 flex flex-col min-h-0"
      style={{ background: palette.bg, position: 'relative' }}
      onDragEnter={isResolved ? undefined : handleDragEnter}
      onDragLeave={isResolved ? undefined : handleDragLeave}
      onDragOver={isResolved ? undefined : handleDragOver}
      onDrop={isResolved ? undefined : handleDrop}
    >
      {isDragOver && !isResolved && <DropOverlay palette={palette} strings={strings} />}
      <input ref={fileInputRef} type="file" onChange={handleFileInput} style={{ display: 'none' }} />

      <div
        className="px-3 py-3 flex items-center gap-2 flex-shrink-0"
        style={{ background: palette.surface, borderBottom: `1px solid ${palette.border}` }}
      >
        {showBack && <IconButton icon={ArrowLeft} onClick={onBack} label={strings.back} palette={palette} />}
        {currentAgent
          ? <Avatar agent={currentAgent} palette={palette} size={34} />
          : <BrandMark palette={palette} title={brandTitle} size={34} />}
        <div className="flex-1 min-w-0" style={{ marginLeft: 2 }}>
          <div className="text-[14px] truncate" style={{ color: palette.text, fontWeight: 600 }}>
            {currentAgent?.name || brandTitle}
          </div>
          <div className="text-[11px] mt-0.5 flex items-center gap-1.5 truncate" style={{ color: palette.textMuted }}>
            <span
              style={{
                width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                background: isReady ? palette.success : palette.textFaint,
              }}
            />
            {statusLine}
          </div>
        </div>
        <IconButton icon={X} onClick={onClose} label={strings.closeChat} palette={palette} />
      </div>

      {isReady ? (
        <>
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 cw-scroll flex flex-col" style={{ background: palette.bg }}>
            <div style={{ marginTop: 'auto' }} />
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                msg={message}
                agent={currentAgent}
                onRetry={retryMessage}
                palette={palette}
                strings={strings}
              />
            ))}
            {showQuickReplies && <ChipRow options={quickReplies} onSelect={selectQuickReply} palette={palette} />}
            {showInitialOptions && !isResolved && (
              <ChipRow options={initialChatOptions} onSelect={handleSelectOption} palette={palette} />
            )}
            {isTyping && <TypingIndicator agent={currentAgent || { type: 'bot' }} palette={palette} />}
            <div ref={messagesEndRef} />
          </div>

          {isResolved ? (
            <ResolvedFooter onReset={conversation.reset} palette={palette} strings={strings} />
          ) : (
            <div style={{ position: 'relative' }}>
              {emojiOpen && (
                <div style={{ position: 'absolute', bottom: '100%', left: 8, right: 8, marginBottom: 8, zIndex: 3 }}>
                  <EmojiPicker
                    onSelect={insertEmoji}
                    onClose={() => setEmojiOpen(false)}
                    colors={{
                      bg: palette.surface,
                      surfaceAlt: palette.surfaceAlt,
                      border: palette.border,
                      borderSubtle: palette.borderSubtle,
                      text: palette.text,
                      textMuted: palette.textMuted,
                      accent: palette.accentInk,
                      hover: palette.surfaceAlt,
                    }}
                  />
                </div>
              )}
              {pending && (
                <AttachmentPreview pending={pending} onCancel={cancelPending} palette={palette} strings={strings} />
              )}
              <div
                className="px-3 py-3 flex items-end gap-1.5 flex-shrink-0"
                style={{ background: palette.surface, borderTop: `1px solid ${palette.border}` }}
              >
                <IconButton
                  icon={Paperclip}
                  onClick={() => fileInputRef.current?.click()}
                  label={strings.attachFile}
                  palette={palette}
                  size={17}
                />
                <div
                  className="flex-1 flex items-center px-3 py-2 gap-1"
                  style={{ background: palette.surfaceAlt, borderRadius: 999, border: `1px solid ${palette.borderSubtle}` }}
                >
                  <input
                    ref={textInputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    onPaste={handlePaste}
                    placeholder={pending ? strings.addCaption : strings.writeMessage}
                    className="flex-1 bg-transparent outline-none text-sm min-w-0"
                    style={{ color: palette.text }}
                  />
                  <button
                    type="button"
                    onClick={() => setEmojiOpen((v) => !v)}
                    className="p-0.5 rounded-full transition-colors flex-shrink-0"
                    style={{ color: emojiOpen ? palette.accentInk : palette.textMuted }}
                    aria-label={strings.emoji}
                    aria-expanded={emojiOpen}
                    title={strings.emoji}
                  >
                    <Smile size={17} />
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
                    boxShadow: canSend ? `0 6px 16px ${palette.accentGlow}` : 'none',
                  }}
                  aria-label={strings.send}
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <NotReadyBody palette={palette} strings={strings} />
      )}
    </div>
  );
};

export default ChatView;
