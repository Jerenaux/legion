import { h, Component, Fragment } from 'preact';
import { route } from 'preact-router';
import AuthContext from '../contexts/AuthContext';
import logoBig from '@assets/logobig.png';
import axios from 'axios';
import './LandingPage.style.css';
import Modal from '../components/modal/Modal';
import { generateVisitorId } from '../services/apiService';
import warriorImg from '@assets/warrior.png';
import blackMageImg from '@assets/blackmage.png';
import whiteMageImg from '@assets/whitemage.png';
import Spinner from '../components/spinner/Spinner';

interface LandingPageProps {
  utm_source?: string;
}

interface NewsItem {
  title: string;
  text: string;
  imageUrl: string;
  category: string;
  date: string;
  link: string | null;
}

interface LandingPageState {
  showLoginOptions: boolean;
  showLegalModal: boolean;
  modalContent: 'terms' | 'privacy' | null;
  news: NewsItem[];
  isLoadingNews: boolean;
}

class LandingPage extends Component<LandingPageProps, LandingPageState> {
  static contextType = AuthContext;

  state: LandingPageState = {
    showLoginOptions: false,
    showLegalModal: false,
    modalContent: null,
    news: [],
    isLoadingNews: true,
  };

  private firebaseUIContainer: HTMLDivElement | null = null;

  playRoute: string = '/game/0';

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
    
    const visitorId = generateVisitorId();
    // console.log(`[LandingPage:componentDidMount] visitorId: ${visitorId}`);
    this.fetchNews(undefined, visitorId);
  }

  fetchNews = async (retries = 3, visitorId?: string): Promise<void> => {
    try {
      const response = await fetch(`${process.env.API_URL}/getNews?isFrontPage=true&limit=3${visitorId ? `&visitorId=${visitorId}` : ''}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      this.setState({ 
        news: data,
        isLoadingNews: false 
      });
    } catch (error) {
      console.error('Error fetching news:', error);
      if (retries > 0) {
        // Wait 500ms before retrying
        await new Promise(resolve => setTimeout(resolve, 500));
        return this.fetchNews(retries - 1, visitorId);
      }
      this.setState({ isLoadingNews: false });
    }
  };

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

  renderHeroSection = (): h.JSX.Element => (
    <section className="hero-section">
      <h1 className="visually-hidden">Legion - Free to Play Tactical PvP Game</h1>
      <div className="video-container" aria-label="Game trailer video">
        <iframe 
          className="trailer-video"
          src="https://www.youtube.com/embed/VM6cGO-e2hY?si=NWHUWMMpdEFMaaki" 
          title="Legion - Free to Play Tactical PvP Game" 
          frameBorder="0" 
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
          allowFullScreen
        ></iframe>
      </div>
      <div className="hero-content">
        <h2>Easy to learn, thrilling to master</h2>
        <h3>Turn-based PvP - Tactical - Free to play</h3>
        <p>Assemble a team of heroes and compete against other players to be the strongest of the arena!</p>
        <button className="cta-button" onClick={() => route(this.playRoute)} aria-label="Start playing Legion">Play Now</button>
      </div>
    </section>
  );

  formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric'
    }).replace(/(\d+)(?=(,))/, (match) => {
      const num = parseInt(match);
      const suffix = ['th', 'st', 'nd', 'rd'][(num % 10 > 3 || num % 100 - num % 10 == 10) ? 0 : num % 10];
      return num + suffix;
    });
  };

  renderNewsSection = (): h.JSX.Element => (
    <section className="news-section">
      <h2>Latest News</h2>
      <div className="news-grid">
        {this.state.isLoadingNews ? (
          <div className="news-loading">
            <Spinner />
          </div>
        ) : this.state.news.length > 0 ? (
          [...this.state.news].reverse().map(news => (
            <div 
              className="news-card" 
              onClick={() => {
                if (news.link) {
                  window.open(news.link, '_blank');
                } else {
                  route(`/news/${news.title.toLowerCase().replace(/ /g, '-')}`);
                }
              }}
            >
              <div className="news-image" style={{ 
                backgroundImage: `url(${news.imageUrl || '/assets/news-placeholder.jpg'})` 
              }}></div>
              <div className="news-content">
                <span className="news-category">{news.category}</span>
                <h3>{news.title}</h3>
                <p>{news.text}</p>
                <time>{this.formatDate(news.date)}</time>
              </div>
            </div>
          ))
        ) : (
          <p className="no-news">No news available at the moment.</p>
        )}
      </div>
    </section>
  );

  renderFeaturesSection = (): h.JSX.Element => (
    <section className="features-section">
      <h2>Game Features</h2>
      <div className="features-grid">
        <div className="feature-card">
          <h3>Play Anytime</h3>
          <p>Quick matches that fit your schedule - one game at a time</p>
        </div>
        <div className="feature-card">
          <h3>Always Free</h3>
          <p>Free to play, now and forever - no pay-to-win</p>
        </div>
        <div className="feature-card">
          <h3>Instant Action</h3>
          <p>Start with 3 unique characters - jump right into the action</p>
        </div>
        <div className="feature-card">
          <h3>4 Game Modes</h3>
          <p>Practice, Casual, Ranked or challenge a friend</p>
        </div>
      </div>
      <button className="cta-button" onClick={() => route(this.playRoute)}>Play Now</button>
    </section>
  );

  renderClassesSection = (): h.JSX.Element => (
    <section className="classes-section">
      <h2>Combine different classes to create your own unique team</h2>
      <div className="classes-grid">
        <div className="class-card">
          <div className="class-image" style={{ backgroundImage: `url(${warriorImg})` }}></div>
          <h3>Warrior</h3>
          <p>Masters of close combat, warriors excel at controlling the battlefield and protecting allies</p>
        </div>
        <div className="class-card">
          <div className="class-image" style={{ backgroundImage: `url(${blackMageImg})` }}></div>
          <h3>Black Mage</h3>
          <p>Wielders of destructive magic, black mages can devastate enemies from afar</p>
        </div>
        <div className="class-card">
          <div className="class-image" style={{ backgroundImage: `url(${whiteMageImg})` }}></div>
          <h3>White Mage</h3>
          <p>Support specialists who turn the tide of battle with powerful healing, buffs and debuffs</p>
        </div>
      </div>
      <button className="cta-button" onClick={() => route(this.playRoute)}>Play Now</button>
    </section>
  );

  renderHeader = (): h.JSX.Element => (
    <header className="main-header">
      <img src={logoBig} alt="Logo" className="header-logo" />
      <div className="header-buttons">
        <button className="login-button" onClick={this.showLoginOptions}>Log in</button>
        <button className="cta-button" onClick={() => route(this.playRoute)}>Play Now</button>
      </div>
    </header>
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
      <div className="landing-page">
        {this.renderHeader()}
        <main className="main-content">
          {showLoginOptions ? (
            <div className="login-overlay">
              <div className="login-dialog">
                {this.renderLoginOptions()}
              </div>
            </div>
          ) : (
            <>
              {this.renderHeroSection()}
              {this.renderNewsSection()}
              {this.renderFeaturesSection()}
              {this.renderClassesSection()}
            </>
          )}
        </main>
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