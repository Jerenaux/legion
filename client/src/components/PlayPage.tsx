// PlayPage.tsx
import { h, Component } from 'preact';
import Roster from './roster/Roster';
import PlayModes from './playModes/PlayModes';
import OnGoingArena from './onGoingArena/OnGoingArena';
import DailyQuest from './dailyQuest/DailyQuest';
import DailyLootBox from './dailyLootBox/DailyLootBox';

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
      ],
      chests: {
        bronze: {
          countdown: 86400,
          hasKey: false,
        },
        silver: {
          countdown: 0,
          hasKey: false,
        },
        gold: {
          countdown: 0,
          hasKey: true,
        },
      }
    }

    return (
        <div className="play-content">
          <Roster />
          <PlayModes />
          <DailyLootBox data={data.chests} />
          <DailyQuest questData={data.dailyQuests} />
          <OnGoingArena ongoingGameData={data.ongoingGames} />
        </div>
      );
  }
}

export default PlayPage;