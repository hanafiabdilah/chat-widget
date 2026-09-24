/*
 * The home screen — what opening the widget shows before anybody has typed.
 *
 * It exists because "open the chat" and "write a message" are two different
 * decisions, and putting a blank composer in front of someone who has not made
 * the second one yet asks them to compose on the spot. Home answers the
 * questions people actually arrive with first — who am I writing to, did I
 * already ask this, is anyone there — and keeps the composer one tap away.
 *
 * There is deliberately no bottom tab bar. Tabs are for a product with
 * several places to be; this widget has two, and the second one is reached by
 * the card that describes it.
 */
import React from 'react';
import { Send, X } from 'lucide-react';
import { ACCEPT_MESSAGE_ID } from '../../core/adapters/omnichannelAdapter.js';
import { COPYRIGHT } from '../../core/config.js';
import { relativeTime } from '../../i18n/strings.js';
import {
  Avatar, AvatarStack, BrandMark, IconButton, previewText, useHovered,
} from './parts.jsx';

/*
 * How far the cards ride up into the hero. The overlap is what makes the
 * brand colour read as a backdrop rather than as a separate header bar, and it
 * is a negative margin rather than a fixed hero height because the hero has no
 * fixed height: a first-time visitor's home is a greeting and one button, and
 * a 300px block of colour above it would leave the panel mostly empty.
 */
const CARD_OVERLAP = 56;

const Card = ({ palette, children, onClick, label }) => {
  const [hovered, bind] = useHovered();
  const interactive = typeof onClick === 'function';
  return (
    <div
      {...(interactive ? { role: 'button', tabIndex: 0, onClick, 'aria-label': label } : {})}
      {...(interactive ? bind : {})}
      onKeyDown={interactive ? (event) => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onClick(); }
      } : undefined}
      style={{
        background: palette.surface,
        border: `1px solid ${palette.border}`,
        borderRadius: 14,
        // The shadow is what lifts the card off the gradient it overlaps; the
        // panel's own shadow stops at the panel edge.
        boxShadow: hovered
          ? `0 8px 24px ${palette.scheme === 'dark' ? 'rgba(0,0,0,0.5)' : 'rgba(16,24,40,0.12)'}`
          : `0 2px 10px ${palette.scheme === 'dark' ? 'rgba(0,0,0,0.35)' : 'rgba(16,24,40,0.06)'}`,
        transform: hovered && interactive ? 'translateY(-1px)' : 'none',
        transition: 'transform 140ms ease-out, box-shadow 140ms ease-out',
        cursor: interactive ? 'pointer' : 'default',
        outline: 'none',
      }}
    >
      {children}
    </div>
  );
};

