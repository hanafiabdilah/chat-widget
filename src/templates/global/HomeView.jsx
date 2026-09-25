/*
 * The home screen — what opening the widget shows before anybody has typed.
 *
 * It exists because "open the chat" and "write a message" are two different
 * decisions, and putting a blank composer in front of someone who has not made
 * the second one yet asks them to compose on the spot. Home answers the
 * questions people actually arrive with first — who am I writing to, did I
 * already ask this, is anyone there — and keeps the composer one tap away.
 *
 * There is deliberately no bottom tab bar. Tabs are for a product with several
 * places to be; this widget has two, and the second one is reached by the row
 * that describes it.
 */
import React, { useEffect, useState } from 'react';
import { Send, X } from 'lucide-react';
import { ACCEPT_MESSAGE_ID } from '../../core/adapters/omnichannelAdapter.js';
import { COPYRIGHT } from '../../core/config.js';
import { relativeTime } from '../../i18n/strings.js';
import {
  Avatar, AvatarStack, BrandMark, IconButton, previewText, useHovered,
} from './parts.jsx';

/*
 * How far the cards ride up into the hero. The overlap is what makes the brand
 * colour read as a backdrop rather than as a separate header bar, and it is a
 * negative margin rather than a fixed hero height because the hero has no
 * fixed height: a first-time visitor's home is a greeting and one button, and
 * a 300px block of colour above it would leave the panel mostly empty.
 */
const CARD_OVERLAP = 56;

/*
 * Conversations shown. The archive keeps more (see MAX_REMEMBERED in storage)
 * so that reopening an older one still works after a couple of new ones, but a
 * home screen is a place to recognise the thread you were on — not a search
 * result. Past three, nobody is recognising anything.
 */
const MAX_ROWS = 3;

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

/** One conversation. The row is the affordance — the whole thing is clickable. */
const ConversationRow = ({ palette, strings, row, brandTitle, onOpen, divided }) => {
  const [hovered, bind] = useHovered();
  const { lastMessage, status, unreadCount, agent } = row;
  const isResolved = status === 'resolved';
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen(); }
      }}
      {...bind}
      className="px-4 py-3 flex items-center gap-3"
      style={{
        borderTop: divided ? `1px solid ${palette.borderSubtle}` : undefined,
        background: hovered ? palette.surfaceAlt : 'transparent',
        transition: 'background 120ms ease-out',
        cursor: 'pointer',
        outline: 'none',
      }}
    >
      {agent
        ? <Avatar agent={agent} palette={palette} size={36} />
        : <BrandMark palette={palette} title={brandTitle} size={36} />}
      <div className="flex-1 min-w-0">
        <div className="text-[14px] truncate" style={{ color: palette.text, fontWeight: 600 }}>
          {agent?.name || brandTitle}
        </div>
        <div className="text-[12px] flex items-center gap-1 mt-0.5" style={{ color: palette.textMuted }}>
          <span className="truncate">
            {lastMessage.from === 'client' ? `${strings.you}: ` : ''}
            {previewText(lastMessage, strings)}
          </span>
          {isResolved && (
            <span className="flex-shrink-0" style={{ color: palette.textFaint }}>· {strings.statusResolved}</span>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className="text-[11px]" style={{ color: palette.textFaint }}>
          {relativeTime(lastMessage.sentAt, strings)}
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
  );
};

/** Placeholder for the round trip, shown only when a row is actually coming. */
const RowSkeleton = ({ palette }) => (
  <div className="px-4 py-3 flex items-center gap-3" aria-hidden>
    <div style={{ width: 36, height: 36, borderRadius: '50%', background: palette.surfaceAlt }} />
    <div className="flex-1 min-w-0 flex flex-col gap-1.5">
      <div style={{ height: 10, width: '45%', borderRadius: 5, background: palette.surfaceAlt }} />
      <div style={{ height: 10, width: '75%', borderRadius: 5, background: palette.surfaceAlt }} />
    </div>
  </div>
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
  const { messages, conversationStatus, listConversations } = conversation;
  const isResolved = conversationStatus === 'resolved';

  // `null` while the round trip is in flight — distinct from `[]`, which is a
  // visitor who genuinely has no conversations and must not be shown a
  // skeleton that resolves into nothing.
  const [rows, setRows] = useState(null);

  useEffect(() => {
    let alive = true;
    listConversations().then((result) => { if (alive) setRows(result); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * Whether to hold space for the list while it loads. The dashboard's accept
   * message is written locally before anybody has spoken, so it does not count
   * — without discounting it, a first-time visitor gets a skeleton for a
   * conversation that does not exist, and then an empty space where it was.
   */
  const expectsHistory = messages.some((message) => message.id !== ACCEPT_MESSAGE_ID);
  const loading = rows === null;
  const shown = (rows || []).slice(0, MAX_ROWS);
  const showList = shown.length > 0 || (loading && expectsHistory);

  const title = greeting?.title ?? strings.greetingTitle;
  const subtitle = greeting?.subtitle ?? strings.greetingSubtitle;
  const composeLabel = isResolved ? strings.startNewConversation : strings.sendMessage;

  return (
    <div className="flex-1 flex flex-col min-h-0" style={{ background: palette.bg }}>
      {/*
        A flex column so the two `flex: 1 0 auto` items below can share any
        space the content does not use. On a desktop corner there is none — the
        panel is sized to its content — but full-screen on a phone there is a
        lot of it, and dropping all of it below the last card leaves the bottom
        half of the screen an unexplained void.
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
          {showList && (
            <Card palette={palette}>
              <div className="px-4 pt-3 pb-1 text-[12px]" style={{ color: palette.textMuted, fontWeight: 600 }}>
                {shown.length > 1 ? strings.recentMessages : strings.recentMessage}
              </div>
              {loading
                ? <RowSkeleton palette={palette} />
                : shown.map((row, index) => (
                  <ConversationRow
                    key={row.token}
                    palette={palette}
                    strings={strings}
                    row={row}
                    brandTitle={brandTitle}
                    divided={index > 0}
                    onOpen={() => onOpenChat(row.token)}
                  />
                ))}
            </Card>
          )}

          <ComposeCard
            palette={palette}
            strings={strings}
            label={composeLabel}
            // Only for a visitor with nothing above it. With a list on screen
            // the panel already has something to read, and the line would be
            // filling space that is no longer empty.
            hint={showList ? null : strings.sendMessageHint}
            onOpen={() => onOpenChat()}
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
