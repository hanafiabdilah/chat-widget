/*
 * The pieces both views are built from.
 *
 * Every one of them takes `palette` and, where it speaks, `strings`. Nothing
 * here holds a colour of its own: the accent is not known until the config
 * request answers and the scheme is not known until the host page has been
 * inspected, so a hard-coded hex anywhere in this file would be a colour that
 * cannot follow either.
 */
import React, { useState } from 'react';
import {
  AlertCircle, Clock, FileText, Loader2, Sparkles, Upload, X,
} from 'lucide-react';

export const formatSize = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** Hover state without a stylesheet — inline styles cannot express `:hover`. */
export const useHovered = () => {
  const [hovered, setHovered] = useState(false);
  return [hovered, {
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
    onBlur: () => setHovered(false),
  }];
};

/** What a message looks like in one line, for the home screen's recent card. */
export const previewText = (message, strings) => {
  if (!message) return '';
  if (message.text && message.text.trim()) return message.text.trim();
  switch (message.messageType) {
    case 'image': return strings.photo;
    case 'video': return strings.video;
    case 'audio': return strings.audio;
    case 'document': return strings.file;
    default: return '';
  }
};

export const initialsOf = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return ((parts[0][0] || '') + (parts[1]?.[0] || '')).toUpperCase();
};

/* ------------------------------------------------------------------ *
 * Identity
 * ------------------------------------------------------------------ */

/**
 * The workspace's square in the top-left of the home hero. A logo when the
 * host supplied one, the brand's initial otherwise — never an empty box,
 * because the hero's whole job is to say who the visitor is writing to.
 */
export const BrandMark = ({ palette, logoUrl, title, size = 40, onHero = false }) => {
  const ink = onHero ? palette.heroTopText : palette.text;
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={title || ''}
        style={{ width: size, height: size, borderRadius: size * 0.3, objectFit: 'cover', display: 'block' }}
      />
    );
  }
  return (
    <div
      className="flex items-center justify-center flex-shrink-0"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        background: onHero ? palette.heroSurface : palette.surfaceAlt,
        color: ink,
        fontSize: size * 0.4,
        fontWeight: 700,
        letterSpacing: '-0.02em',
      }}
      aria-hidden
    >
      {initialsOf(title).slice(0, 1) || '?'}
    </div>
  );
};

export const Avatar = ({ agent, palette, size = 32, ring, onHero = false }) => {
  if (!agent) return null;
  const isBot = agent.type === 'bot';
  const tint = agent.avatarColor || palette.accent;
  const border = ring ? `2px solid ${ring}` : undefined;

  if (agent.avatarUrl) {
    return (
      <img
        src={agent.avatarUrl}
        alt={agent.name || ''}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', display: 'block', border, boxSizing: 'content-box' }}
      />
    );
  }
  return (
    <div
      className="flex items-center justify-center flex-shrink-0"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: onHero
          ? palette.heroAvatar
          : (palette.scheme === 'dark' ? palette.surfaceAlt : palette.accentSoft),
        color: onHero ? palette.heroTopText : (isBot ? palette.accentInk : tint),
        fontSize: size * 0.38,
        fontWeight: 600,
        border,
        boxSizing: 'content-box',
      }}
      title={agent.name || undefined}
    >
      {isBot ? <Sparkles size={size * 0.46} strokeWidth={2} /> : (agent.initials || initialsOf(agent.name))}
    </div>
  );
};

/**
 * Overlapping faces in the hero. It is the one element on the home screen
 * that says a person is behind this, so it renders whoever we actually know
 * about and nothing at all when we know nobody — a row of grey placeholders
 * would be a promise the widget cannot keep.
 */
