// XPCountUp.tsx
import { Class } from '@legion/shared/enums';
import { CharacterUpdate } from '@legion/shared/interfaces';
import { getXPThreshold } from '@legion/shared/levelling';
import { h, Component } from 'preact';

interface CountUpProps {
    member: any;
    character: CharacterUpdate;
    memberIdx: number;
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
                <div className="endgame_character_lvl">
                    <span className="lvl">Lv</span>
                    <span>{member.level + this.state.isLevelUp}</span>
                </div>
                {this.state.isLevelUp > 0 && <div className="endgame_character_lvlup">
                    <span>LVL UP!</span>
                </div>}
                <div className="endgame_character_profile">
                    <div className="char_portrait" style={{
                        backgroundImage: `url(/sprites/${member.texture}.png)`,
                        marginLeft: 0,
                    }} />
                </div>
                <div className="endgame_character_info">
                    <p className="endgame_character_name">{member.name}</p>
                    <p className="endgame_character_class">{Class[member.class]}</p>
                    <div className="flex flex_col gap_4 width_full padding_top_8">
                        <div className="flex justify_between width_full">
                            <span className="endgame_character_exp">EXP</span>
                            <span className="endgame_character_expVal">
                                {Math.floor(this.props.character.earnedXP) > 0 ? `+${Math.floor(this.props.character.earnedXP)}`: ''}
                            </span>
                        </div>
                        <div className="endgame_character_exp_bg">
                            <div style={{ width: `${(this.state.xpCounter / maxXP) * 100}%` }}></div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

export default XPCountUp;