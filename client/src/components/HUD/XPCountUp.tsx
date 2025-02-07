import { h, Component } from 'preact';
import { route, getCurrentUrl } from 'preact-router';

import { ClassLabels } from '@legion/shared/enums';
import { APICharacterData, CharacterUpdate, PlayerNetworkData, TeamMember } from '@legion/shared/interfaces';
import { getXPThreshold } from '@legion/shared/levelling';
import { getSpritePath } from '../utils';
import './CharacterCard.style.css';

interface CountUpProps {
    member: TeamMember | PlayerNetworkData | APICharacterData;
    // Endgame props
    update?: CharacterUpdate;
    isWinner?: boolean;        
    // Team reveal props
    hideXP?: boolean;
    isQuestionMark?: boolean;
    // Roser prop
    isClickable?: boolean;
}

interface CountUpState {
    isLevelUp: number;
    xpCounter: number;
    totalXP: number;
}

class XPCountUp extends Component<CountUpProps, CountUpState> {
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
        const { update, member, hideXP, isQuestionMark, isClickable } = this.props;
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

        return (
            <div 
                className={`endgame_character ${isLevelingUp ? 'leveling-up' : ''} ${isClickable ? 'clickable' : ''} ${this.isSelected() ? 'selected' : ''}`}
                onClick={this.handleClick}
            >
                {isLevelingUp && 
                    <div className="endgame_character_lvlup">LVL UP!</div>
                }
                
                <div className="endgame_character_level">
                    <span>Lvl</span> {member.level + this.state.isLevelUp}
                </div>
                
                {!hideXP && (
                    <div className="endgame_character_level_container">
                        {isReceivingXP && (
                            <div className="endgame_character_xp_container">
                                <div className="endgame_character_xp_label">XP</div>
                                <div className="endgame_character_xp_bar">
                                    <div 
                                        className={`endgame_character_xp_fill ${isResettingXP ? 'reset' : ''}`}
                                        style={{ width: `${(this.state.xpCounter / maxXP) * 100}%` }}
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
                <div className="endgame_character_class">{ClassLabels[member.class]}</div>
            </div>
        );
    }
}

export default XPCountUp;