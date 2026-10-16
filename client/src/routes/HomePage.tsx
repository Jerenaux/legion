import { h } from 'preact';
import {useContext, useEffect} from "preact/hooks";
import {route, Route, Router} from "preact-router";

import {PlayerContext} from "../contexts/PlayerContext";
import Navbar from "../components/navbar/Navbar";
import PlayPage from "../components/PlayPage";
import Profile from "../components/profile/Profile";
import QueuePage from "../components/QueuePage";
import RankPage from "../components/RankPage";
import ShopPage from "../components/ShopPage";
import TeamPage from "../components/TeamPage";
import TowerPage from "../components/TowerPage";
import GuidePage from "../components/GuidePage";
import CommunityPage from "../components/community/CommunityPage";

export default function HomePage() {
  const {player, firstMatchCompleted} = useContext(PlayerContext);
  const needsTutorial = !firstMatchCompleted && (player.engagementStats?.completedGames || 0) === 0;

  useEffect(() => {
    // Keep link dialogs on the title screen; its Play button starts the first match.
    if (player.isLoaded && needsTutorial) route('/', true);
  }, [player.isLoaded, needsTutorial]);

  // Do not mount menus or matchmaking before the account's progress is known.
  if (!player.isLoaded || needsTutorial) return null;

  return (
    <div className="homePage">
      <Navbar playerData={player} />
      <div className="content">
        <div className="mainContent">
          <Router>
            <Route path="/play" component={PlayPage} />
            <Route path="/tower" component={TowerPage} />
            <Route path="/guide" component={GuidePage} />
            <Route path="/queue/:mode" component={QueuePage} />
            <Route path="/lobby/:id" component={QueuePage} />
            <Route path="/team/:id?" component={TeamPage} />
            <Route path="/shop/:category?/:id?" component={ShopPage} />
            <Route path="/rank" component={RankPage} />
            <Route path="/profile/:id?" component={Profile} />
            <Route path="/community/:id" component={CommunityPage} />
          </Router>
        </div>
      </div>
    </div>
  );
}
