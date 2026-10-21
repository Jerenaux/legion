import {t, formatNumber, localizedAsset, language} from '../../i18n/core';

import { h } from 'preact';
import { Component } from 'preact';
import { useWindowSize } from '@react-hook/window-size';
import CountUp from 'react-countup';
import { CharacterMatchStats, CharacterUpdate, GameOutcomeReward, TeamMember } from '@legion/shared/interfaces';
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
    /** Rating change from a ranked match; zero otherwise. */
    eloChange: number;
    /** Comeback, Flawless, Ace: earned across the whole match. */
    honours: string[];
    teamStats?: CharacterMatchStats[];
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

const HONOURS: Record<string, {label: () => string; detail: () => string}> = {
    comeback: {label: () => t("Comeback!"), detail: () => t("Won after trailing by two characters.")},
    flawless: {label: () => t("Flawless"), detail: () => t("Won without losing a character.")},
    ace: {label: () => t("Ace"), detail: () => t("One character knocked out the whole enemy team.")},
};

/** The character who did the most: damage and healing, with each knockout worth a solid hit. */
function pickMVP(stats?: CharacterMatchStats[]) {
    const score = (entry: CharacterMatchStats) => entry.damage + entry.healing + entry.kills * 40;
    const best = stats?.reduce<CharacterMatchStats | null>((top, entry) => !top || score(entry) > score(top) ? entry : top, null);
    return best && score(best) > 0 ? best : null;
}

/** The MVP stands in the middle of the podium; the others flank it. */
function podiumOrder<T extends {num: number}>(characters: T[], mvp: number | undefined) {
    const others = characters.filter(character => character.num !== mvp);
    const star = characters.find(character => character.num === mvp);
    if (!star) return characters;
    const half = Math.ceil(others.length / 2);
    return [...others.slice(0, half), star, ...others.slice(half)];
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
            selectedChest: null,
        };
        this.events = this.props.eventEmitter;
    }

    private levelUpPlayed = false;

    /** One fanfare however many characters level up. */
    handleLevelUp = () => {
        if (this.levelUpPlayed) return;
        this.levelUpPlayed = true;
        this.events.emit('endgameLevelUp');
    };

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
        const mvp = pickMVP(this.props.teamStats);
        const honours = this.props.honours.filter(honour => HONOURS[honour]);

        return (
            <div className={`endgame ${this.props.isWinner ? 'is-victory' : 'is-defeat'}`}>
                <div className="defeat_title" style={this.endGameTitleBg()}>
                    {(this.props.isWinner ? victoryTitle : defeatTitle)
                      ? <img className="defeat_title_bg" src={this.props.isWinner ? victoryTitle : defeatTitle} alt={t(this.props.isWinner ? "Victory!" : "Defeat")} />
                      : <div className="defeat_title_bg localized-result">{t(this.props.isWinner ? "Victory!" : "Defeat")}</div>}
                </div>

                {honours.length > 0 && <ul className="endgame_honours" aria-label={t("Honours")}>
                    {honours.map((honour, index) => (
                        <li key={honour} className={`endgame_honour endgame_honour--${honour}`} style={{'--honour-index': index}}
                            title={HONOURS[honour].detail()}>
                            <strong>{HONOURS[honour].label()}</strong>
                            <span>{HONOURS[honour].detail()}</span>
                        </li>
                    ))}
                </ul>}

                <div className={`endgame_characters_grid ${mvp ? 'has-mvp' : ''}`}>
                    {podiumOrder(characters, mvp?.num).map((character) => (
                        <CharacterCard
                            key={character.num}
                            member={members[character.num - 1]}
                            update={character as CharacterUpdate}
                            isWinner={this.props.isWinner}
                            onLevelUp={this.handleLevelUp}
                            mvp={character.num === mvp?.num ? mvp : undefined}
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
                    {this.props.eloChange !== 0 && (this.props.mode === PlayMode.RANKED || this.props.mode === PlayMode.RANKED_VS_AI) && (
                        <p className="endgame_elo" data-trend={this.props.eloChange > 0 ? 'up' : 'down'}>
                            <span>{t("ELO")}</span>
                            <strong><CountUp start={0} end={this.props.eloChange} duration={1.2} delay={0.8}
                                formattingFn={value => `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatNumber(Math.abs(value))}`} /></strong>
                        </p>
                    )}
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
