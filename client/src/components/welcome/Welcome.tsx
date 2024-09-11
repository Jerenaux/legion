import './Welcome.style.css';
import { h, Component } from 'preact';
import logoBig from '@assets/logobig.png';

class Welcome extends Component {
    render() {
        return (
          <div className="welcome-overlay">
            <div className="welcome-dialog">
              <img src={logoBig} alt="Logo" className="logo" />
              <div className="dialog-content">
                <h1 className="welcome-text">Welcome to Legion!</h1>
                <div className="login-header">
                  Play freely without an account, or create one at any time to save your progress.
                </div>
                <div className="login-buttons">
                  <button className="sign-up-btn">Sign Up</button>
                  <button className="explore-btn">Keep exploring</button>
                </div>
              </div>
            </div>
          </div>
        );
      }
}

export default Welcome;