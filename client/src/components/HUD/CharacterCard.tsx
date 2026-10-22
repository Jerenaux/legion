import {t, formatNumber} from '../../i18n/core';

import { h, Fragment } from 'preact';
import { Component } from 'preact';
import { route, getCurrentUrl } from 'preact-router';

import { Class, ClassLabels } from '@legion/shared/enums';
import { APICharacterData, CharacterMatchStats, CharacterUpdate, PlayerNetworkData, TeamMember } from '@legion/shared/interfaces';
import CountUp from 'react-countup';
import { getXPThreshold, isMaxLevel } from '@legion/shared/levelling';
import { getSpritePath } from '../utils';
import './CharacterCard.style.css';

interface CountUpProps {
    member: TeamMember | PlayerNetworkData | APICharacterData;
    // Endgame props
    update?: CharacterUpdate;
    isWinner?: boolean;
    onLevelUp?: () => void;
    /** Set on the match's MVP: the card takes the centre of the podium and shows what they did. */
    mvp?: CharacterMatchStats;
    // Team reveal props
    hideXP?: boolean;
    isQuestionMark?: boolean;
    // Roser prop
    isClickable?: boolean;
    showSPBadge?: boolean;
}

interface CountUpState {
    isLevelUp: number;
    xpCounter: number;
    totalXP: number;
}

class CharacterCard extends Component<CountUpProps, CountUpState> {
    private timer: NodeJS.Timeout | null = null;
    state: CountUpState = {
        isLevelUp: 0,
        xpCounter: this.props.member.xp,
        totalXP: (this.props.update?.earnedXP || 0) + this.props.member.xp,
    }

    componentDidMount(): void {
        if (!this.props.hideXP && !this.props.isQuestionMark) {
            const baseInterval = Math.max(0.1, this.state.totalXP / 500);
            this.timer = setInterval(() => {
                const maxXP = getXPThreshold(this.props.member.level);

                if (this.state.totalXP > maxXP && this.state.xpCounter >= maxXP) {
                    this.setState(prevState => ({
                        isLevelUp: prevState.isLevelUp + 1,
                        xpCounter: 0,
                        totalXP: prevState.totalXP - maxXP
                    }));
                    this.props.onLevelUp?.();
                    return;
                }

                if (this.state.xpCounter >= this.state.totalXP) {
                    clearInterval(this.timer);
                    this.timer = null;
                } else {
                    const remainingXP = this.state.totalXP - this.state.xpCounter;
                    const interval = Math.min(baseInterval, remainingXP);
                    this.setState({ xpCounter: this.state.xpCounter + interval });
                }
            }, 10);
        }
    }

    componentWillUnmount(): void {
        if (this.timer) {
            clearInterval(this.timer);
        }
    }

    handleClick = () => {
        if (this.props.isClickable && 'id' in this.props.member) {
            route(`/team/${this.props.member.id}`);
        }
    };

    isSelected = () => {
        const currentPath = getCurrentUrl();
        const match = /^\/team\/([^/]+)/.exec(currentPath);
        if (!match) return false;

        const characterId = match[1];
        return 'id' in this.props.member && this.props.member.id === characterId;
    };

    render() {
        const { update, member, hideXP, isQuestionMark, isClickable, showSPBadge, mvp } = this.props;
        const maxXP = getXPThreshold(this.props.member.level);
        const isReceivingXP = update?.earnedXP > 0;
        const isResettingXP = this.state.xpCounter === 0;
        const isLevelingUp = this.state.isLevelUp > 0;

        if (isQuestionMark) {
            return (
                <div className="endgame_character question-mark-mode">
                    <div className="endgame_character_portrait">
                        <div className="question-mark">?</div>
                    </div>
                </div>
            );
        }

        const Card = isClickable ? 'button' : 'div';
        return (
            <Card type={isClickable ? 'button' : undefined} data-game-control={isClickable || undefined}
                className={`endgame_character ${isLevelingUp ? 'leveling-up' : ''} ${isClickable ? 'clickable' : ''} ${this.isSelected() ? 'selected' : ''} ${mvp ? 'is-mvp' : ''}`}
                data-character-id={member.id}
                data-class={Class[member.class]}
                onClick={this.handleClick}
            >
                {mvp && <>
                    <div className="endgame_mvp_rays" aria-hidden="true" />
                    <div className="endgame_mvp_crest">{t("MVP")}</div>
                </>}
                {showSPBadge && member.sp > 0 && (
                    <div className="endgame_character_sp_badge">{t("SP")}</div>
                )}

                {isLevelingUp &&
                    <div className="endgame_character_lvlup">{t("LVL UP!")}</div>
                }

                <div className="endgame_character_level">
                    <span>{t("Lvl")}</span> {formatNumber(member.level + this.state.isLevelUp)}
                </div>

                {!hideXP && (
                    <div className="endgame_character_level_container">
                        {isReceivingXP && (
                            <div className="endgame_character_xp_container">
                                <div className="endgame_character_xp_label">+{formatNumber(update.earnedXP)} {t("XP")}</div>
                                <div className="endgame_character_xp_bar">
                                    <div
                                        className={`endgame_character_xp_fill ${isResettingXP ? 'reset' : ''}`}
                                        style={{ width: isMaxLevel(member.level) ? '100%' : `${(this.state.xpCounter / maxXP) * 100}%` }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="endgame_character_portrait">
                    <div
                        className={`char_portrait ${this.props.isWinner ? 'victory-animation' : ''}`}
                        style={{
                            backgroundImage: `url(${getSpritePath(member.portrait)})`,
                        }}
                    />
                </div>

                <div className="endgame_character_name">{member.name}</div>
                <div className="endgame_character_class">{t(ClassLabels[member.class])}</div>
                {mvp && <dl className="endgame_mvp_stats">
                    {[
                        {label: t("KOs"), value: mvp.kills, show: true},
                        {label: t("Damage"), value: mvp.damage, show: mvp.damage > 0 || mvp.healing === 0},
                        {label: t("Healing"), value: mvp.healing, show: mvp.healing > 0},
                    ].filter(stat => stat.show).map((stat, index) => (
                        <div key={stat.label} style={{'--stat-index': index}}>
                            <dt>{stat.label}</dt>
                            <dd><CountUp end={stat.value} duration={1.1} delay={0.9 + index * 0.15} formattingFn={formatNumber} /></dd>
                        </div>
                    ))}
                </dl>}
            </Card>
        );
    }
}

export default CharacterCard;