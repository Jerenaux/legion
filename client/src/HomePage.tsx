// HomePage.tsx
import { h, Component } from 'preact';
import { Router, Route, Link } from 'preact-router';
import PlayPage from './PlayPage';
import TeamPage from './TeamPage';
import ShopPage from './ShopPage';

class HomePage extends Component {
    state = {
        currentPage: 'play'
    };
    handleRouteChange = (e) => {
        this.setState({ currentPage: e.url.substring(1) });
    };
    render() {
        const { currentPage } = this.state;
        const bgcolors = {
            play: '#080c15',
            team: '#06090a',
            shop: '#070507'
        }
        const bgImage = {
            backgroundImage: `url(assets/${currentPage}bg.png)`,
            backgroundColor: bgcolors[currentPage]
        };
        return (
        <div className="homePage">
            <div className="menu">
            <img src="assets/legionlogo.png" className="gameLogo" />
            <div className="menuItems">
                <Link href="/play"><img className="menuItem" src="assets/play.png" /></Link>
                <Link href="/team"><img className="menuItem" src="assets/team.png" /></Link>
                <Link href="/shop"><img className="menuItem" src="assets/shop.png" /></Link>
            </div> 
            </div>
            <div className="content" style={bgImage}>
            <div className="notificationBar">
                {/* Notifications go here */}
            </div>
            <div className="mainContent">
                <Router onChange={this.handleRouteChange}>
                <Route default path="/play" component={PlayPage} />
                <Route path="/team" component={TeamPage} />
                <Route path="/shop" component={ShopPage} />
                </Router>
            </div>
            </div>
        </div>
        );
    }
}

export default HomePage;