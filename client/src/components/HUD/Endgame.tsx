import {t, formatNumber, localizedAsset, language} from '../../i18n/core';

import { h } from 'preact';
import { Component } from 'preact';
import { useWindowSize } from '@react-hook/window-size';
import CountUp from 'react-countup';
import { CharacterUpdate, GameOutcomeReward, TeamMember } from '@legion/shared/interfaces';
import CharacterCard from './CharacterCard';
import { ChestColor, InventoryType, PlayMode, RewardType } from '@legion/shared/enums';
import { ItemTooltip } from '../ItemTooltipContent';
import OpenedChest from '../dailyLoot/OpenedChest';
import { route } from 'preact-router';
import { events } from './GameHUD';
import './Endgame.style.css';
import _lockIcon from '@assets/lock.png';
import { PlayerContext } from '../../contexts/PlayerContext';
import { EventEmitter } from 'eventemitter3';

// Asset imports
import victoryBg from '@assets/game_end/victory_bg.png';
import defeatBg from '@assets/game_end/defeat_bg.png';
import victoryTitleOriginal from '@assets/game_end/victory.png';
import defeatTitleOriginal from '@assets/game_end/defeat.png';
import xpIcon from '@assets/game_end/XP_icon.png';
import goldIcon from '@assets/gold_icon.png';
import { mapFrameToCoordinates } from '../utils';
import { getRewardObject } from '../utils';
import { getRewardBgImage } from '../utils';
import {shouldShowUnlockMessage} from './endgameUnlock';

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
    members: TeamMember[];
    chests: GameOutcomeReward[];
    chestKey: ChestColor;
    game0: boolean;
    mode: PlayMode;
    eventEmitter: EventEmitter;
    closeGame: () => void;
}

interface Reward {
    type: string;
    id?: number;
    amount: number;
    icon: string;
    backgroundImage?: string;
    coordinates?: { x: number; y: number };
}

// Reward tiles share the inventory tooltip; XP and gold have their own short explanations.
function rewardTooltipType(type: string) {
    if (type === 'XP') return 'xp';
    if (type === 'GOLD' || type === RewardType.GOLD) return 'gold';
    if (type === RewardType.EQUIPMENT) return InventoryType.EQUIPMENTS;
    if (type === RewardType.SPELL) return InventoryType.SPELLS;
    if (type === RewardType.CONSUMABLES) return InventoryType.CONSUMABLES;
    return undefined;
}

