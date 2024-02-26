// Navbar.tsx

import { h, Component } from 'preact';
import { Link } from 'preact-router';
import './navbar.style.css';

import UserInfoBar from '../userInfoBar/UserInfoBar';

import legionLogo from '@assets/legionlogo.png';
import playIcon from '@assets/play.png';
import teamIcon from '@assets/team.png';
import shopIcon from '@assets/shop.png';
import rankIcon from '@assets/rank.png';
import navbarBg from '@assets/navbar_bg.png';

class Navbar extends Component {

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

                {/* <div className="menuItems">
                    <Link href="/play">
                        <div className="menuItemContainer">
                            <img className="menuItem" src={playIcon} />
                            <span className="menuItemText">PLAY</span>
                        </div>
                    </Link>
                    <Link href="/team">
                        <div className="menuItemContainer">
                            <img className="menuItem" src={teamIcon} />
                            <span className="menuItemText">TEAM</span>
                        </div>
                    </Link>
                    <Link href="/shop">
                        <div className="menuItemContainer">
                            <img className="menuItem" src={shopIcon} />
                            <span className="menuItemText">SHOP</span>
                        </div>
                    </Link>
                    <Link href="/rank">
                        <div className="menuItemContainer">
                            <img className="menuItem" src={rankIcon} />
                            <span className="menuItemText">RANK</span>
                        </div>
                    </Link>
                </div> */}
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