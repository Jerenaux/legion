import { h } from 'preact';
import { Component } from 'preact';
import './UserInfoBar.style.css';
import GoldIcon from '@assets/gold_icon.png';
import {League} from "@legion/shared/enums";
import {getLeagueIcon} from "../utils";

interface BarProps {
    bigLabel?: boolean;
    league?: League;
    label: string;
    isLeague?: boolean;
    icon: string;
}

const iconsMap = {
    'gold': GoldIcon,
};

class UserInfoBar extends Component<BarProps> {

    render() {
        const leagueIcon = getLeagueIcon(this.props.league);

        return (
            <div className="userInfoBar">
                <div className="barLogo">
                    <img
                        src={this.props.isLeague ? leagueIcon : iconsMap[this.props.icon]}
                        alt={""}
                    />
                </div>
                <div className="userInfoLabel">
                    <span className={`labelSpan ${this.props.bigLabel ? 'bigLabel' : 'smallLabel'}`}>
                        {this.props.label}
                    </span>
                </div>
            </div>
        );
    }
}

export default UserInfoBar;
