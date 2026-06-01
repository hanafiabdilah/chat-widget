import React, { useEffect, useRef, useState } from 'react';

// Tiny self-contained emoji picker. Inlined the most-used emojis instead
// of pulling `emoji-picker-react` / `emoji-mart` (each adds ~30–50KB
// gzipped) — the widget is meant to ship as a small embed, so a curated
// set is the right trade-off. Add more emojis to a category as needed,
// or split into more categories.
const CATEGORIES = [
  {
    id: 'smileys',
    icon: '😀',
    label: 'Smileys',
    emojis: [
      '😀','😃','😄','😁','😆','😅','😂','🤣','🥲','🙂','🙃','😉','😊','😇',
      '🥰','😍','🤩','😘','😗','😚','😙','😋','😛','😜','🤪','😝','🤑','🤗',
      '🤭','🫢','🫣','🤫','🤔','🫡','🤐','🤨','😐','😑','😶','🫠','😏','😒',
      '🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤧','🥵','🥶',
      '🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','🫤','😟','🙁','☹️',
      '😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖',
      '😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','💩',
    ],
  },
  {
    id: 'gestures',
    icon: '👍',
    label: 'Gestures',
    emojis: [
      '👍','👎','👌','🤌','🤏','✌️','🤞','🫰','🤟','🤘','🤙','🫵','🫱','🫲',
      '🫳','🫴','👈','👉','👆','🖕','👇','☝️','✋','🤚','🖐️','🖖','👋','🤝',
      '🙏','🤲','👐','🙌','👏','🫶','💪','🦾','🦿','✊','👊','🤛','🤜',
    ],
  },
  {
    id: 'hearts',
    icon: '❤️',
    label: 'Hearts',
    emojis: [
      '❤️','🩷','🧡','💛','💚','💙','🩵','💜','🖤','🩶','🤍','🤎','💔','❤️‍🔥',
      '❤️‍🩹','❣️','💕','💞','💓','💗','💖','💘','💝','💟','♥️','💯','💢','💥',
      '💫','💦','💨','🕳️','🗨️','🗯️','💭','💤','🔥','✨','🌟','⭐','🌈',
    ],
  },
  {
    id: 'objects',
    icon: '🎉',
    label: 'Objects',
    emojis: [
      '🎉','🎊','🎈','🎁','🎀','🪅','🎗️','🏆','🥇','🥈','🥉','🏅','⚽','🏀',
      '🏈','⚾','🎾','🏐','🎱','🏓','🏸','🥅','🥊','🎯','🎮','🕹️','🎲','♟️',
      '🎨','🎭','🎤','🎧','🎼','🎵','🎶','📱','💻','⌨️','🖥️','🖨️','⌚','📷',
      '📹','📺','📻','🔔','🔕','📣','📢','🔑','🔐','💡','🔦','🕯️','💰','💳',
      '💎','⚙️','🔧','🔨','🛠️','📦','📫','📚','📖','📝','✏️','✒️','📅','📌',
    ],
  },
  {
    id: 'food',
    icon: '🍕',
    label: 'Food',
    emojis: [
      '🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭',
      '🍍','🥥','🥝','🍅','🥑','🍆','🥔','🥕','🌽','🌶️','🥒','🥬','🥦','🧄',
      '🧅','🍄','🥜','🌰','🍞','🥐','🥖','🫓','🥨','🥯','🥞','🧇','🧀','🍖',
      '🍗','🥩','🥓','🍔','🍟','🍕','🌭','🥪','🌮','🌯','🫔','🥙','🧆','🥚',
      '🍳','🥘','🍲','🫕','🥣','🥗','🍿','🧈','🧂','🥫','🍱','🍘','🍙','🍚',
      '🍛','🍜','🍝','🍠','🍢','🍣','🍤','🍥','🥮','🍡','🥟','🥠','🥡','🦪',
      '🍦','🍧','🍨','🍩','🍪','🎂','🍰','🧁','🥧','🍫','🍬','🍭','🍮','🍯',
      '🍵','☕','🍶','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🍾','🥤','🧋','🧃',
    ],
  },
  {
    id: 'travel',
    icon: '🚀',
    label: 'Travel',
    emojis: [
      '🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑','🚒','🚐','🚚','🚛','🚜','🛴',
      '🚲','🛵','🏍️','🛺','🚁','🛸','🚀','✈️','🛫','🛬','🛩️','🚂','🚆','🚇',
      '🚉','🚊','🚋','🚞','🚝','🚄','🚅','🚈','🚂','⛵','🚤','🛥️','🛳️','⛴️',
      '🚢','⚓','🌍','🌎','🌏','🗺️','🏝️','🏖️','🏔️','⛰️','🌋','🏕️','🏜️','🏞️',
    ],
  },
];

export const EmojiPicker = ({ onSelect, onClose, colors }) => {
  const [activeId, setActiveId] = useState(CATEGORIES[0].id);
  const rootRef = useRef(null);

  // Close on Escape. Click-outside is intentionally NOT bound — the host
  // template controls open/close via the Smile toggle, and a stray click
  // inside the panel (e.g. on the input) shouldn't dismiss the picker.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const category = CATEGORIES.find((c) => c.id === activeId) || CATEGORIES[0];

  // Sensible defaults so callers can omit pieces of the theme without
  // shattering the styling. Templates always pass at least bg/text/border.
  const c = {
    bg: '#0a0a0a',
    surfaceAlt: '#1f1f1f',
    border: '#262626',
    borderSubtle: '#1f1f1f',
    text: '#fafafa',
    textMuted: '#a3a3a3',
    accent: '#c5f825',
    hover: 'rgba(255,255,255,0.08)',
    ...(colors || {}),
  };

  return (
    <div
      ref={rootRef}
      className="flex flex-col overflow-hidden"
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 12,
        boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
        width: '100%',
        height: 280,
      }}
    >
      {/* Category tabs */}
      <div
        className="flex items-center px-1 py-1 flex-shrink-0"
        style={{ borderBottom: `1px solid ${c.borderSubtle || c.border}` }}
      >
        {CATEGORIES.map((cat) => {
          const isActive = cat.id === activeId;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveId(cat.id)}
              className="flex items-center justify-center flex-1 transition-colors"
              style={{
                height: 32,
                fontSize: 18,
                borderRadius: 6,
                background: isActive ? c.surfaceAlt : 'transparent',
                opacity: isActive ? 1 : 0.6,
                position: 'relative',
              }}
              aria-label={cat.label}
              title={cat.label}
            >
              {cat.icon}
              {isActive && (
                <span
                  style={{
                    position: 'absolute',
                    bottom: -1,
                    left: '20%',
                    right: '20%',
                    height: 2,
                    background: c.accent,
                    borderRadius: 1,
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Emoji grid — scrolls vertically when the category overflows. */}
      <div
        className="flex-1 overflow-y-auto px-2 py-2 scrollbar-thin"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 2 }}
      >
        {category.emojis.map((emoji, i) => (
          <button
            key={`${category.id}-${i}`}
            type="button"
            onClick={() => onSelect(emoji)}
            className="flex items-center justify-center transition-colors"
            style={{
              height: 30,
              fontSize: 20,
              borderRadius: 4,
              lineHeight: 1,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = c.hover; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            aria-label={emoji}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
};

export default EmojiPicker;
