// HomePage.tsx
import { h, Component } from 'preact';
import { Router, Route } from 'preact-router';
import AuthContext from '../contexts/AuthContext';
import { PlayerContext } from '../contexts/PlayerContext';

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

class HomePage extends Component<object, {}> {
    static contextType = AuthContext;


    // handleRouteChange = (e) => {

    //     const showFirebaseUI = false;

    //     this.setState({
    //         showFirebaseUI,
    //     });
    // };

    logout = () => {
        // Use context to handle logout
        const { firebaseAuth } = this.context;
        firebaseAuth.signOut().then(() => {
            // No need to update state here since AuthProvider will handle it
        }).catch((error) => {
            console.error('Error signing out: ', error);
        });
    }

    render() {
        const { user } = this.context;

        return (
            <PlayerContext.Consumer> 
                {({ player }) => (
                    <div className="homePage">
                        <Navbar user={user} playerData={player} logout={this.logout} />
                        <div className="content">
                            <div className="mainContent">
                                {/* <Router onChange={this.handleRouteChange}> */}
                                <Router>
                                    <Route default path="/play" component={PlayPage} />
                                    <Route path="/queue/:mode" component={QueuePage} />
                                    <Route path="/team/:id?" component={TeamPage} />
                                    <Route path="/shop/:id?" component={ShopPage} />
                                    <Route path="/rank" component={RankPage} />
                                </Router>
                            </div>
                        </div>
                        {/* <div className={`dialog login-dialog ${!showFirebaseUI ? 'hidden' : ''}`}>
                            <div className="shop-item-card-header" >
                                <div className="shop-item-card-name">Sign up or sign in</div>
                                <div className="shop-item-card-name-shadow">Sign up or sign in</div>
                            </div>
                            <div className="shop-item-card-content" id="firebaseui-auth-container">
                                <i className="fa-solid fa-circle-xmark closebtn" onClick={this.hideFirebaseUI} />
                            </div>
                        </div> */}
                    </div>
                )}
            </PlayerContext.Consumer>
        );
    }
}

export default HomePage;