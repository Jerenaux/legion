// HomePage.tsx
import { h, Component } from 'preact';
import { Router, Route, Link } from 'preact-router';
import firebase from '@legion/shared/firebaseConfig';
import * as firebaseui from 'firebaseui'
import 'firebaseui/dist/firebaseui.css'
import { connectAuthEmulator } from 'firebase/auth';

import PlayPage from '../components/PlayPage';
import TeamPage from '../components/TeamPage';
import ShopPage from '../components/ShopPage';
import RankPage from '../components/RankPage';
import NotificationBar from '../components/NotificationBar';

interface State {
    currentPage: string;
    user: firebase.User | null;
    showFirebaseUI: boolean;
}

class HomePage extends Component<object, State> {
    state: State = {
        currentPage: 'play',
        user: null,
        showFirebaseUI: false,
    };

    componentDidMount() {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css';
        link.id = 'font-awesome-css';
        document.head.appendChild(link);

        if (process.env.PREACT_APP_USE_FIREBASE_EMULATOR === 'true') {
            connectAuthEmulator(firebase.auth(), 'http://localhost:9099');
        }

        this.unregisterAuthObserver = firebase.auth().onAuthStateChanged(
            (user) => this.setState({ user })
        );
   
    }

    componentWillUnmount() {
        const link = document.getElementById('font-awesome-css');
        if (link) {
            document.head.removeChild(link);
        }

        this.unregisterAuthObserver();

    }

    handleRouteChange = (e) => {
        const pathParts = e.url.split('/');
        const currentPage = pathParts[1]; // This will be 'team' if the URL is '/team/2'
        const showFirebaseUI = false;

        this.setState({ 
            currentPage,
            showFirebaseUI,
        });
    };

    unregisterAuthObserver: () => void;

    logout = () => {
        console.log('Logging out');
        firebase.auth().signOut().then(() => {
            this.setState({ user: null }); 
        }).catch((error) => {
            console.error('Error signing out: ', error);
        });
    }
  
    initFirebaseUI = () => {
      const uiConfig = {
        signInFlow: 'popup', 
        signInSuccessUrl: '/play',
        signInOptions: [
          firebase.auth.GoogleAuthProvider.PROVIDER_ID,
          firebase.auth.EmailAuthProvider.PROVIDER_ID,
        ],
      };
  
      try {
        const ui = firebaseui.auth.AuthUI.getInstance() || new firebaseui.auth.AuthUI(firebase.auth());
        ui.start('#firebaseui-auth-container', uiConfig);
        this.setState({ showFirebaseUI: true });
      } catch (error) {
        console.error('Error initializing Firebase UI: ', error);
      }
    }

    hideFirebaseUI = () => {
        this.setState({ showFirebaseUI: false });
    }

    render() {
        const { currentPage, showFirebaseUI } = this.state;
        const bgcolors = {
            play: '#080c15',
            team: '#06090a',
            shop: '#070507',
            rank: '#060607',
        }
        const bgImage = {
            backgroundImage: `url(/assets/${currentPage}bg.png)`,
            backgroundColor: bgcolors[currentPage]
        };
        return (
            <div className="homePage">
                <div className="menu">
                <Link href="/play">
                    <div className="menuItemContainer">
                        <img src="/assets/legionlogo.png" className="gameLogo" />
                    </div>
                </Link>
                <div className="menuItems">
                    <Link href="/play">
                        <div className="menuItemContainer">
                            <img className="menuItem" src="/assets/play.png" />
                            <span className="menuItemText">PLAY</span>
                        </div>
                    </Link>
                    <Link href="/team">
                        <div className="menuItemContainer">
                            <img className="menuItem" src="/assets/team.png" />
                            <span className="menuItemText">TEAM</span>
                        </div>
                    </Link>
                    <Link href="/shop">
                        <div className="menuItemContainer">
                            <img className="menuItem" src="/assets/shop.png" />
                            <span className="menuItemText">SHOP</span>
                        </div>
                    </Link>
                    <Link href="/rank">
                        <div className="menuItemContainer">
                            <img className="menuItem" src="/assets/rank.png" />
                            <span className="menuItemText">RANK</span>
                        </div>
                    </Link>
                </div> 
                </div>
                <div className="content" style={bgImage}>
                
                <NotificationBar initFirebaseUI={this.initFirebaseUI} logout={this.logout} user={this.state.user} />

                <div className="mainContent">
                    <Router onChange={this.handleRouteChange}>
                    <Route default path="/play" component={PlayPage} />
                    <Route path="/team/:id?" component={TeamPage} />
                    <Route path="/shop" component={ShopPage} />
                    <Route path="/rank" component={RankPage} />
                    </Router>
                </div>
                </div>

                <div className={`dialog login-dialog ${!showFirebaseUI ? 'hidden' : ''}`}>
                    <div className="shop-item-card-header" >
                        <div className="shop-item-card-name">Sign up or sign in</div>
                        <div className="shop-item-card-name-shadow">Sign up or sign in</div>
                    </div>
                    <div className="shop-item-card-content" id="firebaseui-auth-container">
                        <i className="fa-solid fa-circle-xmark closebtn" onClick={this.hideFirebaseUI} />
                    </div>
                </div>
            </div>
        );
    }
}

export default HomePage;