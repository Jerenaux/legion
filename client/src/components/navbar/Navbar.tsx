// Navbar.tsx

import { h, Component } from 'preact';
import { Link } from 'preact-router';
import './navbar.style.css';

import UserInfoBar from '../userInfoBar/UserInfoBar';

import legionLogo from '@assets/legionlogo.png';
import playIcon from '@assets/play_btn_idle.png';
import teamIcon from '@assets/team_btn_idle.png';
import shopIcon from '@assets/shop_btn_idle.png';
import rankIcon from '@assets/rank_btn_idle.png';
import playActiveIcon from '@assets/play_btn_active.png';
import teamActiveIcon from '@assets/team_btn_active.png';
import shopActiveIcon from '@assets/shop_btn_active.png';
import rankActiveIcon from '@assets/rank_btn_active.png';
import navbarBg from '@assets/navbar_bg.png';

enum MenuItems {
    PLAY = 'PLAY',
    TEAM = 'TEAM',
    SHOP = 'SHOP',
    RANK = 'RANK'
}

class Navbar extends Component {
    state = {
        hovered: ''
    }

    render() {
        return (
            <div className="menu">
                <div className="flexContainer">
                    <div className="logoContainer">
                        <Link href="/play">
                            <img src={legionLogo} className="gameLogo" />
                        </Link>
                    </div>
                    <div className="avatarContainer">
                        <div className="avatar"></div>
                        <div className="userInfo">
                            <span>AVATAR NAME</span>
                            <div className="userLevel"><span>Lv.13</span></div>
                        </div>
                    </div>
                </div>

                <div className="menuItems">
                    <Link href="/play" onMouseOver={() => this.setState({hovered: MenuItems.PLAY})} onMouseLeave={() => this.setState({hovered: ''})}>
                        <div className="menuItemContainer">
                            <img className="menuItem" src={this.state.hovered === MenuItems.PLAY ? playActiveIcon : playIcon} />
                        </div>
                    </Link>
                    <Link href="/team" onMouseOver={() => this.setState({hovered: MenuItems.TEAM})} onMouseLeave={() => this.setState({hovered: ''})}>
                        <div className="menuItemContainer">
                            <img className="menuItem" src={this.state.hovered === MenuItems.TEAM ? teamActiveIcon :teamIcon} />
                        </div>
                    </Link>
                    <Link href="/shop" onMouseOver={() => this.setState({hovered: MenuItems.SHOP})} onMouseLeave={() => this.setState({hovered: ''})}>
                        <div className="menuItemContainer">
                            <img className="menuItem" src={this.state.hovered === MenuItems.SHOP ? shopActiveIcon :shopIcon} />
                        </div>
                    </Link>
                    <Link href="/rank" onMouseOver={() => this.setState({hovered: MenuItems.RANK})} onMouseLeave={() => this.setState({hovered: ''})}>
                        <div className="menuItemContainer">
                            <img className="menuItem" src={this.state.hovered === MenuItems.RANK ? rankActiveIcon :rankIcon} />
                        </div>
                    </Link>
                </div>

                <div className="flexContainer">
                    <UserInfoBar label="3.000.000" />
                    <UserInfoBar label="1.235" elo={5.302} />
                    <div className="expand_btn"></div>
                </div>
            </div>
        );
    }
}

export default Navbar;