import {t, i18n, localizedAsset, language} from '../../i18n/core';
import {Trans} from '../../i18n/Trans';

import { h } from 'preact';
// Navbar.tsx

import './navbar.style.css';
import './SettingsModalWrapper.css';
import { Component } from 'preact';
import { Link, useRouter } from 'preact-router';
import UserInfoBar from '../userInfoBar/UserInfoBar';
import { PlayerContextData } from '@legion/shared/interfaces';
import { successToast, errorToast, avatarContext, lockIcon } from '../utils';
import {reportProblem} from '../../telemetry';
import { ENABLE_PLAYER_LEVEL } from '@legion/shared/config';
import { SettingsModal } from '../settingsModal/SettingsModal';
import { PlayerContext } from '../../contexts/PlayerContext';
import { LockedFeatures } from "@legion/shared/enums";

import legionLogo from '@assets/logo.png';
import playIconOriginal from '@assets/play_btn_idle.png';
import playIconBlank from '@assets/localization/play_btn_idle.png';
import teamIconOriginal from '@assets/team_btn_idle.png';
import teamIconBlank from '@assets/localization/team_btn_idle.png';
import shopIconOriginal from '@assets/shop_btn_idle.png';
import shopIconBlank from '@assets/localization/shop_btn_idle.png';
import rankIconOriginal from '@assets/rank_btn_idle.png';
import rankIconBlank from '@assets/localization/rank_btn_idle.png';
import playActiveIconOriginal from '@assets/play_btn_active.png';
import playActiveIconBlank from '@assets/localization/play_btn_active.png';
import teamActiveIconOriginal from '@assets/team_btn_active.png';
import teamActiveIconBlank from '@assets/localization/team_btn_active.png';
import shopActiveIconOriginal from '@assets/shop_btn_active.png';
import shopActiveIconBlank from '@assets/localization/shop_btn_active.png';
import rankActiveIconOriginal from '@assets/rank-btn-active.png';
import rankActiveIconBlank from '@assets/localization/rank-btn-active.png';
import expandBtn from '@assets/expand_btn.png';
import helpIcon from '@assets/svg/help.svg';
import copyIcon from '@assets/svg/copy.svg';
import cogIcon from '@assets/svg/cog.svg';

const {version} = require('../../../package.json');

enum MenuItems {
    PLAY = 'PLAY',
    TEAM = 'TEAM',
    SHOP = 'SHOP',
    RANK = 'RANK'
}

enum Routes {
    HOME = '/',
    PLAY = '/play',
    TEAM = '/team',
    SHOP = '/shop',
    RANK = '/rank'
}

interface Props {
    playerData: PlayerContextData;
}

interface State {
    hovered: string;
    openDropdown: boolean;
    avatarUrl: string | null;
    isLoading: boolean;
    isSettingsModalOpen: boolean;
}

class Navbar extends Component<Props, State> {
    state: State = {
        hovered: '',
        openDropdown: false,
        avatarUrl: null,
        isLoading: true,
        isSettingsModalOpen: false,
    }

    constructor(props: Props) {
        super(props);
    }

    componentDidMount() {
        this.loadAvatar();
    }

    componentDidUpdate(prevProps: Readonly<Props>) {
        if (prevProps.playerData?.avatar !== this.props.playerData?.avatar) {
            this.loadAvatar();
        }
    }

    loadAvatar = () => {
        this.setState({ isLoading: true });
        const { avatar } = this.props.playerData;
        if (avatar !== '0') {
            try {
                const avatarUrl = avatarContext(`./${avatar}.png`);
                this.setState({ avatarUrl, isLoading: false });
            } catch (error) {
                console.error(`Failed to load avatar: ${avatar}.png`, error);
                this.setState({ isLoading: false });
            }
        }
    }