const RecentConversationCard = ({ palette, strings, message, agent, title, unreadCount, isResolved, onOpen }) => (
  <Card palette={palette} onClick={onOpen} label={strings.recentMessage}>
    <div className="px-4 pt-3 pb-1 text-[12px]" style={{ color: palette.textMuted, fontWeight: 600 }}>
      {strings.recentMessage}
    </div>
    <div className="px-4 pb-3 pt-1 flex items-center gap-3">
      <Avatar agent={agent} palette={palette} size={36} />
      <div className="flex-1 min-w-0">
        <div className="text-[14px] truncate" style={{ color: palette.text, fontWeight: 600 }}>
          {agent?.name || title}
        </div>
        <div className="text-[12px] flex items-center gap-1 mt-0.5" style={{ color: palette.textMuted }}>
          <span className="truncate">
            {message?.from === 'client' ? `${strings.you}: ` : ''}
            {previewText(message, strings)}
          </span>
          {isResolved && (
            <span className="flex-shrink-0" style={{ color: palette.textFaint }}>· {strings.statusResolved}</span>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className="text-[11px]" style={{ color: palette.textFaint }}>
          {relativeTime(message?.sentAt, strings)}
        </span>
        {unreadCount > 0 && (
          <span
            className="flex items-center justify-center text-[10px]"
            style={{
              minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9,
              background: palette.accent, color: palette.accentText, fontWeight: 600,
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </div>
    </div>
  </Card>
);

const ComposeCard = ({ palette, strings, label, hint, onOpen }) => (
  <Card palette={palette} onClick={onOpen} label={label}>
    <div className="px-4 py-3.5 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="text-[14px]" style={{ color: palette.text, fontWeight: 600 }}>{label}</div>
        {hint && <div className="text-[12px] mt-0.5 truncate" style={{ color: palette.textMuted }}>{hint}</div>}
      </div>
      <Send size={18} strokeWidth={2} style={{ color: palette.accentInk, flexShrink: 0 }} />
    </div>
  </Card>
);

export const HomeView = ({
  palette,
  strings,
  conversation,
  brandTitle,
  logoUrl,
  team,
  greeting,
  onClose,
  onOpenChat,
}) => {
  const { messages, unreadCount, conversationStatus } = conversation;
  const isResolved = conversationStatus === 'resolved';
  /*
   * The dashboard's accept message is written locally, before anyone has said
   * anything, so it does not count as a conversation to come back to: showing
   * it here would greet a first-time visitor with a "recent message" card
   * containing a greeting they are reading for the first time, two lines below
   * the greeting they are also reading for the first time.
   *
   * Everything else counts, including a reply that arrived while the panel was
   * shut — that is exactly what this card exists to surface.
   */
  const history = messages.filter((message) => message.id !== ACCEPT_MESSAGE_ID);
  const lastMessage = history.length ? history[history.length - 1] : null;
  const hasHistory = !!lastMessage;

  const title = greeting?.title ?? strings.greetingTitle;
  const subtitle = greeting?.subtitle ?? strings.greetingSubtitle;
  const composeLabel = isResolved ? strings.startNewConversation : strings.sendMessage;

  return (
    <div className="flex-1 flex flex-col min-h-0" style={{ background: palette.bg }}>
      {/*
        A flex column so the two `flex: 1 0 auto` items below can share any
        space the content does not use. On a desktop corner there is none —
        the panel is sized to its content — but full-screen on a phone there
        is a lot of it, and dropping all of it below the last card leaves the
        bottom half of the screen an unexplained void.
      */}
      <div className="flex-1 min-h-0 overflow-y-auto cw-scroll flex flex-col">
        <div
          className="flex flex-col"
          style={{ background: palette.heroGradient, paddingBottom: CARD_OVERLAP + 8, flex: '1 0 auto' }}
        >
          <div className="px-5 pt-4 flex items-start justify-between gap-3">
            <BrandMark palette={palette} logoUrl={logoUrl} title={brandTitle} size={40} onHero />
            <div className="flex items-center gap-1.5">
              <AvatarStack people={team} palette={palette} size={34} />
              <IconButton icon={X} onClick={onClose} label={strings.closeChat} palette={palette} onHero />
            </div>
          </div>

          {/* Anchored to the bottom of the hero, so a hero that grew keeps the
              greeting next to the cards it introduces. */}
          <div className="px-5 pt-12" style={{ marginTop: 'auto' }}>
            <div style={{ color: palette.heroTextMuted, fontSize: 26, lineHeight: 1.25, fontWeight: 500 }}>
              {title}
            </div>
            <div style={{ color: palette.heroText, fontSize: 26, lineHeight: 1.25, fontWeight: 700, letterSpacing: '-0.01em' }}>
              {subtitle}
            </div>
          </div>
        </div>

        <div
          className="px-4 pb-5 flex flex-col gap-3"
          style={{ marginTop: -CARD_OVERLAP, flexShrink: 0 }}
        >
          {hasHistory && (
            <RecentConversationCard
              palette={palette}
              strings={strings}
              message={lastMessage}
              agent={conversation.currentAgent}
              title={brandTitle}
              unreadCount={unreadCount}
              isResolved={isResolved}
              onOpen={onOpenChat}
            />
          )}
          <ComposeCard
            palette={palette}
            strings={strings}
            label={composeLabel}
            // Only for a first-time visitor. With a recent card above it the
            // screen already has something to read, and the line would be
            // filling space that is no longer empty.
            hint={hasHistory ? null : strings.sendMessageHint}
            onOpen={onOpenChat}
          />
        </div>

        <div aria-hidden style={{ flex: '1 0 auto' }} />
      </div>

      <div
        className="flex items-center justify-center py-2 flex-shrink-0"
        style={{ background: palette.surface, borderTop: `1px solid ${palette.borderSubtle}` }}
      >
        <span className="text-[10px]" style={{ color: palette.textFaint }}>{COPYRIGHT}</span>
      </div>
    </div>
  );
};

export default HomeView;
