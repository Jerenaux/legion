// DailyQuest.tsx
import './DailyQuest.style.css'
import { h, Component } from 'preact';
import { route } from 'preact-router';
import BottomBorderDivider from '../bottomBorderDivider/BottomBorderDivider';
import QuestCard from '../questCard/QuestCard';

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
        <div className="dailyQuests">
          {this.props.questData.map((quest) => <QuestCard quest={quest} />)}
        </div>
      </div>
    );
  }
}

export default DailyQuest;