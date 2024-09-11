// PlayPage.tsx
import { h, Component } from 'preact';
import Roster from './roster/Roster';
import PlayModes from './playModes/PlayModes';
import OnGoingArena from './onGoingArena/OnGoingArena';
import DailyQuest from './dailyQuest/DailyQuest';
import DailyLoot from './dailyLoot/DailyLoot';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css'
import { PlayerContext } from '../contexts/PlayerContext';
import { manageHelp } from './utils';
import { ENABLE_QUESTS, ENABLE_SPECTATOR_MODE } from "@legion/shared/config";
import { firebaseAuth } from '../services/firebaseService'; 
import Welcome from './welcome/Welcome';

/* eslint-disable react/prefer-stateless-function */
class PlayPage extends Component {
  static contextType = PlayerContext; 

  state = {
    showWelcome: false,
  };

  componentDidMount() {
    const user = firebaseAuth.currentUser;
    
    this.setState({
      showWelcome: user?.isAnonymous && !this.context.welcomeShown,
    });
  }
  
  componentDidUpdate() {
    if (!this.context.player.isLoaded) return;
    if (!this.state.showWelcome) {
      manageHelp('play', this.context);
    }
  }

  hideWelcome = () => {
    this.setState({ showWelcome: false });
    this.context.markWelcomeShown();
    manageHelp('play', this.context);
  };

  render() {
    const data = {
      dailyQuests: [
        {
          name: "Use 5 fire spells",
          rewards: { gold: 500, xp: 2000 },
          completion: 0.8
        },
        {
          name: "Win 3 games",
          rewards: { gold: 700, xp: 1000 },
          completion: 1 // = completed
        },
        {
          name: "Use 5 fire spells",
          rewards: { gold: 500, xp: 2000 },
          completion: 0.8
        },
      ],
      ongoingGames: [
        {
          teamA: {
            name: "TeamA",
            teamSize: 6,
            aliveCharacters: 3,
          },
          teamB: {
            name: "TeamB",
            teamSize: 6,
            aliveCharacters: 5,
          },
          spectators: 5,
          duration: 412, // seconds
        },
        {
          teamA: {
            name: "TeamA",
            teamSize: 6,
            aliveCharacters: 3,
          },
          teamB: {
            name: "TeamB",
            teamSize: 6,
            aliveCharacters: 5,
          },
          spectators: 5,
          duration: 328, // seconds
        },
        {
          teamA: {
            name: "TeamA",
            teamSize: 6,
            aliveCharacters: 3,
          },
          teamB: {
            name: "TeamB",
            teamSize: 6,
            aliveCharacters: 5,
          },
          spectators: 5,
          duration: 621, // seconds
        }
      ]
    }

    return (
      <div className="play-content">
        {this.state.showWelcome && <Welcome onHide={this.hideWelcome} />}
        <Roster/>
        {data ? <PlayModes /> : <Skeleton
          height={50}
          count={2}
          highlightColor='#0000004d'
          baseColor='#0f1421'
          style={{ margin: '2px 146px', width: '1024px'}} />}
        <DailyLoot data={this.context.player.dailyloot} />
        {ENABLE_QUESTS && <DailyQuest questData={data.dailyQuests} />}
        {ENABLE_SPECTATOR_MODE && <OnGoingArena ongoingGameData={data.ongoingGames} />}
      </div>
    );
  }
}

export default PlayPage;