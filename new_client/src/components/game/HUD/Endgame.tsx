import { h, Component } from 'preact';
import { route } from 'preact-router';
/* eslint-disable react/prefer-stateless-function */
interface EndgameState {
    finalGold: number;
    finalXp: number;
    displayGold: number;
    displayXp: number;
}

interface EndgameProps {
    xpReward: number;
    goldReward: number;
}
export class Endgame extends Component<EndgameProps, EndgameState> {
    constructor(props) {
        super(props);
        this.state = {
            finalGold: props.goldReward, 
            finalXp: props.xpReward,
            displayGold: 0, // These are for display and will be incremented
            displayXp: 0
        };
    }

    componentDidMount() {
        const duration = 1500;
        this.animateValue("displayGold", 0, this.state.finalGold, duration);
        this.animateValue("displayXp", 0, this.state.finalXp, duration);
    }

    animateValue(displayKey, start, end, duration) {
        const range = end - start;
        const stepTime = 10; // time in ms between updates, can be adjusted
        const totalSteps = duration / stepTime;
        const increment = range / totalSteps;
    
        let current = start;
        const timer = setInterval(() => {
            current += increment;
            // Make sure we don't go beyond the target value
            if ((increment > 0 && current > end) || (increment < 0 && current < end)) {
                current = end;
            }
            this.setState({ [displayKey]: Math.round(current) });
    
            if (current === end) {
                clearInterval(timer);
            }
        }, stepTime);
    }

    closeGame = () => {
        route('/play');
    }

    render() {
        return (
            <div className="endgame">
                <div className="endgame-head">
                    <div className="endgame-title">Victory!</div>
                    <div className="endgame-rewards">
                        <div className="endgame-gold" title='Gold'>
                            <span className="endgame-gold-logo">G</span>
                            <span className="endgame-gold-value">{this.state.displayGold}</span>
                        </div>
                        <div className="endgame-xp" title='XP'>
                            <span className="endgame-xp-logo">XP</span>
                            <span className="endgame-xp-value">{this.state.displayXp}</span>
                        </div>
                    </div>
                </div>
                <i className="fa-solid fa-circle-xmark closebtn" onClick={this.closeGame}>X</i>
            </div>
        );
    }
}