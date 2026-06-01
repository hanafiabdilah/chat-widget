// Maps the backend MessageResource (API.md §4.3) into the local Message
// shape consumed by `useConversation` / templates. We keep the original
// resource available under `_raw` in case a host needs to render fields the
// generic shape doesn't expose (replied_message, attachment_url, etc.).
//
// MessageResource fields we care about:
//   id              number  Stable server id — used for upsert/dedupe.
//   sender_type     "incoming" | "outgoing"
//   message_type    "text" | "image" | "audio" | "video" | "document"
//   body            string  Text content (may be empty for media-only).
//   attachment_url  string|null  Signed URL — may expire.
//   sent_at         number  Unix seconds.
//   read_at         number|null  When agent saw it (for outgoing visitor msgs).
//   edited_at       number|null
//   unsend_at       number|null  Delete tombstone.
//   sender.source   "human" | "ai_flow" | "static_flow" | "external"
//   sender.user     { id, name } when source = "human".

const padTwo = (n) => String(n).padStart(2, '0');

const formatTime = (unixSeconds, locale) => {
  if (!unixSeconds) return '';
  const date = new Date(unixSeconds * 1000);
  if (Number.isNaN(date.getTime())) return '';
  if (locale) {
    try {
      return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    } catch (_e) { /* fall through */ }
  }
  return `${padTwo(date.getHours())}:${padTwo(date.getMinutes())}`;
};

// Build an Agent object from the MessageResource `sender` block. Returns
// null for incoming visitor messages (no agent attached).
export const agentFromResource = (resource) => {
  if (!resource || resource.sender_type !== 'outgoing') return null;
  const sender = resource.sender || {};
  if (sender.source === 'human' && sender.user) {
    const name = sender.user.name || 'Atendente';
    const parts = String(name).trim().split(/\s+/);
    const initials = (parts[0]?.[0] || '') + (parts[1]?.[0] || '');
    return {
      type: 'human',
      name,
      role: 'Suporte',
      initials: initials.toUpperCase() || name.slice(0, 2).toUpperCase(),
    };
  }
  // ai_flow / static_flow / external — treat as bot.
  return { type: 'bot', name: 'Atendente Virtual' };
};

export const mapMessage = (resource, { locale } = {}) => {
  if (!resource) return null;
  const isIncoming = resource.sender_type === 'incoming';
  let from = 'client';
  if (!isIncoming) {
    from = resource.sender?.source === 'human' ? 'human' : 'bot';
  }

  // Caption is `body`; we DON'T fabricate `[image]` text anymore because
  // the bubble renders the attachment inline via AttachmentRenderer, and
  // a bracketed placeholder would just be visual noise next to it.
  const text = resource.body || '';

  return {
    id: resource.id,
    from,
    text,
    time: formatTime(resource.sent_at || resource.created_at, locale),
    seen: !isIncoming ? undefined : !!resource.read_at,
    editedAt: resource.edited_at || null,
    unsendAt: resource.unsend_at || null,
    // Type tag the template uses to pick a renderer (text / image / audio /
    // video / document). Backend is the only source of truth — visitors
    // can't spoof message_type.
    messageType: resource.message_type || 'text',
    attachmentUrl: resource.attachment_url || null,
    // `meta` for attachments contains `{ filename, mime_type, size }` per
    // API.md §4.6 response. Useful for document download UI.
    attachmentMeta: resource.meta || null,
    agent: agentFromResource(resource),
    _raw: resource,
  };
};

export default mapMessage;
