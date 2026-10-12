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
    /** Explanation shown on hover. */
    hint?: string;
}

const iconsMap = {
    'gold': GoldIcon,
};

class UserInfoBar extends Component<BarProps> {

    render() {
        const leagueIcon = getLeagueIcon(this.props.league);

        return (
            <div className={`userInfoBar userInfoBar--${this.props.isLeague ? 'league' : this.props.icon}`}
                data-tooltip-id={this.props.hint ? 'navbar-unlock-hint' : undefined} data-tooltip-content={this.props.hint}>
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
