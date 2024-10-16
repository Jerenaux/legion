import './playModeButton.style.css'
import { h, Component } from 'preact';
import { route } from 'preact-router';
import PracticeIcon from '@assets/practice_icon.png';
import CasualIcon from '@assets/casual_icon.png';
import RankedIcon from '@assets/ranked_icon.png';
import SolanaIcon from '@assets/solana.png';
import specialBtnBgActive from '@assets/special_btn_bg_active.png';
import specialBtnBgIdle from '@assets/special_btn_bg_idle.png';
import middlePlayActive from '@assets/middle_play_active.png';
import middlePlayIdle from '@assets/middle_play_idle.png';
import { PlayMode } from '@legion/shared/enums';
import { apiFetch } from '../../services/apiService';

interface ButtonProps {
    players?: number;
    label: string;
    mode: PlayMode;
    isLobbies?: boolean;
}

class PlayModeButton extends Component<ButtonProps> {
    state = {
        active: false,
        lobbiesCount: null
    }

    componentDidMount() {
        if (this.props.isLobbies) {
            this.fetchLobbiesCount();
        }
    }

    fetchLobbiesCount = async () => {
        try {
            const data = await apiFetch('countLobbies');
            this.setState({ lobbiesCount: data.count });
        } catch (error) {
            console.error('Error fetching lobbies count:', error);
        }
    }

    handleCardClick = () => {
        if (this.props.mode == PlayMode.STAKED) {
            route(`/elysium`);
            return;
        } else {
            route(`/queue/${this.props.mode}`);
        }
    }
    
    render() {
        const btnBg = {
            backgroundImage: `url(${this.props.label === 'ranked'  || this.props.label === 'elysium'
                ? (this.state.active ? specialBtnBgActive : specialBtnBgIdle)
                : (this.state.active ? middlePlayActive : middlePlayIdle)
                })`,
            cursor: 'pointer'
        };

        const playerSpanStyle = {
            color: `${this.state.active ? '#4ff4f6' : '#ffb653'}`
        }

        const btnIcons = {
            practice: PracticeIcon,
            casual: CasualIcon,
            ranked: RankedIcon,
            elysium: SolanaIcon
        }

        return (
            <div id={`playmode_${this.props.mode}`} className="buttonContainer" style={btnBg} onMouseEnter={() => this.setState({active: true})} onMouseLeave={() => this.setState({active: false})} onClick={this.handleCardClick}>
                <img src={btnIcons[this.props.label]} alt="" />
                <div className="labelContainer">
                    <span className="label">{this.props.label}</span>
                    {this.props.isLobbies 
                        ? (this.state.lobbiesCount > 0 && <span className="player"><span style={playerSpanStyle}>{this.state.lobbiesCount}</span> Opponents Waiting</span>)
                        : (this.props.players && <span className="player"><span style={playerSpanStyle}>{this.props.players}</span> Players Queuing</span>)
                    }
                </div>
            </div>
        );
    }
}

export default PlayModeButton;