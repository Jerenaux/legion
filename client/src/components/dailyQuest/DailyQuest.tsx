// DailyQuest.tsx
import './DailyQuest.style.css'
import { h, Component } from 'preact';
import { route } from 'preact-router';
import BottomBorderDivider from '../bottomBorderDivider/BottomBorderDivider';
import QuestCard from '../questCard/QuestCard';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css'

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
        </div> : <Skeleton
          height={100}
          count={1}
          highlightColor='#0000004d'
          baseColor='#0f1421'
          style={{ margin: '2px 0', width: '1024px' }} />}
      </div>
    );
  }
}

export default DailyQuest;