/*
 * Colour maths for a widget whose accent is picked by somebody else.
 *
 * The dashboard lets every workspace set `connection.color`, and a host can
 * override it again from its own props. That single value has to produce a
 * launcher, a gradient, a chip, a link and a send button that all stay legible
 * — in light mode, in dark mode, and for the brands that pick near-black or
 * near-white. None of that can be hard-coded, so it is derived here.
 *
 * Everything works in sRGB. Perceptual spaces would mix nicer, but they cost a
 * conversion pair in a bundle that ships to strangers' sites, and the one
 * measurement that actually matters — WCAG contrast — is defined in sRGB
 * anyway.
 */

const HEX_SHORT = /^#([0-9a-f])([0-9a-f])([0-9a-f])([0-9a-f])?$/i;
const HEX_LONG = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})?$/i;
const RGB_FUNC = /^rgba?\(([^)]+)\)$/i;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const clampByte = (value) => clamp(Math.round(value), 0, 255);
const clampUnit = (value) => clamp(value, 0, 1);

/**
 * Accepts `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, `rgb()` and `rgba()`.
 *
 * Returns null for anything else — including named colours and `hsl()` — so
 * callers can fall back instead of rendering an invisible widget. A workspace
 * that saved `rebeccapurple` gets the default accent, which is wrong but
 * visible; a parser that guessed would be wrong and unreadable.
 */
export const parseColor = (input) => {
  if (typeof input !== 'string') return null;
  const value = input.trim().toLowerCase();
  if (!value) return null;

  let match = value.match(HEX_SHORT);
  if (match) {
    return {
      r: parseInt(match[1] + match[1], 16),
      g: parseInt(match[2] + match[2], 16),
      b: parseInt(match[3] + match[3], 16),
      a: match[4] === undefined ? 1 : parseInt(match[4] + match[4], 16) / 255,
    };
  }

  match = value.match(HEX_LONG);
  if (match) {
    return {
      r: parseInt(match[1], 16),
      g: parseInt(match[2], 16),
      b: parseInt(match[3], 16),
      a: match[4] === undefined ? 1 : parseInt(match[4], 16) / 255,
    };
  }

  match = value.match(RGB_FUNC);
  if (match) {
    // One split for both syntaxes: the legacy `rgb(1, 2, 3)` and the modern
    // `rgb(1 2 3 / 40%)`. Separators carry no meaning we need.
    const parts = match[1].split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const channel = (part) => (part.endsWith('%') ? (parseFloat(part) / 100) * 255 : parseFloat(part));
    const r = channel(parts[0]);
    const g = channel(parts[1]);
    const b = channel(parts[2]);
    if ([r, g, b].some((n) => Number.isNaN(n))) return null;
    let a = 1;
    if (parts[3] !== undefined) {
      a = parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]);
      if (Number.isNaN(a)) a = 1;
    }
    return { r: clampByte(r), g: clampByte(g), b: clampByte(b), a: clampUnit(a) };
  }

  return null;
};

export const isColor = (input) => parseColor(input) !== null;

const toHexPair = (value) => clampByte(value).toString(16).padStart(2, '0');

export const toHex = (rgb) => `#${toHexPair(rgb.r)}${toHexPair(rgb.g)}${toHexPair(rgb.b)}`;

/** `alpha('#2563eb', 0.12)` → `rgba(37, 99, 235, 0.12)`. */
export const alpha = (color, amount) => {
  const rgb = parseColor(color);
  if (!rgb) return color;
  return `rgba(${clampByte(rgb.r)}, ${clampByte(rgb.g)}, ${clampByte(rgb.b)}, ${Math.round(clampUnit(amount) * 1000) / 1000})`;
};

/**
 * `amount` is how far to travel from `from` towards `to`: 0 returns `from`,
 * 1 returns `to`. Opaque output — every caller here mixes against a known
 * background precisely so the result can be measured for contrast, and a
 * translucent colour cannot be.
 */
export const mix = (from, to, amount) => {
  const a = parseColor(from);
  const b = parseColor(to);
  if (!a || !b) return from;
  const t = clampUnit(amount);
  return toHex({
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  });
};

export const lighten = (color, amount) => mix(color, '#ffffff', amount);
export const darken = (color, amount) => mix(color, '#000000', amount);

const channelLuminance = (value) => {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

/** WCAG relative luminance, 0 (black) to 1 (white). */
export const luminance = (color) => {
  const rgb = parseColor(color);
  if (!rgb) return 0;
  return 0.2126 * channelLuminance(rgb.r)
    + 0.7152 * channelLuminance(rgb.g)
    + 0.0722 * channelLuminance(rgb.b);
};

/** WCAG contrast ratio, 1 (identical) to 21 (black on white). */
export const contrast = (a, b) => {
  const la = luminance(a);
  const lb = luminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
};

export const isDark = (color) => luminance(color) < 0.4;

/**
 * Ink that can be read on top of `background`. This is what stops a workspace
 * with a pale yellow brand from shipping white-on-yellow buttons: the answer
 * is measured, not assumed.
 */
export const readableOn = (background, light = '#ffffff', dark = '#0b1120') =>
  (contrast(background, light) >= contrast(background, dark) ? light : dark);

/**
 * Nudges `color` towards white or black — whichever is away from `background`
 * — until it clears `ratio`, and returns it unchanged when it already does.
 *
 * Used for the places where the accent is the *ink* (a link, an icon, a thin
 * border), never for the large filled surfaces: those keep the brand colour
 * exactly as it was given, because their own text is chosen by `readableOn`
 * and is legible whatever the fill turns out to be.
 */
export const ensureContrast = (color, background, ratio = 3) => {
  if (!parseColor(color) || !parseColor(background)) return color;
  if (contrast(color, background) >= ratio) return color;
  const target = luminance(background) > 0.45 ? '#000000' : '#ffffff';
  const STEPS = 24;
  for (let step = 1; step <= STEPS; step += 1) {
    const candidate = mix(color, target, step / STEPS);
    if (contrast(candidate, background) >= ratio) return candidate;
  }
  // Ran out of room: the background is mid-grey and the ratio unreachable by
  // lightening alone. The fully-shifted colour is still the most legible one
  // available, and returning it beats returning something invisible.
  return mix(color, target, 1);
};
