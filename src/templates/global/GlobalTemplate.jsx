/*
 * The brand-neutral template: a launcher, a panel, and two views inside it.
 *
 * It owns three things and delegates the rest:
 *
 *   1. Which view is showing. Home is where the panel opens, except when an
 *      agent has replied — a visitor tapping a badge is asking to read the
 *      reply, not to be introduced to the product again.
 *   2. The keyframes, injected once. They are referenced by name from inline
 *      styles in the parts, which cannot declare an animation of their own.
 *   3. The palette handed down. Nothing below this file decides a colour.
 *
 * Every colour comes from `theme/palette.js`, which derives the whole set from
 * the workspace's accent and the host page's colour scheme — see ChatWidget.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, MessageCircle } from 'lucide-react';
import { buildPalette } from '../../theme/palette.js';
import { resolveStrings } from '../../i18n/strings.js';
import { initialsOf, useHovered } from './parts.jsx';
import { HomeView } from './HomeView.jsx';
import { ChatView } from './ChatView.jsx';

const PANEL_WIDTH = 400;
// The chat needs a fixed, generous height — a thread that resized itself as
// messages arrived would move the composer while somebody was reaching for it.
const PANEL_HEIGHT = 640;
// Home has no such problem and a real reason not to: its content is a greeting
// and at most two cards, and stretching that to 640px leaves half the panel
// empty with nothing to explain the emptiness. It shrinks to fit. (Both are
// overridden on phones, where the panel is full-screen — see styles.css.)

const KEYFRAMES = `
@keyframes cw-typing { 0%, 60%, 100% { opacity: 0.3; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-3px); } }
@keyframes cw-slide-up { from { opacity: 0; transform: translateY(16px) scale(0.985); } to { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes cw-view-forward { from { opacity: 0; transform: translateX(14px); } to { opacity: 1; transform: translateX(0); } }
@keyframes cw-view-back { from { opacity: 0; transform: translateX(-14px); } to { opacity: 1; transform: translateX(0); } }
`;

/**
 * Host-supplied team members arrive in whatever shape the host had lying
 * around. Normalising here means `AvatarStack` only ever sees one shape, and
 * an entry with nothing usable in it is dropped rather than drawn as a blank
 * circle.
 */
const normalizeTeam = (people, fallbackAgent) => {
  const list = (Array.isArray(people) ? people : [])
    .map((person, index) => {
      if (!person) return null;
      if (typeof person === 'string') return { id: `t${index}`, name: person, initials: initialsOf(person), type: 'human' };
      const name = person.name || person.title || '';
      const avatarUrl = person.avatarUrl || person.avatar || person.image || null;
      if (!name && !avatarUrl) return null;
      return {
        id: person.id || `t${index}`,
        name,
        avatarUrl,
        avatarColor: person.color || person.avatarColor || null,
        initials: person.initials || initialsOf(name),
        type: person.type || 'human',
      };
    })
    .filter(Boolean);
  if (list.length) return list;
  return fallbackAgent ? [fallbackAgent] : [];
};

