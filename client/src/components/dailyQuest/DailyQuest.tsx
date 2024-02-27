// DailyQuest.tsx
import './DailyQuest.style.css'
import { h, Component } from 'preact';
import { route } from 'preact-router';
import BottomBorderDivider from '../bottomBorderDivider/BottomBorderDivider';
import QuestCard from '../questCard/QuestCard';

class DailyQuest extends Component {

  render() {
    return (
      <div className="dailyQuestContainer">
        <BottomBorderDivider label='DAILY QUESTS' />
        <div className="dailyQuests">
            <QuestCard percent={100} />
            <QuestCard percent={45} />
            <QuestCard percent={45} />
        </div>
      </div>
    );
  }
}

export default DailyQuest;