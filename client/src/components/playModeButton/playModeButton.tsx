import { Fragment } from 'preact';
import { h } from 'preact';
import './playModeButton.style.css'
import { Component } from 'preact';
import { route } from 'preact-router';
import PracticeIcon from '@assets/practice_icon.png';
import CasualIcon from '@assets/casual_icon.png';
import RankedIcon from '@assets/ranked_icon.png';
import TowerIcon from '@assets/tower_icon.png';
import { PlayMode } from '@legion/shared/enums';
import xpIcon from '@assets/game_end/XP_icon.png';
import goldIcon from '@assets/gold_icon.png';
import goldChest from '@assets/shop/gold_chest.png';

interface Props {
    label: string;
    players?: number;
    mode: PlayMode;
    disabled?: boolean;
    lockIcon?: string;
    'data-playmode'?: string;
    gamesUntilUnlock?: number;
}

interface ModeInfo {
    vsAI: boolean;
    xpRewards: 'low' | 'medium' | 'high' | 'scaling';
    goldRewards: 'low' | 'medium' | 'high' | 'scaling';
    itemRewards: boolean;
}

const modeInfoMap: Partial<Record<PlayMode, ModeInfo>> = {
    [PlayMode.TOWER]: {vsAI: true, xpRewards: 'scaling', goldRewards: 'scaling', itemRewards: true},
    [PlayMode.PRACTICE]: {
        vsAI: true,
        xpRewards: 'low',
        goldRewards: 'low',
        itemRewards: false
    },
    [PlayMode.CASUAL]: {
        vsAI: false,
        xpRewards: 'medium',
        goldRewards: 'medium',
        itemRewards: true
    },
    [PlayMode.RANKED]: {
        vsAI: false,
        xpRewards: 'high',
        goldRewards: 'high',
        itemRewards: true
    }
};

class PlayModeButton extends Component<Props> {
    handleCardClick = () => {
        route(this.props.mode === PlayMode.TOWER ? '/tower' : `/queue/${this.props.mode}`);
    }

    render() {
        const { label, players, mode, disabled, lockIcon, gamesUntilUnlock, ...otherProps } = this.props;
        const modeInfo = modeInfoMap[mode];

        const btnIcons = {
            practice: PracticeIcon,
            casual: CasualIcon,
            ranked: RankedIcon,
            tower: TowerIcon,
        }

        const handleClick = disabled ? undefined : this.handleCardClick;

        return (
            <button
                type="button"
                className={`buttonContainer ${disabled ? 'disabled' : ''} ${label === 'ranked' ? 'ranked' : ''} ${mode === PlayMode.TOWER ? 'tower-mode' : ''}`}
                onClick={handleClick}
                disabled={disabled}
                {...otherProps}
            >
                {mode === PlayMode.TOWER && <span className="tower-mode-tag">6-floor adventure</span>}
                <img
                    src={btnIcons[label]}
                    alt={label}
                    className="mode-icon"
                />
                <div className="labelContainer">
                    <span className="label">{mode === PlayMode.TOWER ? <>Cinder<br />Tower</> : label}</span>
                    {!disabled && (
                        mode === PlayMode.TOWER ? <span className="player">Solo expedition</span> : mode === PlayMode.PRACTICE
                            ? <span className="player">vs AI</span>
                            : (players && <span className="player"><span className="count">{players}</span> {players === 1 ? 'Player' : 'Players'} Queuing</span>)
                    )}
                    <div className="info-container">
                        {disabled ? (
                            <div className="lock-container">
                                <img
                                    src={lockIcon}
                                    alt="Locked"
                                    className="lock-icon"
                                />
                                {gamesUntilUnlock > 0 && (
                                    <div className="unlock-message">
                                        Play {gamesUntilUnlock} more {gamesUntilUnlock === 1 ? 'game' : 'games'} to unlock
                                    </div>
                                )}
                            </div>
                        ) : (
                            <>
                            <div className="info-row">
                                <span className="info-label"><img src={xpIcon} alt="XP" className="reward-icon" />XP:</span>
                                <span className={`info-value ${modeInfo?.xpRewards}`}>{modeInfo?.xpRewards?.charAt(0).toUpperCase() + modeInfo?.xpRewards?.slice(1)}</span>
                            </div>
                            <div className="info-row">
                                <span className="info-label"><img src={goldIcon} alt="Gold" className="reward-icon" />Gold:</span>
                                <span className={`info-value ${modeInfo?.goldRewards}`}>{modeInfo?.goldRewards?.charAt(0).toUpperCase() + modeInfo?.goldRewards?.slice(1)}</span>
                            </div>
                            <div className="info-row">
                                <span className="info-label"><img src={goldChest} alt="Items" className="reward-icon" />Items:</span>
                                <span className={`info-value ${modeInfo?.itemRewards ? 'high' : 'low'}`}>{modeInfo?.itemRewards ? 'Yes' : 'No'}</span>
                            </div>
                            </>
                        )}
                    </div>
                </div>
            </button>
        );
    }
}

export default PlayModeButton;
