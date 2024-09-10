// Navbar.tsx

import './navbar.style.css';
import { h, Component } from 'preact';
import { Link, useRouter } from 'preact-router';
import firebase from 'firebase/compat/app'
import UserInfoBar from '../userInfoBar/UserInfoBar';
import { PlayerContextData } from '@legion/shared/interfaces';
import { successToast, avatarContext } from '../utils';
import { ENABLE_PLAYER_LEVEL } from '@legion/shared/config';

import legionLogo from '@assets/logo.png';
import playIcon from '@assets/play_btn_idle.png';
import teamIcon from '@assets/team_btn_idle.png';
import shopIcon from '@assets/shop_btn_idle.png';
import rankIcon from '@assets/rank_btn_idle.png';
import playActiveIcon from '@assets/play_btn_active.png';
import teamActiveIcon from '@assets/team_btn_active.png';
import shopActiveIcon from '@assets/shop_btn_active.png';
import rankActiveIcon from '@assets/rank_btn_active.png';
import expandBtn from '@assets/expand_btn.png';
import helpIcon from '@assets/svg/help.svg';
import xIcon from '@assets/svg/x.svg';
import discordIcon from '@assets/svg/discord.svg';
import copyIcon from '@assets/svg/copy.svg';
import logoutIcon from '@assets/svg/logout.svg';


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
}

class Navbar extends Component<Props, State> {
    state = {
        hovered: '',
        openDropdown: false,
        avatarUrl: null,
        isLoading: true,
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
          maximumFractionDigits: 0
        }).format(number);
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
            <div className="menu">
                <div className="flexContainer">
                    <div className="logoContainer">
                        <Link href="/play" className="gameLogo">
                            <img src={legionLogo} alt="Legion Logo" />
                        </Link>
                    </div>
                    <div className="avatarContainer">
                        {this.state.isLoading ? (
                            <div className="avatar spinner-container">
                                <div className=" loading-spinner"></div>
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
                </div>

                <div className="menuItems">
                    <Link href="/play" onMouseOver={() => this.setState({ hovered: MenuItems.PLAY })} onMouseLeave={() => this.setState({ hovered: '' })}>
                        <div className={`menuItemContainer ${currentPage(Routes.PLAY) ? 'activeFlag' : ''}`}>
                            <img className="menuItem" src={this.state.hovered === MenuItems.PLAY ? playActiveIcon : playIcon} alt="Play" />
                        </div>
                    </Link>
                    <Link href="/team" onMouseOver={() => this.setState({ hovered: MenuItems.TEAM })} onMouseLeave={() => this.setState({ hovered: '' })}>
                        <div className={`menuItemContainer ${currentPage(Routes.TEAM) ? 'activeFlag' : ''}`}>
                            <img className="menuItem" src={this.state.hovered === MenuItems.TEAM ? teamActiveIcon : teamIcon} alt="Team" />
                        </div>
                    </Link>
                    <Link href="/shop" onMouseOver={() => this.setState({ hovered: MenuItems.SHOP })} onMouseLeave={() => this.setState({ hovered: '' })}>
                        <div className={`menuItemContainer ${currentPage(Routes.SHOP) ? 'activeFlag' : ''}`}>
                            <img className="menuItem" src={this.state.hovered === MenuItems.SHOP ? shopActiveIcon : shopIcon} alt="Shop" />
                        </div>
                    </Link>
                    <Link href="/rank" onMouseOver={() => this.setState({ hovered: MenuItems.RANK })} onMouseLeave={() => this.setState({ hovered: '' })}>
                        <div className={`menuItemContainer ${currentPage(Routes.RANK) ? 'activeFlag' : ''}`}>
                            <img className="menuItem" src={this.state.hovered === MenuItems.RANK ? rankActiveIcon : rankIcon} alt="Rank" />
                        </div>
                    </Link>
                </div>

                <div className="flexContainer" id="goldEloArea">
                    <UserInfoBar label={`${this.state.isLoading ? 'Loading...' : this.formatNumber(Math.round(this.props.playerData?.gold))}`}  />
                    <UserInfoBar label={this.state.isLoading ? 'Loading...' : `#${this.props.playerData?.rank}`} isLeague={true} bigLabel={!this.state.isLoading} league={this.props.playerData?.league} />
                    <div className="expand_btn" style={{backgroundImage: `url(${expandBtn})`}} onClick={() => this.setState({ openDropdown: !this.state.openDropdown })} onMouseEnter={() => this.setState({ openDropdown: true })}>
                        <div className="dropdown-content" style={dropdownContentStyle} onMouseLeave={() => this.setState({ openDropdown: false })}>
                            <div onClick={() => window.open('', '_blank')}>
                                <img src={helpIcon} alt="Help" /> How to play
                            </div>
                            <div onClick={() => window.open('https://x.com/iolegion', '_blank')}>
                                <img src={xIcon} alt="X.com" /> X.com
                            </div>
                            <div onClick={() => window.open('', '_blank')}>
                                <img src={discordIcon} alt="Discord" /> Discord
                            </div>
                            <div onClick={this.copyIDtoClipboard}>
                                <img src={copyIcon} alt="Copy" /> Player ID
                            </div>
                            <div onClick={this.props.logout}>
                                <img src={logoutIcon} alt="Logout" /> Log out
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

export default Navbar;