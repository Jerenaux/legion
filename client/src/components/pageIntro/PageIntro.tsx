import {h, type ComponentChildren} from 'preact';
import {useState} from 'preact/hooks';
import Modal from 'react-modal';
import {t} from '../../i18n/core';
import './PageIntro.css';

export type IntroPage = 'rank' | 'play' | 'team' | 'shop' | 'identity';

export interface IntroStep {
  title: string;
  art: ComponentChildren;
  rows?: {icon: string; text: string}[];
  lines: string[];
}

// Same key format as the original Rank intro, so players who saw it are not asked again.
const storageKey = (page: IntroPage, uid: string) => `legion.${page}Intro.v1.${uid}`;

/** Shown once per page, per account on this device; pages can reopen it on request. */
export function shouldShowPageIntro(page: IntroPage, uid: string | undefined): boolean {
  if (!uid) return false;
  try { return !localStorage.getItem(storageKey(page, uid)); } catch { return false; }
}

export function markPageIntroSeen(page: IntroPage, uid: string | undefined) {
  if (!uid) return;
  try { localStorage.setItem(storageKey(page, uid), String(Date.now())); } catch { /* Storage disabled: shows again next visit. */ }
}

interface Props {
  page: IntroPage;
  uid: string;
  label: string;
  steps: IntroStep[];
  finishLabel: string;
  onClose: () => void;
}

/** A short, centred, step-by-step explanation of a menu page, in the game's dialog style. */
export default function PageIntro({page, uid, label, steps, finishLabel, onClose}: Props) {
  const [step, setStep] = useState(0);
  const close = () => {
    markPageIntroSeen(page, uid);
    onClose();
  };
  const current = steps[step];
  const last = step === steps.length - 1;
  return <Modal isOpen onRequestClose={close} contentLabel={label} className={`page-intro page-intro--${page}`} overlayClassName="page-intro-overlay">
    <p className="page-intro-step" aria-live="polite">{t('Step {{value0}} of {{value1}}', {value0: step + 1, value1: steps.length})}</p>
    <div className="page-intro-art" key={step} aria-hidden="true">{current.art}</div>
    <h2>{current.title}</h2>
    {current.rows && <ul className="page-intro-rows">
      {current.rows.map(row => <li key={row.text}><img src={row.icon} alt="" />{row.text}</li>)}
    </ul>}
    {current.lines.map(line => <p className="page-intro-text" key={line}>{line}</p>)}
    <div className="page-intro-dots" aria-hidden="true">
      {steps.map((_, index) => <span key={index} className={index === step ? 'is-current' : ''} />)}
    </div>
    <div className="page-intro-actions">
      {step > 0 ? <button type="button" className="page-intro-secondary" onClick={() => setStep(step - 1)}>{t('Back')}</button>
        : <button type="button" className="page-intro-secondary" data-desktop-cancel onClick={close}>{t('Skip')}</button>}
      <button type="button" className="page-intro-primary" onClick={() => last ? close() : setStep(step + 1)}>
        {last ? finishLabel : t('Next')}
      </button>
    </div>
  </Modal>;
}
