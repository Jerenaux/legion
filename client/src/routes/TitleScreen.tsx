import {h} from "preact";
import {useContext} from "preact/hooks";
import {route} from "preact-router";
import logoBig from "@assets/logo.png";
import {PlayerContext} from "../contexts/PlayerContext";
import {STEAM_STORE_URL, titlePlayRoute} from "./titleScreenRoute";
import "./TitleScreen.style.css";

const TitleScreen = () => {
  const {loaded, player} = useContext(PlayerContext);
  const play = () => route(titlePlayRoute(player.engagementStats?.completedGames || 0));

  return (
    <div className="title-screen">
      <div className="title-screen-content">
        <img src={logoBig} alt="Legion" className="logo-big" />
        {loaded && (
          <div className="title-screen-actions">
            <button autoFocus className="title-screen-button title-screen-button--play" onClick={play}>Play</button>
            <a
              className="title-screen-button title-screen-button--steam"
              href={STEAM_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Wishlist Legion on Steam (opens in browser)"
            >
              <svg className="steam-logo" viewBox="0 0 89 90" aria-hidden="true">
                <path d="M44.238.601C21 .601 1.963 18.519.154 41.29l23.71 9.803a12.45 12.45 0 0 1 7.047-2.179c.234 0 .467.008.698.021l10.544-15.283v-.216c0-9.199 7.483-16.683 16.683-16.683 9.199 0 16.682 7.484 16.682 16.683 0 9.199-7.483 16.684-16.682 16.684l-.379-.006-15.038 10.73c.008.195.015.394.015.592 0 6.906-5.617 12.522-12.522 12.522-6.061 0-11.129-4.326-12.277-10.055L1.678 56.893c5.25 18.568 22.309 32.181 42.56 32.181 24.432 0 44.237-19.806 44.237-44.235C88.475 20.406 68.669.601 44.238.601" />
                <path d="m27.875 67.723-5.434-2.245c.963 2.005 2.629 3.684 4.841 4.606 4.782 1.992 10.295-.277 12.288-5.063a9.35 9.35 0 0 0 .014-7.189 9.34 9.34 0 0 0-5.074-5.097 9.31 9.31 0 0 0-6.926-.105l5.613 2.321c3.527 1.47 5.195 5.52 3.725 9.047-1.467 3.528-5.52 5.196-9.047 3.725" />
                <path d="M69.95 33.436c0-6.129-4.986-11.116-11.116-11.116-6.129 0-11.116 4.987-11.116 11.116 0 6.13 4.987 11.115 11.116 11.115 6.13-.001 11.116-4.986 11.116-11.115m-19.448-.019c0-4.612 3.739-8.35 8.351-8.35 4.612 0 8.351 3.738 8.351 8.35s-3.739 8.35-8.351 8.35c-4.612 0-8.351-3.739-8.351-8.35" />
              </svg>
              <span>Wishlist on Steam</span>
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default TitleScreen;
