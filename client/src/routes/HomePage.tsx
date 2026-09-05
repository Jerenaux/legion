import { Component, h } from "preact";
import { Route, Router } from "preact-router";

import { PlayerContext } from "../contexts/PlayerContext";
import Navbar from "../components/navbar/Navbar";
import PlayPage from "../components/PlayPage";
import Profile from "../components/profile/Profile";
import QueuePage from "../components/QueuePage";
import RankPage from "../components/RankPage";
import ShopPage from "../components/ShopPage";
import TeamPage from "../components/TeamPage";

export default class HomePage extends Component {
  render() {
    return (
      <PlayerContext.Consumer>
        {({ player }) => (
          <div className="homePage">
            <Navbar playerData={player} />
            <div className="content">
              <div className="mainContent">
                <Router>
                  <Route path="/play" component={PlayPage} />
                  <Route path="/queue/:mode" component={QueuePage} />
                  <Route path="/lobby/:id" component={QueuePage} />
                  <Route path="/team/:id?" component={TeamPage} />
                  <Route path="/shop/:category?/:id?" component={ShopPage} />
                  <Route path="/rank" component={RankPage} />
                  <Route path="/profile/:id?" component={Profile} />
                </Router>
              </div>
            </div>
          </div>
        )}
      </PlayerContext.Consumer>
    );
  }
}
