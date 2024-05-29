import { h, Component } from 'preact';
import { route } from 'preact-router';
import Confetti from 'react-confetti'
import { useWindowSize } from '@react-hook/window-size';

/* eslint-disable react/prefer-stateless-function */
interface EndgameState {
    finalGold: number;
    finalXp: number;
    displayGold: number;
    displayXp: number;
    isFailed: boolean;
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
            displayXp: 0,
            isFailed: false,
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
        const titleStyle = {
            color: this.state.isFailed ? '#FFA600' : '#65d6ff',
        }

        const [width, height] = useWindowSize()

        return (
            <div className="endgame">
                <div className="defeat_title">
                    <p style={titleStyle}>{this.state.isFailed ? 'DEFEAT' : 'VICTORY!'}</p>
                    {!this.state.isFailed && <span className="victory_title_effect">S+</span>}
                </div>
                <div className="endgame_score_bg">
                    <div className="flex items_center gap_4">
                        <img src="" alt="XP" />
                        <span>32.349</span>
                    </div>
                    <div className="flex items_center gap_4">
                        <img src="/gold_icon.png" alt="XP" />
                        <span>500</span>
                    </div>
                </div>
                <div className="flex flex_wrap gap_16 justify_center items_center max_w_lg" style={{ padding: '36px 48px' }}>
                    {Array.from({ length: 10 }, (_, idx) => (
                        <div className="endgame_character">
                            <div className="endgame_character_lvl">
                                <span className="lvl">Lv</span>
                                <span>10</span>
                            </div>
                            {idx === 6 && <div className="endgame_character_lvlup">
                                <span>LVL UP!</span>
                            </div>}
                            <div className="endgame_character_profile"></div>
                            <div className="endgame_character_info">
                                <p className="endgame_character_name">Character 01</p>
                                <p className="endgame_character_class">Warrior</p>
                                <div className="flex flex_col gap_4 width_full padding_top_8">
                                    <div className="flex justify_between width_full">
                                        <span className="endgame_character_exp">EXP</span>
                                        <span className="endgame_character_expVal">+92.230</span>
                                    </div>
                                    <div className="endgame_character_exp_bg">
                                        <div></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                {this.state.isFailed && <div className="endgame_leave">
                    <span>Leave</span>
                </div>}
                {this.state.isFailed && <div className="light_streak_container">
                    <div className="light_streak" style={{width: width * 0.5}}>
                        <Confetti
                            width={width * 0.5}
                            height={height}
                        />
                        <div className="light_streak_chest">
                            <img src="/shop/gold_chest.png" alt="" />
                        </div>
                        <div className="streak_gold_list_container">
                            {Array.from({ length: 6 }, (_, idx) => (
                                <div className="streak_gold_list"></div>
                            ))}
                        </div>
                        <div className="streak_cofirm_container" style={{width: width * 0.8}}>
                            <div className="streak_confirm_btn"><span>Confirm</span></div>
                        </div>
                    </div>
                </div>}
            </div>
        );
    }
}