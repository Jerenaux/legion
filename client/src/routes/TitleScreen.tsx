import LanguageSelect from '../components/LanguageSelect';
import {t} from '../i18n/core';
import { h } from 'preact';

import {useContext, useEffect, useRef, useState} from "preact/hooks";
import {route} from "preact-router";
import logoBig from "@assets/logo.png";
import titleArt from "@assets/title/title.png";
import {PlayerContext} from "../contexts/PlayerContext";
import Spinner from "../components/spinner/Spinner";
import {STEAM_STORE_URL, titlePlayRoute} from "./titleScreenRoute";
import {DESKTOP_ACTION_EVENT, DesktopAction} from "../input/actions";
import {buttonLabel, buttonsFor, primaryKeyLabel} from "../input/bindings";
import {loadGameSettings} from "../settings";
import "./TitleScreen.style.css";

const {version} = require("../../package.json");

/** Long enough for the flash to peak and fade to ink before the menus replace it. */
const LEAVE_DELAY_MS = 420;

// Deterministic so the drift looks the same on every visit and in screenshots.
const random = (seed: number) => {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
};
const LEAVES = Array.from({length: 14}, (_, i) => ({
  '--x': `${Math.round(random(i + 1) * 120)}%`,
  '--size': `${Math.round(14 + random(i + 11) * 14)}px`,
  '--duration': `${(11 + random(i + 21) * 9).toFixed(1)}s`,
  '--delay': `${(-random(i + 31) * 20).toFixed(1)}s`,
  '--sway': `${(2.5 + random(i + 41) * 2).toFixed(1)}s`,
  '--spin': `${Math.round(240 + random(i + 51) * 480) * (i % 2 ? 1 : -1)}deg`,
  '--hue': `${Math.round(4 + random(i + 61) * 34)}`,
}));
const EMBERS = Array.from({length: 18}, (_, i) => ({
  '--x': `${Math.round(random(i + 101) * 100)}%`,
  '--size': `${(2 + random(i + 111) * 3).toFixed(1)}px`,
  '--duration': `${(6 + random(i + 121) * 6).toFixed(1)}s`,
  '--delay': `${(-random(i + 131) * 12).toFixed(1)}s`,
  '--drift': `${Math.round((random(i + 141) - 0.5) * 160)}px`,
}));

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

