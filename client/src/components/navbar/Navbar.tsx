// Navbar.tsx

import './navbar.style.css';
import './SettingsModalWrapper.css';
import { h, Fragment, Component } from 'preact';
import { Link, useRouter } from 'preact-router';
import firebase from 'firebase/compat/app'
import { firebaseAuth } from '../../services/firebaseService';
import UserInfoBar from '../userInfoBar/UserInfoBar';
import { PlayerContextData } from '@legion/shared/interfaces';
import { successToast, avatarContext, lockIcon } from '../utils';
import { ENABLE_PLAYER_LEVEL, DISCORD_LINK, X_LINK } from '@legion/shared/config';
import { SettingsModal } from '../settingsModal/SettingsModal';
import { PlayerContext } from '../../contexts/PlayerContext';
import { LockedFeatures } from "@legion/shared/enums";
import AuthContext from '../../contexts/AuthContext';
import { isElectron } from '../../utils/electronUtils';

import legionLogo from '@assets/logo.png';
import playIcon from '@assets/play_btn_idle.png';
import teamIcon from '@assets/team_btn_idle.png';
import shopIcon from '@assets/shop_btn_idle.png';
import rankIcon from '@assets/rank_btn_idle.png';
import playActiveIcon from '@assets/play_btn_active.png';
import teamActiveIcon from '@assets/team_btn_active.png';
import shopActiveIcon from '@assets/shop_btn_active.png';
import rankActiveIcon from '@assets/rank-btn-active.png';
import expandBtn from '@assets/expand_btn.png';
import helpIcon from '@assets/svg/help.svg';
import xIcon from '@assets/svg/x.svg';
import discordIcon from '@assets/svg/discord.svg';
import copyIcon from '@assets/svg/copy.svg';
import logoutIcon from '@assets/svg/logout.svg';
import cogIcon from '@assets/svg/cog.svg';

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
    logout: () => void;
    user: firebase.User | null;
    playerData: PlayerContextData;
}

interface State {
    hovered: string;
    openDropdown: boolean;
    avatarUrl: string | null;
    isLoading: boolean;
    isSolanaWalletPresent: boolean;
    isSolanaWalletConnected: boolean;
    solanaBalance: number | null;
    isSettingsModalOpen: boolean;
    showLoginOptions: boolean;
}

class Navbar extends Component<Props, State> {
    private firebaseUIContainer: HTMLDivElement | null = null;
    private authContext: any = null;
    
    state: State = {
        hovered: '',
        openDropdown: false,
        avatarUrl: null,
        isLoading: true,
        isSolanaWalletPresent: false,
        isSolanaWalletConnected: false,
        solanaBalance: null,
        isSettingsModalOpen: false,
        showLoginOptions: false,
    }

    constructor(props: Props) {
        super(props);
    }

    componentDidMount() {
        this.loadAvatar();
        if (this.authContext) {
            this.authContext.addSignInCallback(this.handleSignInSuccess);
        }
    }

    componentDidUpdate(prevProps: Readonly<Props>) {
        if (prevProps.playerData?.avatar !== this.props.playerData?.avatar) {
            this.loadAvatar();
        }
    }

    componentWillUnmount() {
        if (this.authContext) {
            this.authContext.removeSignInCallback(this.handleSignInSuccess);
        }
    }

