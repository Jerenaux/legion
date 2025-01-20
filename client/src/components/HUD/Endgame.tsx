import { h, Component } from 'preact';
import { useWindowSize } from '@react-hook/window-size';
import CountUp from 'react-countup';
import { CharacterUpdate, GameOutcomeReward } from '@legion/shared/interfaces';
import XPCountUp from './XPCountUp';
import { ChestColor, PlayMode } from '@legion/shared/enums';
import OpenedChest from '../dailyLoot/OpenedChest';
import { route } from 'preact-router';
import { events } from './GameHUD';
import './Endgame.style.css';

// Asset imports
import victoryBg from '@assets/game_end/victory_bg.png';
import defeatBg from '@assets/game_end/defeat_bg.png';
import victoryTitle from '@assets/game_end/Victory.png';
import defeatTitle from '@assets/game_end/defeat.png';
import gradeA from '@assets/game_end/A.png';
import gradeB from '@assets/game_end/B.png';
import gradeC from '@assets/game_end/C.png';
import gradeD from '@assets/game_end/D.png';
import gradeE from '@assets/game_end/E.png';
import gradeF from '@assets/game_end/F.png';
import gradeS from '@assets/game_end/S.png';
import gradeSp from '@assets/game_end/S+.png';
import xpIcon from '@assets/game_end/XP_icon.png';
import goldIcon from '@assets/gold_icon.png';
import bronzeChest from '@assets/shop/bronze_chest.png';
import silverChest from '@assets/shop/silver_chest.png';
import goldChest from '@assets/shop/gold_chest.png';
import silverKeyIcon from '@assets/shop/silver_key_icon.png';

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
    game0: boolean;
    mode: PlayMode;
    eventEmitter: any;
    closeGame: () => void;
}

export class Endgame extends Component<EndgameProps, EndgameState> {
    events: any;

    constructor(props) {
        super(props);
        this.state = {
            finalGold: props.goldReward,
            finalXp: props.xpReward,
            displayGold: 0,
            displayXp: 0,
            countedXP: 0,
            selectedChest: null,
        };
        this.events = this.props.eventEmitter;
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

    handlePlayAgain = () => {
        const modesToQueueMap = {
            [PlayMode.PRACTICE]: PlayMode.PRACTICE,
            [PlayMode.CASUAL]: PlayMode.CASUAL,
            [PlayMode.CASUAL_VS_AI]: PlayMode.CASUAL,
            [PlayMode.RANKED]: PlayMode.RANKED,
            [PlayMode.RANKED_VS_AI]: PlayMode.RANKED,
        }
        events.emit('exitGame');
        // If mode not in map, redirect to /play
        if (modesToQueueMap[this.props.mode]) {
            route(`/queue/${modesToQueueMap[this.props.mode]}`);
        } else {
            route('/play');
        }
    }

    endGameTitleBg = () => {
        return {
            backgroundImage: this.props.isWinner ? `url(${victoryBg})` : `url(${defeatBg})`,
        }
    }

    getGradeImage = (grade: string) => {
        switch (grade) {
            case 'A': return gradeA;
            case 'B': return gradeB;
            case 'C': return gradeC;
            case 'D': return gradeD;
            case 'E': return gradeE;
            case 'F': return gradeF;
            case 'S': return gradeS;
            case 'S+': return gradeSp;
            default: return '';
        }
    }

    getChestImage = (color: ChestColor) => {
        switch (color) {
            case ChestColor.BRONZE: return bronzeChest;
            case ChestColor.SILVER: return silverChest;
            case ChestColor.GOLD: return goldChest;
            default: return '';
        }
    }

    render() {
        const [width, height] = useWindowSize()
        const { members, characters } = this.props;
        const isGame0 = this.props.game0;
        const grade = isGame0 ? 'A' : this.props.grade;

        const showPlayAgain = !this.props.game0 && 
            this.props.mode !== PlayMode.CASUAL_VS_FRIEND && 
            this.props.mode !== PlayMode.STAKED;

        return (
            <div className="endgame">
                <div className="defeat_title" style={this.endGameTitleBg()}>
                    <img className="defeat_title_bg" src={this.props.isWinner ? victoryTitle : defeatTitle} alt="End Title" />
                    {this.props.isWinner && <img className="defeat_title_effect" src={this.getGradeImage(grade)} alt="" />}
                </div>
                <div className="endgame_score_bg">
                    <div className="flex items_center gap_4">
                        <img src={xpIcon} alt="XP" />
                        <span><CountUp end={this.state.finalXp} duration={Math.min(this.state.finalXp / 100, 2)} /></span>
                    </div>
                    <div className="flex items_center gap_4">
                        <img src={goldIcon} alt="Gold" />
                        <span><CountUp end={this.state.finalGold} duration={Math.min(this.state.finalGold / 100, 2)} /></span>
                    </div>
                </div>

                {isGame0 && <div className="endgame_meet_team_msg">You earned your first 3 characters!</div>}

                <div className="flex flex_wrap gap_16 justify_center items_center max_w_lg endgame_characters_grid">
                    {characters.map((character, idx) => (
                        <XPCountUp
                            member={members[character.num - 1]}
                            character={character as CharacterUpdate}
                            memberIdx={idx}
                        />
                    ))}
                </div>

                {this.props.isWinner && this.props.chests.length > 0 && (
                // {this.props.isWinner && (
                    <div className="endgame_rewards_container">
                        <div className="endgame_rewards_heading_container">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" height="24" width="24"><path d="M18.353 10.252L6.471 3.65c-1.323-.736-1.985-1.103-2.478-.813S3.5 3.884 3.5 5.398V18.6c0 1.514 0 2.271.493 2.561s1.155-.077 2.478-.813l11.882-6.6c1.392-.774 2.088-1.16 2.088-1.749 0-.588-.696-.975-2.088-1.748z" fill="#FFA600" /></svg>
                            <p className="endgame_rewards_heading">Rewards</p>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" height="24" width="24"><path d="M18.353 10.252L6.471 3.65c-1.323-.736-1.985-1.103-2.478-.813S3.5 3.884 3.5 5.398V18.6c0 1.514 0 2.271.493 2.561s1.155-.077 2.478-.813l11.882-6.6c1.392-.774 2.088-1.16 2.088-1.749 0-.588-.696-.975-2.088-1.748z" fill="#FFA600" /></svg>
                        </div>
                        <div className="flex items_center justify_center gap_4 endgame_rewards_items">
                            {this.props.chests.map((chest, idx) => (
                                <div key={idx} className="streak_gold_list" onClick={() => this.setState({ selectedChest: chest })}>
                                    <img src={this.getChestImage(chest.color)} alt="" />
                                </div>
                            ))}
                            {/* {this.props.chestKey && <div className="streak_gold_list">
                                <img src={silverKeyIcon} alt="" />
                            </div>} */}
                        </div>
                    </div>
                )}

                {/* <div className="endgame_buttons">
                    {showPlayAgain && (
                        <div 
                            className="endgame_button endgame_button_primary"
                            onClick={this.handlePlayAgain}
                        >
                            <span>Play Again!</span>
                        </div>
                    )}
                    <div 
                        className="endgame_button endgame_button_secondary"
                        onClick={this.props.closeGame}
                    >
                        <span>Main Menu</span>
                    </div>
                </div> */}

                {!!this.state.selectedChest && <OpenedChest 
                    width={width}
                    height={height}
                    color={this.state.selectedChest.color}
                    content={this.state.selectedChest.content}
                    onClick={() => this.setState({ selectedChest: null })}
                />}
            </div>
        );
    }
}