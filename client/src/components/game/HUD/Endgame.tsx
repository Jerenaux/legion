import { h, Component } from 'preact';
import { route } from 'preact-router';
import Confetti from 'react-confetti'
import { useWindowSize } from '@react-hook/window-size';
import CountUp from 'react-countup';

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
    isWinner: boolean;
}
export class Endgame extends Component<EndgameProps, EndgameState> {
    constructor(props) {
        super(props);
        this.state = {
            finalGold: props.goldReward,
            finalXp: props.xpReward,
            displayGold: 0, // These are for display and will be incremented
            displayXp: 0,
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

    endGameTitleBg = () => {
        return {
            backgroundImage: this.props.isWinner ? 'url("/game_end/victory_bg.png")' : 'url("/game_end/defeat_bg.png")',
        }
    }

    render() {
        const [width, height] = useWindowSize()

        return (
            <div className="endgame">
                <div className="defeat_title" style={this.endGameTitleBg()}>
                    <img src={`/game_end/${this.props.isWinner ? 'Victory' : 'defeat'}.png`} alt="End Title" />
                </div>
                <div className="endgame_score_bg">
                    <div className="flex items_center gap_4">
                        <img src="/game_end/XP_icon.png" alt="XP" />
                        <span><CountUp end={this.state.finalXp} decimal=',' decimals={3} duration={Math.min(this.state.finalXp/100, 2)} /></span>
                    </div>
                    <div className="flex items_center gap_4">
                        <img src="/gold_icon.png" alt="XP" />
                        <span><CountUp end={this.state.finalGold} duration={Math.min(this.state.finalGold/100, 2)} /></span>
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
                {!this.props.isWinner && <div className="endgame_leave" onClick={this.closeGame}>
                    <span>Leave</span>
                </div>}
                {this.props.isWinner && <div className="light_streak_container">
                    <div className="light_streak" style={{width: width * 0.5}}>
                        <Confetti
                            width={width * 0.5}
                            height={height}
                        />
                        <div className="light_streak_chest">
                            <img src="/shop/gold_chest.png" alt="" />
                        </div>
                        <div className="light_shining_bg">
                            <img src="/game_end/shine_bg.png" alt="" />
                        </div>
                        <div className="streak_gold_list_container">
                            {Array.from({ length: 6 }, (_, idx) => (
                                <div className="streak_gold_list"></div>
                            ))}
                        </div>
                        <div className="streak_cofirm_container" style={{width: width * 0.8}} onClick={this.closeGame}>
                            <div className="streak_confirm_btn"><span>Confirm</span></div>
                        </div>
                    </div>
                </div>}
            </div>
        );
    }
}