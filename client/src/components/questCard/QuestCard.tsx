// QuestCard.tsx
import CountUp from 'react-countup';
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

        const keyframesCSS = `
            @keyframes pie-chart {
                50%,
                100% {
                    stroke-dasharray: ${data.completion * 100}, ${(1 - data.completion) * 100}, 0, 0;
                }
            }
        `;

        return (
            <div className="questCardContainer" style={bgStyle} onMouseEnter={() => this.setState({ active: true })} onMouseLeave={() => this.setState({ active: false })}>
                <div className="questInfoContainer">
                    <span className="fireSpells">{data.name}</span>
                    <span>Rewards</span>
                    <p><span className="questGold">{data.rewards.gold}</span> GOLD | <span className="questExp">{data.rewards.xp}</span> EXP</p>
                </div>
                {data.completion === 1 ? <div className="completion"></div> : <div className="chartContainer" style={keyframesCSS}>
                    <svg viewBox="0 0 63.6619772368 63.6619772368">
                        <style>
                            {`
                                @keyframes pie-chart {
                                    50%,
                                    100% {
                                        stroke-dasharray: ${data.completion * 100}, ${(1 - data.completion) * 100}, 0, 0;
                                    }
                                }
                            `}
                        </style>
                        <circle className="pie-chart" cx="31.8309886184" cy="31.8309886184" r="15.9154943092" />
                    </svg>
                    <div className="chartVal"><span><CountUp duration={3} end={data.completion * 100} />%</span></div>
                </div>}
            </div>
        );
    }
}

export default QuestCard;