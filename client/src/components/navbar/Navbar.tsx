// Navbar.tsx

import './navbar.style.css';
import { h, Component } from 'preact';
import { Link, useRouter } from 'preact-router';
import firebase from 'firebase/compat/app'
import UserInfoBar from '../userInfoBar/UserInfoBar';
import { PlayerContextData } from 'src/contexts/PlayerContext';
import { successToast, errorToast, showGuideToast } from '../utils';
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
}

class Navbar extends Component<Props, State> {
    state = {
        hovered: '',
        openDropdown: false,
    }

    componentDidUpdate(previousProps: Readonly<Props>, previousState: Readonly<State>, snapshot: any): void {
        // if (previousProps.playerData?.lvl !== this.props.playerData?.lvl) {
        //     successToast(`Level up! You are now level ${this.props.playerData?.lvl}`);
}

    copyIDtoClipboard = () => {  
        const textToCopy = this.props.playerData.uid;
        navigator.clipboard.writeText(textToCopy).then(() => {
            successToast(`Player ID ${textToCopy} copied!`);
        }).catch(err => {
            console.error('Failed to copy text: ', err);
        });
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
                            <img src={legionLogo} />
                        </Link>
                    </div>
                    <div className="avatarContainer">
                        <div className="avatar"  style={{ backgroundImage: `url(avatars/${this.props.playerData?.avatar}.png)` }}></div>
                        <div className="userInfo">
                            <span>{this.props.playerData?.name}</span>
                            {ENABLE_PLAYER_LEVEL && <div className="userLevel"><span>Lvl. {this.props.playerData?.lvl}</span></div>}
                        </div>
                    </div>
                </div>

                <div className="menuItems">
                    <Link href="/play" onMouseOver={() => this.setState({ hovered: MenuItems.PLAY })} onMouseLeave={() => this.setState({ hovered: '' })}>
                        <div className={`menuItemContainer ${currentPage(Routes.PLAY) ? 'activeFlag' : ''}`}>
                            <img className="menuItem" src={this.state.hovered === MenuItems.PLAY ? playActiveIcon : playIcon} />
                        </div>
                    </Link>
                    <Link href="/team" onMouseOver={() => this.setState({ hovered: MenuItems.TEAM })} onMouseLeave={() => this.setState({ hovered: '' })}>
                        <div className={`menuItemContainer ${currentPage(Routes.TEAM) ? 'activeFlag' : ''}`}>
                            <img className="menuItem" src={this.state.hovered === MenuItems.TEAM ? teamActiveIcon : teamIcon} />
                        </div>
                    </Link>
                    <Link href="/shop" onMouseOver={() => this.setState({ hovered: MenuItems.SHOP })} onMouseLeave={() => this.setState({ hovered: '' })}>
                        <div className={`menuItemContainer ${currentPage(Routes.SHOP) ? 'activeFlag' : ''}`}>
                            <img className="menuItem" src={this.state.hovered === MenuItems.SHOP ? shopActiveIcon : shopIcon} />
                        </div>
                    </Link>
                    <Link href="/rank" onMouseOver={() => this.setState({ hovered: MenuItems.RANK })} onMouseLeave={() => this.setState({ hovered: '' })}>
                        <div className={`menuItemContainer ${currentPage(Routes.RANK) ? 'activeFlag' : ''}`}>
                            <img className="menuItem" src={this.state.hovered === MenuItems.RANK ? rankActiveIcon : rankIcon} />
                        </div>
                    </Link>
                </div>

                <div className="flexContainer" id="goldEloArea">
                    <UserInfoBar label={`${Math.round(this.props.playerData?.gold)}`}  />
                    <UserInfoBar label={`#${this.props.playerData?.rank}`} elo={this.props.playerData?.elo} league={this.props.playerData?.league} />
                    <div class="expand_btn" style={{backgroundImage: 'url("/expand_btn.png")'}} onClick={() => this.setState({ openDropdown: !this.state.openDropdown })} onMouseEnter={() => this.setState({ openDropdown: true })}>
                        <div class="dropdown-content" style={dropdownContentStyle} onMouseLeave={() => this.setState({ openDropdown: false })}>
                            <div className="" onClick={() => window.open('', '_blank')}>
                                <img src="svg/help.svg" /> How to play
                            </div>
                            <div className=""  onClick={() => window.open('https://x.com/iolegion', '_blank')}>
                                <img src="svg/x.svg" /> X.com
                            </div>
                            <div className="" onClick={() => window.open('', '_blank')}>
                                <img src="svg/discord.svg" /> Discord
                            </div>
                            <div className="" onClick={this.copyIDtoClipboard}>
                                <img src="svg/copy.svg" /> Player ID
                            </div>
                            <div className="" onClick={this.props.logout}>
                                <img src="svg/logout.svg" /> Log out
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

export default Navbar;