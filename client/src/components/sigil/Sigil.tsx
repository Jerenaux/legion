import { h } from 'preact';
import { useId } from 'preact/hooks';
import { Sigil as SigilSpec, SIGIL_PALETTE, isValidSigil } from '@legion/shared/communities';
import { SIGIL_PATTERN_PATHS as PATTERNS, SIGIL_SHAPE_PATHS as SHAPES, SIGIL_SYMBOL_PATHS as SYMBOLS } from '@legion/shared/sigilArt';
import './Sigil.style.css';

// Community sigils share the class crests' construction: a 32x36 badge with a rim, a
// coloured field, a heraldic division and one bold symbol. Everything is vector, so any
// size stays crisp and no per-creator artwork is needed.

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