export class Endgame extends Component<EndgameProps, EndgameState> {
    events: EventEmitter;
    static contextType = PlayerContext;

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
        if (this.props.mode in modesToQueueMap) {
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

    getRewardsList() {
        // Start with XP and gold rewards
        const rewards: Reward[] = [
            { type: 'XP', amount: this.state.finalXp, icon: xpIcon },
            { type: 'GOLD', amount: this.state.finalGold, icon: goldIcon }
        ];

        // Add flattened chest contents if player won
        if (this.props.isWinner && this.props.chests) {
            this.props.chests.forEach(chest => {
                if (chest.content) {
                    chest.content.forEach(reward => {
                        const rewardObject = getRewardObject(reward.type, reward.id);
                        const backgroundImageUrl = getRewardBgImage(reward.type);
                        rewards.push({
                            type: reward.type,
                            id: reward.id,
                            amount: reward.amount,
                            icon: backgroundImageUrl,
                            coordinates: rewardObject ? mapFrameToCoordinates(rewardObject.frame) : { x: 0, y: 0 }
                        });
                    });
                }
            });
        }

        return rewards;
    }

    render() {
        const victoryTitle = localizedAsset('game_end/victory.png', language === 'en' ? victoryTitleOriginal : '');
        const defeatTitle = localizedAsset('game_end/defeat.png', language === 'en' ? defeatTitleOriginal : '');
        const [width, height] = useWindowSize()
        const { members, characters } = this.props;
        const showPlayAgain = !this.props.game0 && this.props.mode !== PlayMode.CASUAL_VS_FRIEND;

        return (
            <div className={`endgame ${this.props.isWinner ? 'is-victory' : 'is-defeat'}`}>
                <div className="defeat_title" style={this.endGameTitleBg()}>
                    {(this.props.isWinner ? victoryTitle : defeatTitle)
                      ? <img className="defeat_title_bg" src={this.props.isWinner ? victoryTitle : defeatTitle} alt={t(this.props.isWinner ? "Victory!" : "Defeat")} />
                      : <div className="defeat_title_bg localized-result">{t(this.props.isWinner ? "Victory!" : "Defeat")}</div>}
                </div>

                <div className="endgame_characters_grid">
                    {characters.map((character) => (
                        <CharacterCard
                            member={members[character.num - 1]}
                            update={character as CharacterUpdate}
                            isWinner={this.props.isWinner}
                        />
                    ))}
                </div>

                <div className="endgame_rewards_container">
                    <div className="endgame_rewards_heading_container">
                        <svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" fill="none" height="24" width="24" style={{ transform: 'scaleX(-1)' }}><path d="M18.353 10.252L6.471 3.65c-1.323-.736-1.985-1.103-2.478-.813S3.5 3.884 3.5 5.398V18.6c0 1.514 0 2.271.493 2.561s1.155-.077 2.478-.813l11.882-6.6c1.392-.774 2.088-1.16 2.088-1.749 0-.588-.696-.975-2.088-1.748z" fill="#FFA600" /></svg>
                        <p className="endgame_rewards_heading">{t("Rewards")}</p>
                        <svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" fill="none" height="24" width="24"><path d="M18.353 10.252L6.471 3.65c-1.323-.736-1.985-1.103-2.478-.813S3.5 3.884 3.5 5.398V18.6c0 1.514 0 2.271.493 2.561s1.155-.077 2.478-.813l11.882-6.6c1.392-.774 2.088-1.16 2.088-1.749 0-.588-.696-.975-2.088-1.748z" fill="#FFA600" /></svg>
                    </div>
                    <div className="flex items_center justify_center gap_4 endgame_rewards_items">
                        {this.getRewardsList().map((reward, idx) => (
                            <button type="button" key={idx} className="streak_gold_list" style={{'--reveal-index': idx}}
                                data-tooltip-id="endgame-reward-details"
                                data-tooltip-item-type={rewardTooltipType(reward.type)}
                                data-tooltip-item-id={reward.id}>
                                {reward.type === 'XP' || reward.type === 'GOLD' ? (
                                    <div style={{ backgroundImage: `url(${reward.icon})`, backgroundSize: '100% 100%' }}></div>
                                ) : (
                                    <div style={{
                                        backgroundImage: `url(${reward.icon})`,
                                        backgroundPosition: `-${reward.coordinates.x}px -${reward.coordinates.y}px`,
                                        backgroundSize: reward.type === RewardType.GOLD ? '84% 100%' : ''
                                    }}></div>
                                )}
                                <div className="streak_gold_list_amount">
                                    {reward.type === 'XP' || reward.type === 'GOLD' ? (
                                        <CountUp end={reward.amount} duration={Math.min(reward.amount / 100, 2)} formattingFn={formatNumber} />
                                    ) : (
                                        formatNumber(reward.amount)
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                    <ItemTooltip id="endgame-reward-details" />
                </div>

                <div className="endgame_buttons">
                    {showPlayAgain && (
                        shouldShowUnlockMessage(this.props.mode, this.context.getCompletedGames()) ? (
                            <div className="endgame_unlock_message">
                                <img src={_lockIcon} className="shaking-lock" alt={t("Lock icon")} />
                                <span>{t("You unlocked something new in the main menu!")}</span>
                            </div>
                        ) : (
                            <button type="button" data-game-control
                                className="endgame_button endgame_button_primary"
                                onClick={this.handlePlayAgain}
                            >
                                <span>{t("Play Again!")}</span>
                            </button>
                        )
                    )}
                    <button type="button" data-game-control
                        className="endgame_button endgame_button_secondary"
                        onClick={this.props.closeGame}
                    >
                        <span>{t("Main Menu")}</span>
                    </button>
                </div>

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
