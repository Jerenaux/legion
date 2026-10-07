import { h } from 'preact';
import { useId } from 'preact/hooks';
import { Sigil as SigilSpec, SIGIL_PALETTE, isValidSigil } from '@legion/shared/communities';
import './Sigil.style.css';

// Community sigils share the class crests' construction: a 32x36 badge with a rim, a
// coloured field, a heraldic division and one bold symbol. Everything is vector, so any
// size stays crisp and no per-creator artwork is needed.

const SHAPES: {rim: string; field: string}[] = [
  // crest: the class-crest silhouette
  {rim: 'M7 2h18l5 5v20L16 34 2 27V7Z', field: 'M8 5h16l3 3v17l-11 6L5 25V8Z'},
  // heater shield
  {rim: 'M3 2h26v13c0 9-6 15-13 19C9 30 3 24 3 15Z', field: 'M6 5h20v10c0 7.5-4.5 12.5-10 15.6C10.5 27.5 6 22.5 6 15Z'},
  // round targe
  {rim: 'M16 3a15 15 0 1 1 0 30a15 15 0 1 1 0-30Z', field: 'M16 6a12 12 0 1 1 0 24a12 12 0 1 1 0-24Z'},
  // swallowtail banner
  {rim: 'M4 2h24v32l-12-6-12 6Z', field: 'M7 5h18v24.2l-9-4.5-9 4.5Z'},
];

// Divisions drawn in the secondary colour and clipped to the field.
const PATTERNS: (string | null)[] = [
  null, // plain
  'M11.5 0h9v36h-9Z', // pale
  'M0 14h32v8H0Z', // fess
  'M-2 4 4-2 34 28l-6 6Z', // bend
  'M16 13 32 25v8L16 21 0 33v-8Z', // chevron
  'M16 0h16v18H16ZM0 18h16v18H0Z', // quarterly
  'M13.5 0h5v36h-5ZM0 15.5h32v5H0Z', // cross
  'BORDURE', // bordure, drawn as an inner band
  'M-2 2 2-2 34 32l-4 4ZM30-2l4 4L2 36l-4-4Z', // saltire
  'M0 0h32v12H0Z', // chief
];

