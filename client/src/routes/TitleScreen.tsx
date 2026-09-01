import {h} from "preact";
import {route} from "preact-router";
import logoBig from "@assets/logo.png";
import "./TitleScreen.style.css";

const TitleScreen = () => (
  <div className="title-screen">
    <div className="title-screen-content">
      <img src={logoBig} alt="Legion" className="logo-big" />
      <button className="cta-button-title-screen" onClick={() => route("/play")}>Play</button>
    </div>
  </div>
);

export default TitleScreen;
