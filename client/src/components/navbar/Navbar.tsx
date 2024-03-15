// Navbar.tsx

import './navbar.style.css';
import { h, Component } from 'preact';
import { Link, useRouter } from 'preact-router';
import firebase from 'firebase/compat/app'
import { apiFetch } from '../../services/apiService';
import { successToast, errorToast } from '../utils';

import UserInfoBar from '../userInfoBar/UserInfoBar';

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
}

interface State {
    hovered: string;
    openDropdown: boolean;
    name: string;
    lvl: number;
    gold: number;
    elo: number;
}

class Navbar extends Component<Props, State> {
    state = {
        hovered: '',
        openDropdown: false,
        name: '',
        lvl: 0,
        gold: 0,
        elo: 0,
    }

    componentDidMount() {
        this.fetchPlayerData();
      }
    
      async fetchPlayerData() {
        try {
            // const data = await apiFetch('playerData');
            // console.log(data);
            this.setState({ 
                name: 'popular_tomato_caterpillar', //data.name,
                lvl: 1, // data.lvl,
                gold: 1200, // data.gold,
                elo: 160, // data.elo
            });
        } catch (error) {
            errorToast(`Error: ${error}`);
        }
      }

    render() {
        const route = useRouter();
        const dropdownContentStyle = {
            display: `${this.state.openDropdown ? 'block' : 'none'}`
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
                            <span>{this.state.name}</span>
                            <div className="userLevel"><span>Lvl. {this.state.lvl}</span></div>
                        </div>
                    </div>
                </div>

                <div className="menuItems">
                    <Link href="/play" onMouseOver={() => this.setState({ hovered: MenuItems.PLAY })} onMouseLeave={() => this.setState({ hovered: '' })}>
                        <div className={`menuItemContainer ${route[0].url === Routes.PLAY || route[0].url === Routes.HOME ? 'activeFlag' : ''}`}>
                            <img className="menuItem" src={this.state.hovered === MenuItems.PLAY ? playActiveIcon : playIcon} />
                        </div>
                    </Link>
                    <Link href="/team" onMouseOver={() => this.setState({ hovered: MenuItems.TEAM })} onMouseLeave={() => this.setState({ hovered: '' })}>
                        <div className={`menuItemContainer ${route[0].url === Routes.TEAM ? 'activeFlag' : ''}`}>
                            <img className="menuItem" src={this.state.hovered === MenuItems.TEAM ? teamActiveIcon : teamIcon} />
                        </div>
                    </Link>
                    <Link href="/shop" onMouseOver={() => this.setState({ hovered: MenuItems.SHOP })} onMouseLeave={() => this.setState({ hovered: '' })}>
                        <div className={`menuItemContainer ${route[0].url === Routes.SHOP ? 'activeFlag' : ''}`}>
                            <img className="menuItem" src={this.state.hovered === MenuItems.SHOP ? shopActiveIcon : shopIcon} />
                        </div>
                    </Link>
                    <Link href="/rank" onMouseOver={() => this.setState({ hovered: MenuItems.RANK })} onMouseLeave={() => this.setState({ hovered: '' })}>
                        <div className={`menuItemContainer ${route[0].url === Routes.RANK ? 'activeFlag' : ''}`}>
                            <img className="menuItem" src={this.state.hovered === MenuItems.RANK ? rankActiveIcon : rankIcon} />
                        </div>
                    </Link>
                </div>

                <div className="flexContainer">
                    {this.props.user === null && <div className="notificationBarButton" onClick={this.props.initFirebaseUI}>Log in</div>}
                    {this.props.user !== null && <div className="notificationBarButton" onClick={this.props.logout}>Log out</div>}
                    <UserInfoBar label={`${this.state.gold}`}  />
                    <UserInfoBar label="# 1" elo={this.state.elo} />
                    <div class="expand_btn" onClick={() => this.setState({ openDropdown: !this.state.openDropdown })} onMouseEnter={() => this.setState({ openDropdown: true })}>
                        <div class="dropdown-content" style={dropdownContentStyle} onMouseLeave={() => this.setState({ openDropdown: false })}>
                            <Link href="/"><span>Link 1</span></Link>
                            <Link href="/"><span>Link 2</span></Link>
                            <Link href="/"><span>Link 3</span></Link>
                        </div>
                    </div>

                </div>
            </div>
        );
    }
}

export default Navbar;