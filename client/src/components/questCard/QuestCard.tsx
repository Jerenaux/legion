// QuestCard.tsx
import './QuestCard.style.css';
import { h, Component } from 'preact';

interface CardProps {
    percent: number;
}

class QuestCard extends Component<CardProps> {
    render() {

        return (
            <div className="questCardContainer">
                <div className="questInfoContainer">
                    <span className="fireSpells">Use 5 Fire spells</span>
                    <span>Rewards</span>
                    <p><span className="questGold">500</span> GOLD | <span className="questExp">2000</span> EXP</p>
                </div>
                {this.props.percent === 100 ? <div className="completion"></div> : <div className="chartContainer">
                    <div className="chartVal"><span>{this.props.percent}%</span></div>
                </div>}
            </div>
        );
    }
}

export default QuestCard;