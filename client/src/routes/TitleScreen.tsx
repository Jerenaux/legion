import {h} from "preact";
import {useContext} from "preact/hooks";
import {route} from "preact-router";
import logoBig from "@assets/logo.png";
import {PlayerContext} from "../contexts/PlayerContext";
import {titlePlayRoute} from "./titleScreenRoute";
import "./TitleScreen.style.css";

const TitleScreen = () => {
  const {loaded, player} = useContext(PlayerContext);
  const play = () => route(titlePlayRoute(player.engagementStats?.completedGames || 0));

  return (
    <div className="title-screen">
      <div className="title-screen-content">
        <img src={logoBig} alt="Legion" className="logo-big" />
        {loaded && <button autoFocus className="cta-button-title-screen" onClick={play}>Play</button>}
      </div>
    </div>
  );
};

export default TitleScreen;
