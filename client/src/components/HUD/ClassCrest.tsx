import { h, Fragment } from 'preact';
import { Class, ClassLabels } from '@legion/shared/enums';
import './ClassCrest.style.css';

// Broad silhouettes stay distinct when the combat HUD scales down.
const symbols = {
  [Class.WARRIOR]: <>
    <path d="m16 7 4 5-2 10h-4l-2-10z" />
    <path d="M10 21h12v3h-4v5h-4v-5h-4z" />
    <path d="M16 10v10" className="class-crest__engraving" />
  </>,
  [Class.WHITE_MAGE]: <>
    <path d="M13 11h6v5h5v6h-5v5h-6v-5H8v-6h5z" />
    <path d="M16 6v2M5 11l2 2m20-2-2 2" className="class-crest__rays" />
  </>,
  [Class.BLACK_MAGE]: <>
    <path d="M17 6c2 7 8 8 8 15a9 9 0 0 1-18 0c0-4 2-7 5-10 0 4 1 5 2 6 3-3 4-6 3-11Z" />
    <path d="m16 18 4 5-4 5-4-5z" className="class-crest__cutout" />
  </>,
  [Class.THIEF]: <>
    <path d="m10 7 5 5v9h-4L9 10Zm12 0 1 3-2 11h-4v-9ZM9 22h7v3h-2v5h-3v-5H9Zm7 0h7v3h-2v5h-3v-5h-2Z" />
  </>,
  [Class.RANDOM]: <path d="m16 8 3 8 7 3-7 3-3 8-3-8-7-3 7-3z" />,
};

export default function ClassCrest({ characterClass }: { characterClass: Class }) {
  return (
    <svg className="class-crest" data-class={characterClass} viewBox="0 0 32 36" role="img" aria-label={ClassLabels[characterClass]}>
      <title>{ClassLabels[characterClass]}</title>
      <path d="M7 2h18l5 5v20L16 34 2 27V7Z" className="class-crest__rim" />
      <path d="M8 5h16l3 3v17l-11 6L5 25V8Z" className="class-crest__field" />
      <path d="M5 14V8l3-3h16l3 3" className="class-crest__bevel" />
      <g className="class-crest__symbol">{symbols[characterClass] ?? symbols[Class.RANDOM]}</g>
    </svg>
  );
}