    copyIDtoClipboard = () => {
        const textToCopy = this.props.playerData.uid;
        navigator.clipboard.writeText(textToCopy).then(() => {
            successToast(t("Player ID {{value0}} copied!", {value0: textToCopy}));
        }).catch(err => {
            console.error('Failed to copy text: ', err);
        });
    };

    formatNumber = (number) => {
        return new Intl.NumberFormat(i18n.resolvedLanguage, {
          useGrouping: true,
          maximumFractionDigits: 2
        }).format(number);
    };

    toggleSettingsModal = () => {
        this.setState(prevState => ({ isSettingsModalOpen: !prevState.isSettingsModalOpen, openDropdown: false }));
    };

    render() {
        const playIcon = localizedAsset('play_btn_idle.png', language === 'en' ? playIconOriginal : playIconBlank);
        const teamIcon = localizedAsset('team_btn_idle.png', language === 'en' ? teamIconOriginal : teamIconBlank);
        const shopIcon = localizedAsset('shop_btn_idle.png', language === 'en' ? shopIconOriginal : shopIconBlank);
        const rankIcon = localizedAsset('rank_btn_idle.png', language === 'en' ? rankIconOriginal : rankIconBlank);
        const playActiveIcon = localizedAsset('play_btn_active.png', language === 'en' ? playActiveIconOriginal : playActiveIconBlank);
        const teamActiveIcon = localizedAsset('team_btn_active.png', language === 'en' ? teamActiveIconOriginal : teamActiveIconBlank);
        const shopActiveIcon = localizedAsset('shop_btn_active.png', language === 'en' ? shopActiveIconOriginal : shopActiveIconBlank);
        const rankActiveIcon = localizedAsset('rank-btn-active.png', language === 'en' ? rankActiveIconOriginal : rankActiveIconBlank);
        const route = useRouter();
        const dropdownContentStyle = {
            display: `${this.state.openDropdown ? 'block' : 'none'}`
        }

        const currentPage = (pageRoute: string) => {
            if (pageRoute === Routes.PLAY) {
                return route[0].url.includes(pageRoute) || route[0].url === Routes.HOME;
            }
            return route[0].url.includes(pageRoute);
        }

        return (
            <PlayerContext.Consumer>
                {playerContext => (
                                <div className="menu">
                                    <div className="flexContainer">
                                        <div className="logoContainer">
                                            <Link href="/play" className="gameLogo">
                                                <img src={legionLogo} alt={t("Legion Logo")} />
                                            </Link>
                                        </div>
                                        <Link href={`/profile/${this.props.playerData?.uid}`} className="avatarContainerLink">
                                            <div className="avatarContainer">
                                                {this.state.isLoading ? (
                                                    <div className="avatar spinner-container">
                                                        <div className="loading-spinner"></div>
                                                    </div>
                                                ) : (
                                                    <div className="avatar" style={{ backgroundImage: this.state.avatarUrl ? `url(${this.state.avatarUrl})` : 'none' }}></div>
                                                )}
                                                <div className="userInfo">
                                                    {this.state.isLoading ? (
                                                        <span className="loading-placeholder">{t("Loading...")}</span>
                                                    ) : (
                                                        <span>{this.props.playerData?.name}</span>
                                                    )}
                                                    {ENABLE_PLAYER_LEVEL && (
                                                        <div className="userLevel">
                                                            {this.state.isLoading ? (
                                                                <span className="loading-placeholder">{t("Lvl. --")}</span>
                                                            ) : (
                                                                <span>{t("Lvl. {{value0}}", {value0: this.props.playerData?.lvl})}</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </Link>
                                    </div>

                                    <div className="menuItems">
                                        <Link href="/play" onMouseOver={() => this.setState({ hovered: MenuItems.PLAY })} onMouseLeave={() => this.setState({ hovered: '' })}>
                                            <div className={`menuItemContainer ${currentPage(Routes.PLAY) ? 'activeFlag' : ''}`}>
                                                <img className="menuItem" src={this.state.hovered === MenuItems.PLAY ? playActiveIcon : playIcon} alt={t("Play")} />{language !== "en" && !localizedAsset(this.state.hovered === MenuItems.PLAY ? "play_btn_active.png" : "play_btn_idle.png", "") && <svg className="flag-label" viewBox="0 0 72 84" aria-hidden="true"><text x="36" y="68" textAnchor="middle" textLength="48" lengthAdjust="spacingAndGlyphs">{t("Play")}</text></svg>}
                                            </div>
                                        </Link>
                                        <Link href="/team" onMouseOver={() => this.setState({ hovered: MenuItems.TEAM })} onMouseLeave={() => this.setState({ hovered: '' })}>
                                            <div
                                                className={`menuItemContainer ${currentPage(Routes.TEAM) ? 'activeFlag' : ''}`}
                                                data-team-page
                                            >
                                                <img className="menuItem" src={this.state.hovered === MenuItems.TEAM ? teamActiveIcon : teamIcon} alt={t("Team")} />{language !== "en" && !localizedAsset(this.state.hovered === MenuItems.TEAM ? "team_btn_active.png" : "team_btn_idle.png", "") && <svg className="flag-label" viewBox="0 0 72 84" aria-hidden="true"><text x="36" y="68" textAnchor="middle" textLength="50" lengthAdjust="spacingAndGlyphs">{t("Team")}</text></svg>}
                                            </div>
                                        </Link>
                                        <Link
                                            href={playerContext.canAccessFeature(LockedFeatures.CONSUMABLES_BATCH_1) ? "/shop" : "#"}
                                            onClick={(e) => {
                                                if (!playerContext.canAccessFeature(LockedFeatures.CONSUMABLES_BATCH_1)) {
                                                    e.preventDefault();
                                                    return;
                                                }
                                            }}
                                            onMouseOver={() => this.setState({ hovered: MenuItems.SHOP })}
                                            onMouseLeave={() => this.setState({ hovered: '' })}
                                        >
                                            <div className={`menuItemContainer ${currentPage(Routes.SHOP) ? 'activeFlag' : ''} ${!playerContext.canAccessFeature(LockedFeatures.CONSUMABLES_BATCH_1) ? 'disabled' : ''}`}>
                                                <img
                                                    className="menuItem"
                                                    src={this.state.hovered === MenuItems.SHOP ? shopActiveIcon : shopIcon}
                                                    alt={t("Shop")}
                                                />{language !== "en" && !localizedAsset(this.state.hovered === MenuItems.SHOP ? "shop_btn_active.png" : "shop_btn_idle.png", "") && <svg className="flag-label" viewBox="0 0 72 84" aria-hidden="true"><text x="36" y="68" textAnchor="middle" textLength="48" lengthAdjust="spacingAndGlyphs">{t("Shop")}</text></svg>}
                                                {!playerContext.canAccessFeature(LockedFeatures.CONSUMABLES_BATCH_1) && (
                                                    <img
                                                        className="lock-overlay"
                                                        src={lockIcon}
                                                        alt={t("Locked")}
                                                    />
                                                )}
                                            </div>
                                        </Link>
                                        <Link
                                            href={playerContext.canAccessFeature(LockedFeatures.RANKED_MODE) ? "/rank" : "#"}
                                            onClick={(e) => {
                                                if (!playerContext.canAccessFeature(LockedFeatures.RANKED_MODE)) {
                                                    e.preventDefault();
                                                    return;
                                                }
                                            }}
                                            onMouseOver={() => this.setState({ hovered: MenuItems.RANK })}
                                            onMouseLeave={() => this.setState({ hovered: '' })}
                                        >
                                            <div className={`menuItemContainer ${currentPage(Routes.RANK) ? 'activeFlag' : ''} ${!playerContext.canAccessFeature(LockedFeatures.RANKED_MODE) ? 'disabled' : ''}`}>
                                                <img
                                                    className="menuItem"
                                                    src={this.state.hovered === MenuItems.RANK ? rankActiveIcon : rankIcon}
                                                    alt={t("Rank")}
                                                />{language !== "en" && !localizedAsset(this.state.hovered === MenuItems.RANK ? "rank-btn-active.png" : "rank_btn_idle.png", "") && <svg className="flag-label" viewBox="0 0 72 84" aria-hidden="true"><text x="36" y="68" textAnchor="middle" textLength="48" lengthAdjust="spacingAndGlyphs">{t("Rank")}</text></svg>}
                                                {!playerContext.canAccessFeature(LockedFeatures.RANKED_MODE) && (
                                                    <img
                                                        className="lock-overlay"
                                                        src={lockIcon}
                                                        alt={t("Locked")}
                                                    />
                                                )}
                                            </div>
                                        </Link>
                                    </div>

                                    <div className="flexContainer" id="goldEloArea">
                                        <UserInfoBar icon='gold' label={`${this.state.isLoading ? t("Loading...") : this.formatNumber(Math.round(this.props.playerData?.gold))}`}  />
                                        {playerContext.canAccessFeature(LockedFeatures.RANKED_MODE) && (
                                            <UserInfoBar
                                                icon='league'
                                                label={this.state.isLoading ? t("Loading...") : `#${this.props.playerData?.rank}`}
                                                isLeague={true}
                                                bigLabel={!this.state.isLoading}
                                                league={this.props.playerData?.league}
                                            />
                                        )}
                                        {/* biome-ignore lint/a11y/noStaticElementInteractions: Hover is a pointer shortcut; the nested button provides keyboard access. */}
                                        <div className="expand_btn" onMouseEnter={() => this.setState({ openDropdown: true })}>
                                            <button type="button" className="expand_btn_trigger" aria-label={t("More options")} aria-expanded={this.state.openDropdown} style={{backgroundImage: `url(${expandBtn})`}} onClick={() => this.setState({ openDropdown: !this.state.openDropdown })} />
                                            {/* biome-ignore lint/a11y/noStaticElementInteractions: Pointer leave only dismisses a menu already controlled by a keyboard-accessible button. */}
                                            <div className="dropdown-content" style={dropdownContentStyle} onMouseLeave={() => this.setState({ openDropdown: false })}>
                                                <Link href="/guide" onClick={() => this.setState({ openDropdown: false })}><Trans i18n={i18n} i18nKey={"<0/> Guide"} components={[<img src={helpIcon} alt="" />]} /></Link>
                                                <button type="button" data-report-problem onClick={() => {
                                                    this.setState({openDropdown: false});
                                                    void reportProblem().catch(() => errorToast(t("Unable to open the report form. Please try again.")));
                                                }}><Trans i18n={i18n} i18nKey={"<0/> Report a problem"} components={[<img src={helpIcon} alt="" />]} /></button>
                                                <button type="button" onClick={this.copyIDtoClipboard}><Trans i18n={i18n} i18nKey={"<0/> Player ID"} components={[<img src={copyIcon} alt="" />]} /></button>
                                                <button type="button" onClick={this.toggleSettingsModal}><Trans i18n={i18n} i18nKey={"<0/> Settings"} components={[<img src={cogIcon} alt="" />]} /></button>
                                                <small className="dropdown-version">{t("Version {{value0}}", {value0: version})}</small>
                                            </div>
                                        </div>
                                    </div>
                                    {this.state.isSettingsModalOpen && (
                                        <div className="settings-modal-wrapper">
                                            <button type="button" data-game-control className="settings-modal-overlay" onClick={this.toggleSettingsModal}></button>
                                            <div className="settings-modal-container" role="dialog" aria-modal="true" aria-labelledby="settings-title">
                                                <SettingsModal onClose={this.toggleSettingsModal} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                )}
            </PlayerContext.Consumer>
        );
    }
}

export default Navbar;
