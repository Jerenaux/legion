import {t} from '../../i18n/core';
import { h } from 'preact';
import './Ghost.style.css';

interface GhostProps {
  /** Height of each placeholder, in px or any CSS length. */
  height: number | string;
  /** Width of each placeholder; defaults to filling its container. */
  width?: number | string;
  count?: number;
  /** Extra class on the wrapper, for layouts that mirror the loaded content (grid, row, slots). */
  className?: string;
}

// Empty frames in the shape of the content that is on its way, with a slow light sweep.
export default function Ghost({height, width, count = 1, className = ''}: GhostProps) {
  return (
    <div className={`ghost-group ${className}`} role="status" aria-label={t("Loading...")}>
      {Array.from({length: count}, (_, index) => (
        <span key={index} className="ghost" aria-hidden="true" style={{height, width}} />
      ))}
    </div>
  );
}
