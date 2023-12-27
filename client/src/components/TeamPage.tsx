// PlayPage.tsx
import { h, Component } from 'preact';
import { Router, Route } from 'preact-router';

import Roster from './Roster';
import Character from './Character';
import Inventory from './Inventory';

interface TeamPageProps {
  matches: {
    id: string;
  };
}

class TeamPage extends Component<TeamPageProps> {
  state = { characterId: '' };

  setCharacterId = (id: string) => {
    this.setState({ characterId: id });
  };

  render() {
    return (
        <div>
          <div className="page-header">
            <img src="/assets/team.png" className="page-icon" />
            <h1 className="page-title">Team</h1>
          </div>
          <div className="team-content">
            <Roster />
            <div className="character-inventory-container">
              <Router>
                <Route path="/team/:id" component={Character} />
              </Router>
              <Inventory />
            </div>
          </div>
        </div>
      );
  }
}

export default TeamPage;