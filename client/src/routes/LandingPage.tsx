import { h, Component } from 'preact';
import { route } from 'preact-router';
import AuthContext from '../contexts/AuthContext';
import logoBig from '@assets/logobig.png';
import axios from 'axios';
import './LandingPage.style.css';
import Modal from '../components/modal/Modal';
import { apiFetch } from '../services/apiService';

interface LandingPageProps {
  utm_source?: string;
}

interface LandingPageState {
  showLoginOptions: boolean;
  isVideoPlaying: boolean;
  showLegalModal: boolean;
  modalContent: 'terms' | 'privacy' | null;
}

class LandingPage extends Component<LandingPageProps, LandingPageState> {
  static contextType = AuthContext;

  state: LandingPageState = {
    showLoginOptions: false,
    isVideoPlaying: false,
    showLegalModal: false,
    modalContent: null,
  };

  private firebaseUIContainer: HTMLDivElement | null = null;

  warmUpServer = async (): Promise<void> => {
    try {
      await axios.get(process.env.GAME_SERVER_URL);
      await fetch(`${process.env.API_URL}/getPlayerData`);
    } catch (error) {
      // console.error("Error warming up server:", error);
    }
  }

  componentDidMount(): void {
    if (!this.context.isAuthenticated) {
      this.warmUpServer().catch(error => {
        // console.error("Error in warmUpServer:", error);
      });
      
      if (this.props.utm_source) {
        this.context.setUtmSource(this.props.utm_source);
      }
    }
  }

  showLoginOptions = (): void => {
    this.setState({ showLoginOptions: true }, () => {
      if (this.firebaseUIContainer) {
        this.context.initFirebaseUI(this.firebaseUIContainer);
      }
    });
  };

  clearFirebaseUI = (): void => {
    this.context.resetUI();
    this.setState({ showLoginOptions: false });
  };

  openLegalModal = (content: 'terms' | 'privacy'): void => {
    this.setState({ showLegalModal: true, modalContent: content });
  };

  closeLegalModal = (): void => {
    this.setState({ showLegalModal: false, modalContent: null });
  };

  renderInitialView = (): h.JSX.Element => (
    <div className="landing-content">
      <div className="video-section">
        <div className="video-wrapper">
          <iframe 
            className="trailer-video"
            src="https://www.youtube.com/embed/VM6cGO-e2hY?si=NWHUWMMpdEFMaaki" 
            title="YouTube video player" 
            frameBorder="0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
            allowFullScreen
          ></iframe>
        </div>
      </div>
      <div className="login-header">
        <p>Assemble your team and become the strongest of the arena!</p>
      </div>
      <div className="login-buttons">
        <button className="get-started" onClick={() => route('/game/tutorial')}>Get Started</button>
        <button className="already-account" onClick={this.showLoginOptions}>Already have an account?</button>
      </div>
    </div>
  );

  renderLoginOptions = (): h.JSX.Element => (
    <div>
      <div className="login-header">
        <p>Choose your sign in/up method</p>
      </div>
      <div ref={(ref) => this.firebaseUIContainer = ref} id="firebaseui-auth-container"></div>
      <button className="back-button" onClick={this.clearFirebaseUI}>Back</button>
    </div>
  );

  render(): h.JSX.Element {
    const { showLoginOptions, showLegalModal, modalContent } = this.state;

    return (
      <div className="landingPage">
        <div className={`login-container ${showLoginOptions ? 'compact' : ''}`}>
          <img src={logoBig} alt="Logo" className="logo" />
          <div className="login-dialog">
            {showLoginOptions ? this.renderLoginOptions() : this.renderInitialView()}
          </div>
        </div>
        <footer className="legal-footer">
          <button className="legal-link" onClick={() => this.openLegalModal('terms')}>Terms of Service</button>
          <span className="separator">•</span>
          <button className="legal-link" onClick={() => this.openLegalModal('privacy')}>Privacy Policy</button>
        </footer>
        {showLegalModal && (
          <Modal onClose={this.closeLegalModal}>
            {modalContent === 'terms' ? (
              <div className="legal-content">
                <h2>Terms of Service</h2>
                <h3>1. Acceptance of Terms</h3>
    <p>By accessing and playing our game, you agree to be bound by these Terms of Service.</p>
    
    <h3>2. User Conduct</h3>
    <p>Players must:</p>
    <ul>
      <li>Be respectful to other players</li>
      <li>Not use cheats, exploits, or automation tools</li>
      <li>Not attempt to gain unauthorized access to other accounts</li>
      <li>Not engage in any activity that disrupts the gaming experience for others</li>
    </ul>
    
    <h3>3. Account Management</h3>
    <p>You are responsible for maintaining the confidentiality of your account credentials. We reserve the right to suspend or terminate accounts that violate our terms.</p>
    
    <h3>4. Fair Play</h3>
    <p>We maintain a fair playing environment and will take action against any form of cheating or exploitation.</p>
    
    <h3>5. Service Availability</h3>
    <p>We strive to maintain game availability but do not guarantee uninterrupted access. We may perform maintenance or updates as needed.</p>
    
    <h3>6. Modifications</h3>
    <p>We reserve the right to modify these terms at any time. Continued use of the game constitutes acceptance of modified terms.</p>
    
    <h3>7. Limitation of Liability</h3>
    <p>We are not liable for any indirect, incidental, or consequential damages arising from your use of the game.</p>
    
    <h3>8. Termination</h3>
    <p>We reserve the right to terminate or suspend access to our services for violations of these terms.</p>
 
              </div>
            ) : (
              <div className="legal-content">
                <h2>Privacy Policy</h2>
                <h3>1. Data Collection</h3>
    <p>We collect and store:</p>
    <ul>
      <li>Email addresses for account authentication</li>
      <li>Basic game progress and statistics</li>
    </ul>
    
    <h3>2. Data Usage</h3>
    <p>We use your email address solely for:</p>
    <ul>
      <li>Account authentication</li>
      <li>Critical service notifications</li>
      <li>Account recovery</li>
    </ul>
    
    <h3>3. Data Protection</h3>
    <p>We implement appropriate security measures to protect your email address and maintain game integrity.</p>
    
    <h3>4. Third-Party Services</h3>
    <p>We use Firebase for authentication. Please refer to Google's Privacy Policy for information about their data handling practices.</p>
    
    <h3>5. Your Rights</h3>
    <p>You have the right to:</p>
    <ul>
      <li>Request deletion of your account and associated data</li>
      <li>Request information about your stored data</li>
      <li>Update your email address</li>
    </ul>
    
    <h3>6. Data Retention</h3>
    <p>We retain your data only as long as necessary to provide our services or as required by law.</p>
    
    <h3>7. Contact</h3>
    <p>For privacy-related concerns, please contact us at l9584635@gmail.com .</p>
  
              </div>
            )}
          </Modal>
        )}
      </div>
    );
  }
}

export default LandingPage;