// Symbols on a 24x24 grid; "evenodd" cuts the holes (key ring, skull eyes, rune).
const SYMBOLS: string[] = [
  'M12 2l2 3v11h-4V5ZM6 16h12v2.5H6ZM10.8 18.5h2.4v3h-2.4ZM10.2 21.5h3.6v1.8h-3.6Z', // sword
  'M4.5 21.5 15.5 10.5 17 12 6 23ZM13 4.5c3.5-1.2 7 .2 8 2.5s.6 5.5-1.6 7.5l-2.2-2.2c1-1 1.1-2.2.3-3s-2.1-.8-3 .2Z', // axe
  'M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5Zm0 3.2L7 7.1V11c0 3.4 2 6.2 5 7.8Z', // shield
  'M3 8l4.5 4L12 5l4.5 7L21 8l-2 10H5ZM5 19.5h14V22H5Z', // crown
  'M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7.1L12 17.3 5.8 21l1.6-7.1L2 9.2l7.1-.6Z', // star
  'M12 7a5 5 0 1 1 0 10a5 5 0 1 1 0-10ZM11 1h2v4h-2ZM11 19h2v4h-2ZM1 11h4v2H1ZM19 11h4v2h-4ZM4.2 5.6l1.4-1.4 2.8 2.8-1.4 1.4ZM15.6 17l1.4-1.4 2.8 2.8-1.4 1.4ZM4.2 18.4l2.8-2.8 1.4 1.4-2.8 2.8ZM15.6 7l2.8-2.8 1.4 1.4-2.8 2.8Z', // sun
  'M15 2a10 10 0 1 0 7 17A8 8 0 0 1 15 2Z', // moon
  'M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 1.5-5 3-6.5 0 2.5 1 3.5 2 4 1-3 1.5-6 1-9.5Z', // flame
  'M12 2c3 5 7 9 7 13a7 7 0 0 1-14 0c0-4 4-8 7-13Z', // drop
  'M4 20C4 9 11 4 21 3c0 10-5 17-15 17l-1.5 2L3 21Z', // leaf
  'M12 2l6 7h-3l4 5h-3l4 5H4l4-5H5l4-5H6ZM10.5 19h3v4h-3Z', // tree
  'M1 21 8 9l4 6 3-4 8 10Z', // mountain
  'M6 3h3v2h2V3h2v2h2V3h3v5l-2 2v12H8V10L6 8Zm4.5 13v6h3v-6Z', // tower
  'M8 3a5 5 0 1 1 0 10a5 5 0 1 1 0-10Zm0 3a2 2 0 1 0 0 4a2 2 0 1 0 0-4ZM11 10.5l10 10-1.5 1.5-2-2-1.5 1.5-1.5-1.5 1.5-1.5-6.5-6.5Z', // key
  'M12 2c5 0 9 3.5 9 8.5 0 2.5-1 4.5-3 5.5v3h-3v-2h-2v2h-2v-2H9v2H6v-3c-2-1-3-3-3-5.5C3 5.5 7 2 12 2Zm-4 7a2 2 0 1 0 0 4a2 2 0 1 0 0-4Zm8 0a2 2 0 1 0 0 4a2 2 0 1 0 0-4Z', // skull
  'M1 12c3-5 7-7 11-7s8 2 11 7c-3 5-7 7-11 7S4 17 1 12Zm11-4a4 4 0 1 0 0 8a4 4 0 1 0 0-8Zm0 2a2 2 0 1 1 0 4a2 2 0 1 1 0-4Z', // eye
  'M12 1.5a2.5 2.5 0 1 1 0 5a2.5 2.5 0 1 1 0-5ZM11 6h2v13h-2ZM7 8h10v2H7ZM4 14c0 4 4 7 8 7s8-3 8-7l-2.5 1.5C17 18 14.5 19 12 19s-5-1-5.5-3.5Z', // anchor
  'M3 19.5 15 7.5 12.5 5H20v7.5L17.5 10l-12 12Z', // arrow
  'M14 1 4 14h6l-2 9 10-13h-6Z', // bolt
  'M6 3h12l4 6-10 13L2 9Z', // gem
  'M5 2h14v3c0 3-3 5-5 7 2 2 5 4 5 7v3H5v-3c0-3 3-5 5-7-2-2-5-4-5-7Z', // hourglass
  'M5 3h14c0 6-3 9-6 10v5h4v3H7v-3h4v-5C8 12 5 9 5 3Z', // chalice
  'M12 21C5 15 2 11.5 2 8a5 5 0 0 1 10-1a5 5 0 0 1 10 1c0 3.5-3 7-10 13Z', // heart
  'M3 2l6 6h6l6-6v10l-3 4-3 1.5L12 23l-3-5.5L6 16l-3-4Zm5.5 9 2.5 1.6-2.2.6Zm7 0-2.5 1.6 2.2.6Z', // wolf
  'M1 8c4.5 0 7.5 1.5 9.5 4.5L12 10l1.5 2.5C15.5 9.5 18.5 8 23 8c-3.2 2.2-5.4 5.4-6.4 9L13.5 16 12 19l-1.5-3-3.1 1C6.4 13.4 4.2 10.2 1 8Z', // raven
  'M3 3h13v7H3ZM16 4.5h3v4h-3ZM8.2 10h3v12.5h-3Z', // hammer
  'M5 3c2 6 2 12-1 18l2 1c4-6 4-13 1-19ZM11 2c2 7 2 13-1 20l2 1c4-7 4-14 1-21ZM17 3c2 6 2 12-1 18l2 1c4-6 4-13 1-19Z', // fang (claw marks)
  'M20 2C12 3 6 9 5 17l-2 5 2 1 2-4c8-1 13-7 13-17Z', // feather
  'M12 2l7 7-5 5 5 8h-3l-4-6-4 6H5l5-8-5-5Zm0 3L8 9l4 4 4-4Z', // rune
  'M2 14c3-3 5-3 7 0s4 3 7 0 4-3 6 0v4c-2-3-4-3-6 0s-4 3-7 0-4-3-7 0ZM2 7c3-3 5-3 7 0s4 3 7 0 4-3 6 0v3c-2-3-4-3-6 0s-4 3-7 0-4-3-7 0Z', // wave
];

interface Props {
  sigil: SigilSpec | null | undefined;
  /** Rendered height in CSS pixels; width follows the 32:36 badge ratio. */
  size?: number;
  /** Accessible name (usually the community name); omit for decorative uses next to visible text. */
  label?: string;
  className?: string;
}

export default function Sigil({sigil, size = 24, label, className = ''}: Props) {
  const id = useId();
  if (!isValidSigil(sigil)) return null;
  const shape = SHAPES[sigil.shape];
  const [field, division] = SIGIL_PALETTE[sigil.palette];
  const pattern = PATTERNS[sigil.pattern];
  const clip = `sigil-clip-${id}`;
  return (
    <svg className={`sigil ${className}`} viewBox="0 0 32 36" width={size * 32 / 36} height={size}
      role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {label && <title>{label}</title>}
      <defs><clipPath id={clip}><path d={shape.field} /></clipPath></defs>
      <path d={shape.rim} className="sigil__rim" />
      <path d={shape.field} fill={field} />
      <g clipPath={`url(#${clip})`}>
        {pattern === 'BORDURE'
          ? <path d={shape.field} fill="none" stroke={division} strokeWidth={5} />
          : pattern && <path d={pattern} fill={division} />}
        <path d="M0 0h32v14H0Z" className="sigil__sheen" />
      </g>
      <path d={SYMBOLS[sigil.symbol]} fillRule="evenodd" className="sigil__symbol" transform="translate(7.36 9.86) scale(.72)" />
    </svg>
  );
}

export const SIGIL_SYMBOL_COUNT = SYMBOLS.length;
export const SIGIL_PATTERN_COUNT = PATTERNS.length;
export const SIGIL_SHAPE_COUNT = SHAPES.length;
