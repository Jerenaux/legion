// HomePage.tsx
import { h, Component } from 'preact';
import { Router, Route, Link } from 'preact-router';
import PlayPage from './PlayPage';
import TeamPage from './TeamPage';
import ShopPage from './ShopPage';
import RankPage from './RankPage';
import NotificationBar from './NotificationBar';

interface State {
    currentPage: string;
}

class HomePage extends Component<{}, State> {
    state: State = {
        currentPage: 'play',
    };
    componentDidMount() {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css';
        link.id = 'font-awesome-css';
        document.head.appendChild(link);
    }

    componentWillUnmount() {
        const link = document.getElementById('font-awesome-css');
        if (link) {
            document.head.removeChild(link);
        }
    }

    handleRouteChange = (e) => {
        const pathParts = e.url.split('/');
        const currentPage = pathParts[1]; // This will be 'team' if the URL is '/team/2'
       
        this.setState({ 
            currentPage,
        });
    };

    render() {
        const { currentPage } = this.state;
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
            <Link href="/">
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
            
            <NotificationBar />

            <div className="mainContent">
                <Router onChange={this.handleRouteChange}>
                <Route default path="/play" component={PlayPage} />
                <Route path="/team/:id?" component={TeamPage} />
                <Route path="/shop" component={ShopPage} />
                <Route path="/rank" component={RankPage} />
                </Router>
            </div>
            </div>
        </div>
        );
    }
}

export default HomePage;