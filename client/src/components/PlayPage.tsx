// PlayPage.tsx
import { h, Component } from 'preact';
import Roster from './roster/Roster';
import Button from './Button';
import MiddleBar from './middleBar/MiddleBar';
import OnGoingArena from './onGoingArena/OnGoingArena';

/* eslint-disable react/prefer-stateless-function */
class PlayPage extends Component {
  render() {

    const data = {
      dailyQuests: [
        {
          name: "Use 5 fire spells",
          rewards: {gold: 500, xp: 2000},
          completion: 0.8
        },
        {
          name: "Win 3 games",
          rewards: {gold: 700, xp: 1000},
          completion: 1 // = completed
        },
        {
          name: "Use 5 fire spells",
          rewards: {gold: 500, xp: 2000},
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
          duration: 900, // seconds
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
          duration: 900, // seconds
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
          duration: 900, // seconds
        }
      ]
    }

    return (
        <div className="play-content">
          <Roster />
          <MiddleBar />
          <OnGoingArena />
        </div>
      );
  }
}

export default PlayPage;