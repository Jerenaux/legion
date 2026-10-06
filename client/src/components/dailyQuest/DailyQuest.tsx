import { h } from 'preact';
// DailyQuest.tsx
import './DailyQuest.style.css'
import { Component } from 'preact';
import BottomBorderDivider from '../bottomBorderDivider/BottomBorderDivider';
import QuestCard from '../questCard/QuestCard';
import Ghost from '../ghost/Ghost';

type Reward = {
  gold: number,
  xp: number
}

type Quest = {
  name: string,
  rewards: Reward,
  completion: number
}

interface QuestProps {
  questData: Quest[]
}

class DailyQuest extends Component<QuestProps> {

  render() {
    return (
      <div className="dailyQuestContainer">
        <BottomBorderDivider label='DAILY QUESTS' />
        {this.props.questData ? <div className="dailyQuests">
          {this.props.questData.map((quest) => <QuestCard quest={quest} />)}
        </div> : <Ghost height={100} />}
      </div>
    );
  }
}

export default DailyQuest;