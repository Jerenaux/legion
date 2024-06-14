// Navbar.tsx

import './navbar.style.css';
import { h, Component } from 'preact';
import { Link, useRouter } from 'preact-router';
import firebase from 'firebase/compat/app'
import UserInfoBar from '../userInfoBar/UserInfoBar';
import { PlayerContextData } from 'src/contexts/PlayerContext';

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
    initFirebaseUI: () => void;
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
                        <div className="avatar"></div>
                        <div className="userInfo">
                            <span>{this.props.playerData?.name}</span>
                            <div className="userLevel"><span>Lvl. {this.props.playerData?.lvl}</span></div>
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

                <div className="flexContainer">
                    {/* {this.props.user === null && <div className="notificationBarButton" onClick={this.props.initFirebaseUI}>Log in</div>}
                    {this.props.user !== null && <div className="notificationBarButton" onClick={this.props.logout}>Log out</div>} */}
                    <UserInfoBar label={`${Math.round(this.props.playerData?.gold)}`}  />
                    <UserInfoBar label="#1" elo={this.props.playerData?.elo} />
                    <div class="expand_btn" style={{backgroundImage: 'url("/expand_btn.png")'}} onClick={() => this.setState({ openDropdown: !this.state.openDropdown })} onMouseEnter={() => this.setState({ openDropdown: true })}>
                        <div class="dropdown-content" style={dropdownContentStyle} onMouseLeave={() => this.setState({ openDropdown: false })}>
                            <div className="" onClick={this.props.user ? this.props.logout : this.props.initFirebaseUI}>{this.props.user ? 'Log out' : 'Log in'}</div>
                            {/* <div><span>Link 2</span></div>
                            <div><span>Link 3</span></div> */}
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

export default Navbar;