export const AvatarStack = ({ people, palette, size = 34, max = 3 }) => {
  const shown = (people || []).filter(Boolean).slice(0, max);
  if (!shown.length) return null;
  return (
    <div className="flex items-center" style={{ paddingLeft: (size * 0.34) * (shown.length - 1) }}>
      {shown.map((person, index) => (
        <div
          key={person.id || person.name || index}
          style={{ marginLeft: index === 0 ? 0 : -(size * 0.34), zIndex: index + 1, position: 'relative' }}
        >
          <Avatar agent={person} palette={palette} size={size} ring={palette.heroTop} onHero />
        </div>
      ))}
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * Controls
 * ------------------------------------------------------------------ */

export const IconButton = ({ icon: Icon, onClick, label, palette, onHero = false, size = 18 }) => {
  const [hovered, bind] = useHovered();
  const ink = onHero ? palette.heroTopText : palette.textMuted;
  return (
    <button
      type="button"
      onClick={onClick}
      {...bind}
      className="flex items-center justify-center rounded-full transition-colors"
      style={{
        width: 32,
        height: 32,
        color: onHero ? ink : (hovered ? palette.text : ink),
        background: hovered ? (onHero ? palette.heroSurface : palette.surfaceAlt) : 'transparent',
        opacity: onHero && !hovered ? 0.82 : 1,
      }}
      aria-label={label}
      title={label}
    >
      <Icon size={size} strokeWidth={2} />
    </button>
  );
};

/* ------------------------------------------------------------------ *
 * Message rendering
 * ------------------------------------------------------------------ */

export const AttachmentBlock = ({ url, messageType, meta, isClient, palette }) => {
  if (!url) return null;
  if (messageType === 'image') {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block" style={{ marginBottom: 4 }}>
        <img src={url} alt={meta?.filename || ''} style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 12, display: 'block' }} />
      </a>
    );
  }
  if (messageType === 'video') {
    return <video controls src={url} style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 12, display: 'block', marginBottom: 4 }} />;
  }
  if (messageType === 'audio') {
    return <audio controls src={url} style={{ width: '100%', display: 'block', marginBottom: 4 }} />;
  }

  const fg = isClient ? palette.bubbleOutText : palette.text;
  const fgMuted = isClient ? `${palette.bubbleOutText}99` : palette.textFaint;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      download={meta?.filename || undefined}
      className="flex items-center gap-2.5 rounded-lg"
      style={{
        padding: 8,
        // Darkening the bubble works on any accent; a fixed neutral would
        // vanish on half of them.
        background: isClient ? 'rgba(0,0,0,0.12)' : palette.bg,
        border: `1px solid ${isClient ? 'rgba(0,0,0,0.16)' : palette.border}`,
        marginBottom: 4,
        textDecoration: 'none',
        color: fg,
      }}
    >
      <div
        className="flex items-center justify-center flex-shrink-0"
        style={{ width: 32, height: 32, borderRadius: 8, background: isClient ? 'rgba(0,0,0,0.14)' : palette.surfaceAlt }}
      >
        <FileText size={16} />
      </div>
      <div className="flex flex-col min-w-0">
        <div className="text-[12px] truncate" style={{ color: fg, maxWidth: 200 }}>{meta?.filename || 'file'}</div>
        {meta?.size != null && <div className="text-[10px]" style={{ color: fgMuted }}>{formatSize(meta.size)}</div>}
      </div>
    </a>
  );
};

export const MessageBubble = ({ msg, agent, onRetry, palette, strings }) => {
  const isClient = msg.from === 'client';
  const hasAttachment = !!msg.attachmentUrl && msg.messageType && msg.messageType !== 'text';
  const hasCaption = msg.text && msg.text.trim().length > 0;
  // Pending is faded rather than labelled: in the normal case it is over
  // before a label finishes being read.
  const isPending = isClient && msg.deliveryStatus === 'pending';
  const hasFailed = isClient && msg.deliveryStatus === 'failed';
  const bubbleAgent = msg.agent || agent;

  return (
    <div className={`flex gap-2 ${isClient ? 'flex-row-reverse' : 'flex-row'}`} style={{ marginBottom: 12 }}>
      {!isClient && <Avatar agent={bubbleAgent} palette={palette} size={28} />}
      <div className={`flex flex-col ${isClient ? 'items-end' : 'items-start'}`} style={{ maxWidth: '78%' }}>
        {!isClient && bubbleAgent && (
          <div className="text-[11px] mb-1 px-0.5" style={{ color: palette.textFaint }}>{bubbleAgent.name}</div>
        )}
        <div
          style={{
            // Tight padding for media-only bubbles; chat-bubble feel for text
            // or captioned media.
            padding: hasAttachment && !hasCaption ? 4 : '7px 12px',
            background: isClient ? palette.bubbleOut : palette.bubbleIn,
            color: isClient ? palette.bubbleOutText : palette.bubbleInText,
            borderRadius: 16,
            borderBottomRightRadius: isClient ? 5 : 16,
            borderBottomLeftRadius: isClient ? 16 : 5,
            fontSize: 14,
            lineHeight: 1.45,
            opacity: isPending ? 0.62 : 1,
            transition: 'opacity 120ms ease-out',
            wordBreak: 'break-word',
          }}
        >
          {hasAttachment && (
            <AttachmentBlock
              url={msg.attachmentUrl}
              messageType={msg.messageType}
              meta={msg.attachmentMeta}
              isClient={isClient}
              palette={palette}
            />
          )}
          {hasCaption && <div className="whitespace-pre-wrap">{msg.text}</div>}
        </div>
        {hasFailed ? (
          <button
            type="button"
            onClick={() => onRetry?.(msg.id)}
            className="text-[10px] mt-1 px-1 flex items-center gap-1 hover:underline"
            style={{ color: palette.danger }}
          >
            <AlertCircle size={11} />
            {strings.notSent}
          </button>
        ) : (
          <div className="text-[10px] mt-1 px-1 flex items-center gap-1" style={{ color: palette.textFaint }}>
            {msg.time}
            {isPending && <Clock size={11} />}
          </div>
        )}
      </div>
    </div>
  );
};