const TitleScreen = () => {
  const {loaded, player} = useContext(PlayerContext);
  const [leaving, setLeaving] = useState(false);
  const [gamepad, setGamepad] = useState(false);
  const leavingRef = useRef(false);
  const playRef = useRef<() => void>();
  const leaveTimer = useRef(0);

  const play = () => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    const target = titlePlayRoute(player.engagementStats?.completedGames || 0);
    if (reducedMotion()) return route(target);
    setLeaving(true);
    leaveTimer.current = window.setTimeout(() => route(target), LEAVE_DELAY_MS);
  };
  useEffect(() => () => window.clearTimeout(leaveTimer.current), []);
  playRef.current = play;

  // Confirm with nothing focused starts the game, so Enter or controller A works straight away.
  useEffect(() => {
    const onAction = (event: CustomEvent<{action: DesktopAction; source: string}>) => {
      if (event.detail.source === 'gamepad') setGamepad(true);
      if (event.detail.action !== 'confirm' || !loaded) return;
      const active = document.activeElement;
      if (active && active !== document.body) return;
      if (document.querySelector('[role="dialog"], [aria-modal="true"]')) return;
      playRef.current?.();
    };
    const onPadConnected = () => setGamepad(true);
    const onKey = () => setGamepad(false);
    window.addEventListener(DESKTOP_ACTION_EVENT, onAction as EventListener);
    window.addEventListener('gamepadconnected', onPadConnected);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener(DESKTOP_ACTION_EVENT, onAction as EventListener);
      window.removeEventListener('gamepadconnected', onPadConnected);
      window.removeEventListener('keydown', onKey);
    };
  }, [loaded]);

  const controls = loadGameSettings().controls;
  const padButton = buttonsFor('confirm', controls)[0];
  const confirmLabel = gamepad && padButton !== undefined ? buttonLabel(padButton) : t(primaryKeyLabel('confirm', controls));

  return (
    <div className={`title-screen${leaving ? ' title-screen--leaving' : ''}`}>
      <div className="title-scene" aria-hidden="true">
        <div className="title-scene-drift">
          <img src={titleArt} alt="" className="title-scene-art" draggable={false} />
          <span className="title-sword-glow" />
          <span className="title-sword-glint" />
        </div>
      </div>
      <div className="title-vignette" aria-hidden="true" />
      <div className="title-particles" aria-hidden="true">
        {LEAVES.map((style, i) => <span key={`leaf-${i}`} className="title-leaf" style={style}><span /></span>)}
        {EMBERS.map((style, i) => <span key={`ember-${i}`} className="title-ember" style={style} />)}
      </div>

      <div className="title-screen-content" aria-busy={!loaded}>
        <h1 className="title-logo">
          <span className="title-logo-intro">
            <span className="title-logo-glow" aria-hidden="true" />
            <img src={logoBig} alt={t("Emberhall")} className="logo-big" draggable={false} />
            <span className="title-logo-shine" aria-hidden="true" style={{'--logo': `url(${logoBig})`}} />
          </span>
        </h1>
        {loaded ? (
          <div className="title-screen-actions">
            <button type="button" className="game-btn game-btn--gold title-screen-button title-screen-button--play" onClick={play}>{t("Play")}</button>
            {confirmLabel && <p className="title-screen-hint" aria-hidden="true">{t("Press {{value0}} to play", {value0: confirmLabel})}</p>}
            <a
              className="title-screen-button title-screen-button--steam"
              href={STEAM_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t("Wishlist Emberhall on Steam (opens in browser)")}
            >
              <svg className="steam-logo" viewBox="0 0 89 90" aria-hidden="true">
                <path d="M44.238.601C21 .601 1.963 18.519.154 41.29l23.71 9.803a12.45 12.45 0 0 1 7.047-2.179c.234 0 .467.008.698.021l10.544-15.283v-.216c0-9.199 7.483-16.683 16.683-16.683 9.199 0 16.682 7.484 16.682 16.683 0 9.199-7.483 16.684-16.682 16.684l-.379-.006-15.038 10.73c.008.195.015.394.015.592 0 6.906-5.617 12.522-12.522 12.522-6.061 0-11.129-4.326-12.277-10.055L1.678 56.893c5.25 18.568 22.309 32.181 42.56 32.181 24.432 0 44.237-19.806 44.237-44.235C88.475 20.406 68.669.601 44.238.601" />
                <path d="m27.875 67.723-5.434-2.245c.963 2.005 2.629 3.684 4.841 4.606 4.782 1.992 10.295-.277 12.288-5.063a9.35 9.35 0 0 0 .014-7.189 9.34 9.34 0 0 0-5.074-5.097 9.31 9.31 0 0 0-6.926-.105l5.613 2.321c3.527 1.47 5.195 5.52 3.725 9.047-1.467 3.528-5.52 5.196-9.047 3.725" />
                <path d="M69.95 33.436c0-6.129-4.986-11.116-11.116-11.116-6.129 0-11.116 4.987-11.116 11.116 0 6.13 4.987 11.115 11.116 11.115 6.13-.001 11.116-4.986 11.116-11.115m-19.448-.019c0-4.612 3.739-8.35 8.351-8.35 4.612 0 8.351 3.738 8.351 8.35s-3.739 8.35-8.351 8.35c-4.612 0-8.351-3.739-8.351-8.35" />
              </svg>
              <span>{t("Wishlist on Steam")}</span>
            </a>
          </div>
        ) : (
          <div className="title-screen-loading">
            <Spinner />
            <p>{t("Loading your game…")}</p>
          </div>
        )}
      </div>

      <div className="title-screen-corner title-screen-corner--start">
        <LanguageSelect compact />
      </div>
      <small className="title-screen-corner title-screen-version">{t("v{{value0}}", {value0: version})}</small>
      <div className="title-flash" aria-hidden="true" />
    </div>
  );
};

export default TitleScreen;
