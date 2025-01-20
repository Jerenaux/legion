// XPCountUp.tsx
import { h, Component } from 'preact';

import { ClassLabels } from '@legion/shared/enums';
import { CharacterUpdate } from '@legion/shared/interfaces';
import { getXPThreshold } from '@legion/shared/levelling';
import { getSpritePath } from '../utils';

interface CountUpProps {
    member: any;
    character: CharacterUpdate;
    memberIdx: number;
    isWinner: boolean;
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
        xpCounter: this.props.member.xp, // How much XP before starting the count up
        totalXP: this.props.character.earnedXP + this.props.member.xp,
    }

    componentDidMount(): void { 
        const interval = Math.max(0.1, this.state.totalXP / 500);
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
                this.setState({ xpCounter: this.state.xpCounter + interval });
            }
        }, 10);
    }

    componentWillUnmount(): void {
        if (this.timer) {
            clearInterval(this.timer);
        }
    }

    render() {
        const { character, member, memberIdx } = this.props;
        const maxXP = getXPThreshold(this.props.member.level); 

        return (
            <div className="endgame_character">
                {this.state.isLevelUp > 0 && 
                    <div className="endgame_character_lvlup">LEVEL UP!</div>
                }
                
                <div className="endgame_character_level_container">
                    <div className="endgame_character_level">
                        Level {member.level + this.state.isLevelUp}
                    </div>
                    <div className="endgame_character_xp_bar">
                        <div 
                            className="endgame_character_xp_fill"
                            style={{ width: `${(this.state.xpCounter / maxXP) * 100}%` }}
                        />
                    </div>
                </div>

                <div className="endgame_character_portrait">
                    <div 
                        className={`char_portrait ${this.props.isWinner ? 'victory-animation' : ''}`} 
                        style={{
                            backgroundImage: `url(${getSpritePath(member.texture)})`,
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