export const TypingDots = ({ palette, size = 6 }) => (
  <>
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: palette.textMuted,
          animation: `cw-typing 1.4s ease-in-out ${i * 0.2}s infinite`,
        }}
      />
    ))}
  </>
);

export const TypingIndicator = ({ agent, palette }) => (
  <div className="flex gap-2 items-end" style={{ marginBottom: 12 }}>
    <Avatar agent={agent} palette={palette} size={28} />
    <div
      className="px-3 py-2.5 flex items-center gap-1"
      style={{ background: palette.bubbleIn, borderRadius: 16, borderBottomLeftRadius: 5 }}
    >
      <TypingDots palette={palette} />
    </div>
  </div>
);

/* ------------------------------------------------------------------ *
 * Composer accessories
 * ------------------------------------------------------------------ */

export const AttachmentPreview = ({ pending, onCancel, palette, strings }) => {
  const { file, localUrl, status } = pending;
  const guessedType = pending.uploaded?.message_type || (
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
        borderTop: `1px solid ${palette.borderSubtle}`,
        borderBottom: `1px solid ${palette.borderSubtle}`,
      }}
    >
      {guessedType === 'image' ? (
        <img src={localUrl} alt={file.name} style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
      ) : (
        <div
          className="flex items-center justify-center flex-shrink-0"
          style={{ width: 44, height: 44, borderRadius: 8, background: palette.bg, border: `1px solid ${palette.border}`, color: palette.textMuted }}
        >
          <FileText size={18} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-xs truncate" style={{ color: palette.text }}>{file.name}</div>
        <div className="text-[10px] flex items-center gap-1.5" style={{ color: palette.textFaint }}>
          {status === 'uploading' && (<><Loader2 size={10} className="animate-spin" /> {strings.uploading}</>)}
          {status === 'ready' && <span>{formatSize(file.size)} · {strings.attachmentReady}</span>}
          {status === 'failed' && <span style={{ color: palette.danger }}>{strings.uploadFailed}</span>}
        </div>
      </div>
      <IconButton icon={X} onClick={onCancel} label={strings.cancelAttachment} palette={palette} size={14} />
    </div>
  );
};

export const DropOverlay = ({ palette, strings }) => (
  <div
    className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
    style={{
      zIndex: 4,
      background: palette.overlay,
      border: `2px dashed ${palette.accentInk}`,
      borderRadius: 16,
      color: palette.accentInk,
    }}
  >
    <Upload size={32} />
    <div className="text-xs mt-2" style={{ fontWeight: 600 }}>{strings.dropFile}</div>
  </div>
);

/**
 * Quick replies (server-driven) and initial chat options (host-driven) are the
 * same object on screen; only where the list comes from differs.
 */
export const ChipRow = ({ options, onSelect, palette }) => (
  <div className="flex flex-wrap gap-2 mb-3" style={{ paddingLeft: 36 }}>
    {options.map((option) => (
      <Chip key={option.id ?? option.label} option={option} onSelect={onSelect} palette={palette} />
    ))}
  </div>
);

const Chip = ({ option, onSelect, palette }) => {
  const [hovered, bind] = useHovered();
  const color = option.color || palette.accentInk;
  return (
    <button
      type="button"
      onClick={() => onSelect(option)}
      {...bind}
      className="px-3 py-1.5 text-xs transition-colors"
      style={{
        background: hovered ? color : palette.bg,
        color: hovered ? palette.accentText : color,
        border: `1px solid ${color}`,
        borderRadius: 999,
        fontWeight: 500,
      }}
    >
      {option.label}
    </button>
  );
};

/**
 * Shown until the adapter reports `ready` — which covers normal loading and
 * the 422 invalid-app_id case alike. Deliberately neutral: a misconfigured
 * embed should read as "still warming up", not as a broken site.
 */
export const NotReadyBody = ({ palette, strings }) => (
  <div className="flex-1 flex flex-col items-center justify-center px-6" style={{ background: palette.bg }}>
    <div className="flex items-center gap-1.5 mb-3" aria-hidden>
      <TypingDots palette={palette} size={8} />
    </div>
    <div className="text-xs" style={{ color: palette.textFaint }}>{strings.settingUp}</div>
  </div>
);