const Launcher = ({ palette, strings, isOpen, unreadCount, onToggle }) => {
  const [hovered, bind] = useHovered();
  const Icon = isOpen ? ChevronDown : MessageCircle;
  return (
    <button
      type="button"
      onClick={onToggle}
      {...bind}
      data-open={isOpen ? 'true' : 'false'}
      className="cw-root cw-launcher fixed z-[45] flex items-center justify-center"
      style={{
        bottom: 24,
        right: 24,
        width: 56,
        height: 56,
        borderRadius: '50%',
        background: palette.accent,
        color: palette.accentText,
        // The hairline is the brand's own label colour at low opacity. It is
        // what keeps a black launcher from dissolving into a black page
        // without repainting somebody's brand for them.
        boxShadow: `0 0 0 1px ${palette.accentEdge}, 0 10px 28px ${palette.accentGlow}, ${palette.launcherShadow}`,
        transform: hovered ? 'translateY(-2px) scale(1.04)' : 'none',
        transition: 'transform 160ms ease-out, box-shadow 160ms ease-out',
        colorScheme: palette.scheme,
      }}
      aria-label={isOpen ? strings.closeChat : strings.openChat}
      aria-expanded={isOpen}
    >
      <Icon size={22} strokeWidth={2} style={{ transition: 'transform 160ms ease-out' }} />
      {unreadCount > 0 && (
        <span
          className="absolute flex items-center justify-center text-[11px]"
          style={{
            top: -2,
            right: -2,
            minWidth: 20,
            height: 20,
            borderRadius: 10,
            padding: '0 6px',
            background: palette.danger,
            color: '#ffffff',
            fontWeight: 600,
            // Against the page, not against the panel: the badge sits on
            // whatever the site's background happens to be.
            border: `2px solid ${palette.bg}`,
          }}
          aria-label={`${unreadCount} ${strings.unreadMessages}`}
        >
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  );
};

export const GlobalTemplate = ({
  isOpen,
  onOpen,
  onClose,
  conversation,
  initialChatOptions,
  // Supplied by ChatWidget, which owns the accent + colour-scheme resolution.
  // Defaulted here as well so the template still renders if it is mounted
  // directly (tests, Storybook, a host that imports it on its own).
  palette: paletteProp,
  strings: stringsProp,
  locale,
  home = true,
  greeting,
  agents,
  logoUrl,
}) => {
  const palette = useMemo(
    () => paletteProp || buildPalette({ accent: conversation.config?.brand?.accentColor }),
    [paletteProp, conversation.config],
  );
  const strings = useMemo(
    () => stringsProp || resolveStrings(locale),
    [stringsProp, locale],
  );

  const [view, setView] = useState(home ? 'home' : 'chat');
  // Which way the incoming view should slide. Home → chat reads as going
  // deeper, chat → home as coming back; the same animation for both would
  // make the back arrow feel like it opened something new.
  const [direction, setDirection] = useState('forward');

  const wasOpen = useRef(isOpen);
  useEffect(() => {
    const justOpened = isOpen && !wasOpen.current;
    wasOpen.current = isOpen;
    if (!justOpened || !home) return;
    // An unread reply is the reason this was opened. Anything else leaves the
    // view where the visitor left it, so closing the panel mid-sentence and
    // reopening does not throw the draft away behind a home screen.
    if (conversation.unreadCount > 0) {
      setDirection('forward');
      setView('chat');
    }
  }, [isOpen, home, conversation.unreadCount]);

  const brandTitle = conversation.config?.brand?.title || 'Suporte';
  const team = useMemo(
    () => normalizeTeam(agents, conversation.currentAgent),
    [agents, conversation.currentAgent],
  );

  const openChat = (token) => {
    if (token) {
      // Picked from the list. Switching threads is the adapter's job and the
      // view does not wait for it: the history lands in a thread that is
      // already on screen, which is what every other message does too.
      conversation.openConversation(token);
    } else if (conversation.conversationStatus === 'resolved') {
      // "Start a new conversation" from the compose card. The thread it would
      // otherwise continue is closed, so the card that says so has to
      // actually produce a fresh one.
      conversation.reset();
    }
    setDirection('forward');
    setView('chat');
  };
  const backToHome = () => {
    setDirection('back');
    setView('home');
  };

  const ready = conversation.status === 'ready';
  const launcherUnread = ready && !isOpen ? conversation.unreadCount : 0;
  const showHome = home && view === 'home';

  return (
    <>
      <style>{KEYFRAMES}</style>
      <Launcher
        palette={palette}
        strings={strings}
        isOpen={isOpen}
        unreadCount={launcherUnread}
        onToggle={isOpen ? onClose : onOpen}
      />
      {isOpen && (
        <div
          className="cw-root cw-panel fixed z-[60] flex flex-col overflow-hidden"
          style={{
            bottom: 92,
            right: 24,
            width: PANEL_WIDTH,
            height: showHome ? 'auto' : PANEL_HEIGHT,
            background: palette.bg,
            border: `1px solid ${palette.border}`,
            borderRadius: 16,
            boxShadow: palette.shadow,
            animation: 'cw-slide-up 0.22s ease-out',
            // Inherited by everything inside, which is what makes the
            // scrollbars and native controls match the panel instead of the
            // page the widget was dropped onto.
            colorScheme: palette.scheme,
          }}
          role="dialog"
          aria-modal="false"
          aria-label={brandTitle}
        >
          <div
            key={view}
            className="flex-1 flex flex-col min-h-0"
            style={{ animation: `cw-view-${direction} 0.2s ease-out` }}
          >
            {showHome ? (
              <HomeView
                palette={palette}
                strings={strings}
                conversation={conversation}
                brandTitle={brandTitle}
                logoUrl={logoUrl}
                team={team}
                greeting={greeting}
                onClose={onClose}
                onOpenChat={openChat}
              />
            ) : (
              <ChatView
                palette={palette}
                strings={strings}
                conversation={conversation}
                initialChatOptions={initialChatOptions}
                brandTitle={brandTitle}
                onClose={onClose}
                onBack={backToHome}
                showBack={home}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default GlobalTemplate;
