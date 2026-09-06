import { h } from 'preact';

import logoBig from "@assets/logobig.png";
import "./Welcome.style.css";

interface WelcomeProps {
  onHide: () => void;
}

const Welcome = ({onHide}: WelcomeProps) => (
  <div className="welcome-overlay">
    <div className="welcome-dialog">
      <img src={logoBig} alt="Legion" className="welcome-logo" />
      <div className="dialog-content">
        <h1 className="welcome-text">Welcome to Legion!</h1>
        <div className="welcome-header">Build your team and enter the arena.</div>
        <button type="button" className="explore-btn" onClick={onHide}>Continue</button>
      </div>
    </div>
  </div>
);

export default Welcome;
