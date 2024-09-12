// HomePage.tsx
import { h, Component } from 'preact';
import { Router, Route } from 'preact-router';
import AuthContext from '../contexts/AuthContext';
import { PlayerContext } from '../contexts/PlayerContext';

import PlayPage from '../components/PlayPage';
import TeamPage from '../components/TeamPage';
import ShopPage from '../components/ShopPage';
import RankPage from '../components/RankPage';
import Navbar from '../components/navbar/Navbar';
import QueuePage from '../components/QueuePage';

class HomePage extends Component<object, {}> {
    static contextType = AuthContext;

    render() {
        const { user } = this.context;
        if (!user) return;

        return (
            <PlayerContext.Consumer> 
                {({ player }) => (
                    <div className="homePage">
                        <Navbar user={user} playerData={player} logout={this.context.logout} />
                        <div className="content">
                            <div className="mainContent">
                                <Router>
                                    <Route path="/play" component={PlayPage} />
                                    <Route path="/queue/:mode" component={QueuePage} />
                                    <Route path="/team/:id?" component={TeamPage} />
                                    <Route path="/shop/:id?" component={ShopPage} />
                                    <Route path="/rank" component={RankPage} />
                                </Router>
                            </div>
                        </div>
                    </div>
                )}
            </PlayerContext.Consumer>
        );
    }
}

export default HomePage;