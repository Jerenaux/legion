// Middle Button.tsx
import './playModeButton.style.css'
import { h, Component } from 'preact';
import { route } from 'preact-router';
import PracticeIcon from '@assets/practice_icon.png';
import CasualIcon from '@assets/casual_icon.png';
import RankedIcon from '@assets/ranked_icon.png';

interface ButtonProps {
    players?: number;
    label: string;
}

class PlayModeButton extends Component<ButtonProps> {
    state = {
        active: false
    }

    handleCardClick = () => {
        route(`/queue`);
    }
    
    render() {
        const btnBg = {
            backgroundImage: `url(./${this.props.label === 'ranked' ? 'special_btn_bg_' : 'middle_play_'}` + `${this.state.active ? 'active' : 'idle'}.png)`,
            cursor: 'pointer'
        };

        const playerSpanStyle = {
            color: `${this.state.active ? '#4ff4f6' : '#ffb653'}`
        }

        const btnIcons = {
            practice: PracticeIcon,
            casual: CasualIcon,
            ranked: RankedIcon
        }

        return (
            <div className="buttonContainer" style={btnBg} onMouseEnter={() => this.setState({active: true})} onMouseLeave={() => this.setState({active: false})} onClick={this.handleCardClick}>
                <img src={btnIcons[this.props.label]} alt="" />
                <div className="labelContainer">
                    <span className="label">{this.props.label}</span>
                    {this.props.players && <span className="player"><span style={playerSpanStyle}>{this.props.players}</span> Players Queuing</span>}
                </div>
            </div>
        );
    }
}

export default PlayModeButton;