// QuestCard.tsx
import './QuestCard.style.css';
import { h, Component } from 'preact';

type Reward = {
    gold: number,
    xp: number
}

type Quest = {
    name: string,
    rewards: Reward,
    completion: number
}

interface CardProps {
    quest: Quest;
}

class QuestCard extends Component<CardProps> {
    state = {
        active: false
    }
    render() {
        const data = this.props.quest;

        const bgStyle = {
            backgroundImage: `url(/quest_bg_${this.state.active ? 'active' : 'idle'}.png)`,
            cursor: 'pointer'
        }

        const chartStyle = {
            backgroundImage: `conic-gradient(#49d7d8 0% ${data.completion * 100}%, #1c1f25 ${data.completion * 100}%)`,
        }

        return (
            <div className="questCardContainer" style={bgStyle} onMouseEnter={() => this.setState({active: true})} onMouseLeave={() => this.setState({active: false})}>
                <div className="questInfoContainer">
                    <span className="fireSpells">{data.name}</span>
                    <span>Rewards</span>
                    <p><span className="questGold">{data.rewards.gold}</span> GOLD | <span className="questExp">{data.rewards.xp}</span> EXP</p>
                </div>
                {data.completion === 1 ? <div className="completion"></div> : <div className="chartContainer" style={chartStyle}>
                    <div className="chartVal"><span>{data.completion * 100}%</span></div>
                </div>}
            </div>
        );
    }
}

export default QuestCard;