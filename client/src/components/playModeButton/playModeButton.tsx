import {t, i18n} from '../../i18n/core';
import {Trans} from '../../i18n/Trans';
import { h, Fragment } from 'preact';
import './playModeButton.style.css'
import { Component, ComponentChildren } from 'preact';
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
    unlockProgress?: {completed: number; required: number};
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

const PIPS = {low: 1, medium: 2, high: 3};

// Reward level as text plus a pip meter, so the comparison reads without relying on color.
function RewardRow({label, level}: {label: ComponentChildren; level?: ModeInfo['xpRewards']}) {
    const pips = PIPS[level];
    return (
        <div className="info-row">
            <span className="info-label">{label}</span>
            <span className={`info-value ${level}`}>
                {pips && <span className="reward-pips" aria-hidden="true">{[1, 2, 3].map(pip => <i key={pip} className={pip <= pips ? 'is-on' : ''} />)}</span>}
                {t(level)}
            </span>
        </div>
    );
}

class PlayModeButton extends Component<Props> {
    handleCardClick = () => {
        route(this.props.mode === PlayMode.TOWER ? '/tower' : `/queue/${this.props.mode}`);
    }

    render() {
        const { label, players, mode, disabled, lockIcon, gamesUntilUnlock, unlockProgress, ...otherProps } = this.props;
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
                {mode === PlayMode.TOWER && !disabled && <span className="tower-mode-tag">{t("6-floor adventure")}</span>}
                <img
                    src={btnIcons[label]}
                    alt={t(label)}
                    className="mode-icon"
                />
                <div className="labelContainer">
                    <span className="label">{t(label)}</span>
                    {!disabled && (
                        mode === PlayMode.TOWER ? <span className="player">{t("Solo expedition")}</span> : mode === PlayMode.PRACTICE
                            ? <span className="player">{t("vs AI")}</span>
                            : (players && <span className="player"><Trans i18n={i18n} i18nKey="playersWaiting" count={players} components={[<span className="count" />]} /></span>)
                    )}
                    <div className="info-container">
                        {disabled ? (
                            <div className="lock-container">
                                <img
                                    src={lockIcon}
                                    alt={t("Locked")}
                                    className="lock-icon"
                                />
                                {unlockProgress && <div className="unlock-message">{t("Unlocks after {{required}} completed matches · {{completed}}/{{required}}", unlockProgress)}</div>}
                                {gamesUntilUnlock > 0 && (
                                    <div className="unlock-message">{t("gamesToUnlock", {count: gamesUntilUnlock})}</div>
                                )}
                            </div>
                        ) : (
                            <>
                            <RewardRow label={<Trans i18n={i18n} i18nKey={"<0/>XP:"} components={[<img src={xpIcon} alt="" className="reward-icon" />]} />} level={modeInfo?.xpRewards} />
                            <RewardRow label={<Trans i18n={i18n} i18nKey={"<0/>Gold:"} components={[<img src={goldIcon} alt="" className="reward-icon" />]} />} level={modeInfo?.goldRewards} />
                            <div className="info-row">
                                <span className="info-label"><Trans i18n={i18n} i18nKey={"<0/>Items:"} components={[<img src={goldChest} alt="" className="reward-icon" />]} /></span>
                                <span className={`info-value ${modeInfo?.itemRewards ? 'yes' : 'no'}`}>{modeInfo?.itemRewards ? t('Yes') : t('No')}</span>
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
