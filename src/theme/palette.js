/*
 * One accent colour in, a whole widget out.
 *
 * The template renders from inline styles rather than a stylesheet, because
 * the accent is not known until `GET /widget-api/config/{appId}` answers and
 * the colour scheme is not known until we have looked at the host page. A
 * stylesheet would have to ship every combination; an object is computed once
 * and handed down.
 *
 * Two neutral ramps are fixed here (light and dark). Only the accent-derived
 * tokens move, and every one of them is measured against the surface it will
 * actually sit on — see `theme/color.js`.
 */
import { alpha, contrast, ensureContrast, isColor, luminance, mix, readableOn } from './color.js';

export const DEFAULT_ACCENT = '#2563eb';

/*
 * Neutral ramps. The dark one is a near-black navy rather than pure grey: a
 * chat panel is a floating sheet on someone else's dark page, and a little
 * blue keeps it from reading as a hole punched in the layout.
 */
const NEUTRALS = {
  light: {
    bg: '#ffffff',
    surface: '#ffffff',
    surfaceAlt: '#f1f3f7',
    surfaceSunken: '#f7f8fa',
    border: '#e3e6ec',
    borderSubtle: '#eef0f4',
    text: '#101828',
    textMuted: '#5a6478',
    textFaint: '#98a2b3',
    success: '#12b76a',
    danger: '#e0464b',
    overlay: 'rgba(255, 255, 255, 0.94)',
    shadow: '0 24px 64px rgba(16, 24, 40, 0.16), 0 2px 8px rgba(16, 24, 40, 0.06)',
    launcherShadow: '0 10px 28px rgba(16, 24, 40, 0.22)',
  },
  dark: {
    bg: '#0c0e13',
    surface: '#14171e',
    surfaceAlt: '#1c202a',
    surfaceSunken: '#101319',
    border: '#272c37',
    borderSubtle: '#1e222b',
    text: '#e7ecf5',
    textMuted: '#98a2b3',
    textFaint: '#6b7588',
    success: '#3ddc97',
    danger: '#ff6169',
    overlay: 'rgba(12, 14, 19, 0.94)',
    shadow: '0 24px 64px rgba(0, 0, 0, 0.55), 0 2px 8px rgba(0, 0, 0, 0.4)',
    launcherShadow: '0 10px 28px rgba(0, 0, 0, 0.45)',
  },
};

/**
 * Host overrides may be flat (`{ bg: '#000' }`, applied to both schemes) or
 * split (`{ dark: { bg: '#000' } }`). Both are accepted because both are
 * things people reach for: one when they only care about the mode they use,
 * the other when they have designed for two.
 */
const flattenOverrides = (overrides, scheme) => {
  if (!overrides || typeof overrides !== 'object') return {};
  const { light, dark, ...common } = overrides;
  const perScheme = scheme === 'dark' ? dark : light;
  return { ...common, ...(perScheme && typeof perScheme === 'object' ? perScheme : {}) };
};

/**
 * @param {object}  options
 * @param {string} [options.accent]     Brand colour. Invalid or missing falls
 *                                      back to DEFAULT_ACCENT rather than
 *                                      rendering something unreadable.
 * @param {'light'|'dark'} [options.scheme]
 * @param {object} [options.overrides]  Any palette key, flat or per-scheme.
 */
export const buildPalette = ({ accent, scheme = 'light', overrides } = {}) => {
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const base = NEUTRALS[mode];
  const custom = flattenOverrides(overrides, mode);

  // Overrides land before the accent maths, not after, so a host that
  // repaints the surfaces still gets an accent measured against *its*
  // surfaces. Applied the other way round, a dark override on a light scheme
  // would keep the light scheme's contrast decisions and read as a bug.
  const neutral = { ...base, ...custom };

  const brand = isColor(custom.accent) ? custom.accent
    : isColor(accent) ? accent
      : DEFAULT_ACCENT;

  // The fill keeps the brand colour untouched. Its own label is chosen by
  // `readableOn`, so a filled surface is legible whatever colour it is — the
  // one exception is a brand that is indistinguishable from the panel itself,
  // where a 1.35 floor separates the two without visibly shifting the hue.
  const accentSurface = ensureContrast(brand, neutral.bg, 1.35);
  const accentText = readableOn(accentSurface);
  // As ink — a link, an icon, a 1px border — the accent has to clear a real
  // reading threshold, and for dark brands on dark panels that means moving.
  const accentInk = ensureContrast(brand, neutral.bg, 3.4);
  const accentSoft = mode === 'dark'
    ? mix(accentSurface, neutral.surface, 0.8)
    : mix(accentSurface, neutral.surface, 0.88);

  /*
   * The home hero fades from the brand colour into the panel so the cards can
   * straddle the seam. The fade is deliberately shallow where the greeting
   * sits — 18% of the way to the background at most — which is what lets one
   * ink serve the whole hero: measured against the pure accent, white-on-blue
   * stays above 3:1 (large text) even at the palest point of the run. Two
   * tokens are still exported so a host can split them if it wants to.
   */
  const heroTop = accentSurface;
  const heroMid = mix(accentSurface, neutral.bg, 0.18);
  const heroTopText = readableOn(heroTop);
  const heroText = heroTopText;
  const heroPlate = luminance(heroTopText) > 0.5 ? '#000000' : '#ffffff';

  const palette = {
    scheme: mode,

    ...neutral,

    accent: accentSurface,
    accentText,
    accentInk,
    accentSoft,
    accentHover: mode === 'dark' ? mix(accentSurface, '#ffffff', 0.12) : mix(accentSurface, '#000000', 0.1),
    accentRing: alpha(accentSurface, mode === 'dark' ? 0.32 : 0.24),
    accentGlow: alpha(accentSurface, mode === 'dark' ? 0.28 : 0.35),

    // A hairline of the button's own label colour. It is what keeps a
    // black launcher from dissolving into a black page without repainting
    // somebody's brand for them.
    accentEdge: alpha(accentText, 0.16),

    heroTop,
    heroMid,
    heroText,
    heroTopText,
    heroTextMuted: alpha(heroText, 0.82),
    heroGradient: `linear-gradient(180deg, ${heroTop} 0%, ${heroMid} 64%, ${neutral.bg} 100%)`,
    // Plates on the hero — the logo square, the avatar discs — move *away*
    // from the hero's ink rather than towards it. Tied to the panel's own
    // surfaces they would be a dark hole on a dark accent and a pale blob on
    // a light one; tied to the ink they would sink into the very text they
    // are carrying. Away from it, both stay legible on any brand colour.
    heroSurface: alpha(heroPlate, 0.18),
    heroAvatar: alpha(heroPlate, 0.3),

    bubbleIn: neutral.surfaceAlt,
    bubbleInText: neutral.text,
    bubbleOut: accentSurface,
    bubbleOutText: accentText,
  };

  // Overrides again, last, so a host that names `accent` *and* `accentText`
  // gets exactly the pair it asked for — the derivation above is a default,
  // not a correction of a deliberate choice.
  return { ...palette, ...custom, scheme: mode };
};

/**
 * True when the accent is close enough to the panel that a filled surface
 * needs its hairline edge to stay visible. Exported so the template can ask
 * rather than re-deriving the threshold.
 */
export const accentNeedsEdge = (palette) => contrast(palette.accent, palette.bg) < 1.6;

export default buildPalette;
