import { h, Component } from 'preact';
import { route } from 'preact-router';
import Confetti from 'react-confetti'
import { useWindowSize } from '@react-hook/window-size';
import CountUp from 'react-countup';
import { CharacterUpdate, GameOutcomeReward } from '@legion/shared/interfaces';
import XPCountUp from './XPCountUp';
import { mapFrameToCoordinates } from '../utils';
import { RewardType } from '@legion/shared/chests';
import { ChestColor } from '@legion/shared/enums';

/* eslint-disable react/prefer-stateless-function */
interface EndgameState {
    finalGold: number;
    finalXp: number;
    displayGold: number;
    displayXp: number;
    countedXP: number;
    selectedChest: GameOutcomeReward;
}

interface EndgameProps {
    xpReward: number;
    goldReward: number;
    isWinner: boolean;
    characters: CharacterUpdate[];
    members: any[];
    grade: string;
    chests: GameOutcomeReward[];
    chestKey: ChestColor;
}
export class Endgame extends Component<EndgameProps, EndgameState> {
    constructor(props) {
        super(props);
        this.state = {
            finalGold: props.goldReward,
            finalXp: props.xpReward,
            displayGold: 0, // These are for display and will be incremented
            displayXp: 0,
            countedXP: 0,
            selectedChest: null,
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

    getBgImageUrl = (rewardType: RewardType) => {
        switch (rewardType) {
            case RewardType.EQUIPMENT:
                return '/equipment.png';
            case RewardType.SPELL:
                return '/spells.png';
            case RewardType.CONSUMABLES:
                return '/consumables.png';
            case RewardType.GOLD:
                return '/gold_icon.png';
            }
    }

    render() {
        const [width, height] = useWindowSize()
        const { members, characters } = this.props;

        return (
            <div className="endgame">
                <div className="defeat_title" style={this.endGameTitleBg()}>
                    <img className="defeat_title_bg" src={`/game_end/${this.props.isWinner ? 'Victory' : 'defeat'}.png`} alt="End Title" />
                    {this.props.isWinner && <img className="defeat_title_effect" src={`/game_end/${this.props.grade}.png`} alt="" />}
                </div>
                <div className="endgame_score_bg">
                    <div className="flex items_center gap_4">
                        <img src="/game_end/XP_icon.png" alt="XP" />
                        <span><CountUp end={this.state.finalXp} duration={Math.min(this.state.finalXp / 100, 2)} /></span>
                    </div>
                    <div className="flex items_center gap_4">
                        <img src="/gold_icon.png" alt="XP" />
                        <span><CountUp end={this.state.finalGold} duration={Math.min(this.state.finalGold / 100, 2)} /></span>
                    </div>
                </div>
                <div className="flex flex_wrap gap_16 justify_center items_center max_w_lg" style={{ padding: '36px 48px', minHeight: '400px', alignItems: 'flex-start' }}>
                    {characters.map((character, idx) => (
                        <XPCountUp
                            member={members[character.num - 1]}
                            character={character}
                            memberIdx={idx}
                        />
                    ))}
                </div>

                {this.props.isWinner && <div className="endgame_rewards_container">
                    <div className="endgame_rewards_heading_container">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" height="24" width="24"><path d="M18.353 10.252L6.471 3.65c-1.323-.736-1.985-1.103-2.478-.813S3.5 3.884 3.5 5.398V18.6c0 1.514 0 2.271.493 2.561s1.155-.077 2.478-.813l11.882-6.6c1.392-.774 2.088-1.16 2.088-1.749 0-.588-.696-.975-2.088-1.748z" fill="#FFA600" /></svg>

                        <p className="endgame_rewards_heading">Rewards</p>

                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" height="24" width="24"><path d="M18.353 10.252L6.471 3.65c-1.323-.736-1.985-1.103-2.478-.813S3.5 3.884 3.5 5.398V18.6c0 1.514 0 2.271.493 2.561s1.155-.077 2.478-.813l11.882-6.6c1.392-.774 2.088-1.16 2.088-1.749 0-.588-.696-.975-2.088-1.748z" fill="#FFA600" /></svg>
                    </div>
                    <div className="flex items_center justify_center gap_4 endgame_rewards_items">
                        {this.props.chests.map((chest, idx) => (
                            <div key={idx} className="streak_gold_list" onClick={() => this.setState({ selectedChest: chest })}>
                                <img src={`/shop/${chest.color}_chest.png`} alt="" />
                            </div>
                        ))}
                        {/* {this.props.chestKey && <div className="streak_gold_list">
                            <img src={`/shop/silver_key_icon.png`} alt="" />
                        </div>} */}
                    </div>
                </div>}

                <div className="endgame_leave" onClick={this.closeGame}>
                    <span>Leave</span>
                </div>

                {!!this.state.selectedChest && <div className="light_streak_container">
                    <div className="light_streak" style={{ width: width * 0.5 }}>
                        <Confetti
                            width={width * 0.5}
                            height={height}
                        />
                        <div className="light_streak_chest">
                            <img src={`/shop/${this.state.selectedChest.color}_chest.png`} alt="" />
                        </div>
                        <div className="light_shining_bg">
                            <img src="/game_end/shine_bg.png" alt="" />
                        </div>
                        <div className="streak_gold_list_container">
                            {this.state.selectedChest.content.map((reward, idx) => { 
                                // console.log('rewardItem ', idx, reward); 
                                const coordinates = mapFrameToCoordinates(reward?.frame);
                                const backgroundImageUrl = this.getBgImageUrl(reward?.type);
                                return (
                                    <div key={idx} className="streak_gold_list">
                                        <div style={{
                                            backgroundImage: `url(${backgroundImageUrl})`,
                                            backgroundPosition: reward.type === RewardType.GOLD ? '' : `-${coordinates.x}px -${coordinates.y}px`,
                                            backgroundSize: reward.type === RewardType.GOLD && '84% 100%',
                                            }}></div>
                                    </div>
                                )
                            })}
                        </div>
                        <div className="streak_cofirm_container" style={{ width: width * 0.8 }} onClick={() => this.setState({ selectedChest: null })}>
                            <div className="streak_confirm_btn"><span>Confirm</span></div>
                        </div>
                    </div>
                </div>}
            </div>
        );
    }
}