    loadAvatar = () => {
        this.setState({ isLoading: true });
        const { avatar } = this.props.playerData;
        if (avatar != '0') {
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
            successToast(`Player ID ${textToCopy} copied!`);
        }).catch(err => {
            console.error('Failed to copy text: ', err);
        });
    };

    formatNumber = (number) => {
        const format = 'en-US';
        return new Intl.NumberFormat(format, { 
          useGrouping: true,
          maximumFractionDigits: 2
        }).format(number);
    };

    toggleSettingsModal = () => {
        this.setState(prevState => ({ isSettingsModalOpen: !prevState.isSettingsModalOpen }));
    };

    handleSignInSuccess = () => {
        this.clearLoginOptions();
    };

    showLoginOptions = (): void => {
        this.setState({ showLoginOptions: true, openDropdown: false }, () => {
            if (this.firebaseUIContainer && this.authContext) {
                this.authContext.initFirebaseUI(this.firebaseUIContainer);
                this.authContext.addSignInCallback(this.handleSignInSuccess);
            }
        });
    };

    clearLoginOptions = (): void => {
        if (this.authContext) {
            this.authContext.resetUI();
            this.authContext.removeSignInCallback(this.handleSignInSuccess);
        }
        this.setState({ showLoginOptions: false });
    };

    render() {
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
                    <AuthContext.Consumer>
                        {authContext => {
                            this.authContext = authContext;
                            
                            return (
                                <div className="menu">
                                    <div className="flexContainer">
                                        <div className="logoContainer">
                                            <Link href="/play" className="gameLogo">
                                                <img src={legionLogo} alt="Legion Logo" />
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
                                                        <span className="loading-placeholder">Loading...</span>
                                                    ) : (
                                                        <span>{this.props.playerData?.name}</span>
                                                    )}
                                                    {ENABLE_PLAYER_LEVEL && (
                                                        <div className="userLevel">
                                                            {this.state.isLoading ? (
                                                                <span className="loading-placeholder">Lvl. --</span>
                                                            ) : (
                                                                <span>Lvl. {this.props.playerData?.lvl}</span>
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
                                                <img className="menuItem" src={this.state.hovered === MenuItems.PLAY ? playActiveIcon : playIcon} alt="Play" />
                                            </div>
                                        </Link>
                                        <Link href="/team" onMouseOver={() => this.setState({ hovered: MenuItems.TEAM })} onMouseLeave={() => this.setState({ hovered: '' })}>
                                            <div 
                                                className={`menuItemContainer ${currentPage(Routes.TEAM) ? 'activeFlag' : ''}`}
                                                data-team-page
                                            >
                                                <img className="menuItem" src={this.state.hovered === MenuItems.TEAM ? teamActiveIcon : teamIcon} alt="Team" />
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
                                                    alt="Shop" 
                                                />
                                                {!playerContext.canAccessFeature(LockedFeatures.CONSUMABLES_BATCH_1) && (
                                                    <img 
                                                        className="lock-overlay"
                                                        src={lockIcon} 
                                                        alt="Locked" 
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
                                                    alt="Rank" 
                                                />
                                                {!playerContext.canAccessFeature(LockedFeatures.RANKED_MODE) && (
                                                    <img 
                                                        className="lock-overlay"
                                                        src={lockIcon} 
                                                        alt="Locked" 
                                                    />
                                                )}
                                            </div>
                                        </Link>
                                    </div>

                                    <div className="flexContainer" id="goldEloArea">
                                        <UserInfoBar icon='gold' label={`${this.state.isLoading ? 'Loading...' : this.formatNumber(Math.round(this.props.playerData?.gold))}`}  />
                                        {playerContext.canAccessFeature(LockedFeatures.RANKED_MODE) && (
                                            <UserInfoBar 
                                                icon='league' 
                                                label={this.state.isLoading ? 'Loading...' : `#${this.props.playerData?.rank}`} 
                                                isLeague={true} 
                                                bigLabel={!this.state.isLoading} 
                                                league={this.props.playerData?.league} 
                                            />
                                        )}
                                        <div className="expand_btn" style={{backgroundImage: `url(${expandBtn})`}} onClick={() => this.setState({ openDropdown: !this.state.openDropdown })} onMouseEnter={() => this.setState({ openDropdown: true })}>
                                            <div className="dropdown-content" style={dropdownContentStyle} onMouseLeave={() => this.setState({ openDropdown: false })}>
                                                {firebaseAuth.currentUser?.isAnonymous && (
                                                    <div onClick={this.showLoginOptions}>
                                                        <img src={logoutIcon} alt="Sign Up" /> Sign Up
                                                    </div>
                                                )}
                                                <div onClick={() => window.open('https://guide.play-legion.io', '_blank')}>
                                                    <img src={helpIcon} alt="How to play" /> How to play
                                                </div>
                                                {!isElectron() && (
                                                    <>
                                                        <div onClick={() => window.open(X_LINK, '_blank')}>
                                                            <img src={xIcon} alt="X.com" /> X.com
                                                        </div>
                                                        <div onClick={() => window.open(DISCORD_LINK, '_blank')}>
                                                            <img src={discordIcon} alt="Discord" /> Discord
                                                        </div>
                                                    </>
                                                )}
                                                <div onClick={this.copyIDtoClipboard}>
                                                    <img src={copyIcon} alt="Copy" /> Player ID
                                                </div>
                                                <div onClick={this.toggleSettingsModal}>
                                                    <img src={cogIcon} alt="Settings" /> Settings
                                                </div>
                                                <div onClick={this.props.logout}>
                                                    <img src={logoutIcon} alt="Logout" /> Log out
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    {this.state.isSettingsModalOpen && (
                                        <div className="settings-modal-wrapper">
                                            <div className="settings-modal-overlay" onClick={this.toggleSettingsModal}></div>
                                            <div className="settings-modal-container">
                                                <SettingsModal onClose={this.toggleSettingsModal} />
                                            </div>
                                        </div>
                                    )}
                                    {this.state.showLoginOptions && (
                                        <div className="login-modal-overlay">
                                            <div className="login-modal-dialog">
                                            <div className="dialog-content">
                                                <h2>Sign Up</h2>
                                                <div className="login-header">
                                                Choose your sign up method
                                                </div>
                                                <div ref={(ref) => this.firebaseUIContainer = ref} id="firebaseui-auth-container"></div>
                                                <button className="back-button" onClick={this.clearLoginOptions}>Close</button>
                                            </div>
                                            </div>
                                        </div>
                                        )}
                                </div>
                            );
                        }}
                    </AuthContext.Consumer>
                )}
            </PlayerContext.Consumer>
        );
    }
}

export default Navbar;
