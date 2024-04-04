// HomePage.tsx
import { h, Component } from 'preact';
import { Router, Route } from 'preact-router';
import AuthContext from '../contexts/AuthContext';

import firebase from 'firebase/compat/app'
import * as firebaseui from 'firebaseui'
import 'firebaseui/dist/firebaseui.css'
import 'firebase/compat/auth';

import PlayPage from '../components/PlayPage';
import TeamPage from '../components/TeamPage';
import ShopPage from '../components/ShopPage';
import RankPage from '../components/RankPage';
import Navbar from '../components/navbar/Navbar';
import QueuePage from '../components/QueuePage';
import withAuth from '../components/withAuth';

interface State {
    currentPage: string;
    showFirebaseUI: boolean;
}

class HomePage extends Component<object, State> {
    static contextType = AuthContext;

    state: State = {
        currentPage: 'play',
        showFirebaseUI: false,
    };

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
        // Use context to handle logout
        const { firebaseAuth } = this.context;
        firebaseAuth.signOut().then(() => {
            // No need to update state here since AuthProvider will handle it
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
        const { user } = this.context;

        return (
            <div className="homePage">

                <Navbar user={user} initFirebaseUI={this.initFirebaseUI} logout={this.logout}/>

                <div className="content">

                <div className="mainContent">
                    <Router onChange={this.handleRouteChange}>
                        <Route default path="/play" component={PlayPage} />
                        <Route path="/queue" component={QueuePage} />
                        <Route path="/team/:id?" component={withAuth(TeamPage)} />
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