import { h, Component } from 'preact';
import './UserInfoBar.style.css';
import GoldIcon from '@assets/gold_icon.png';
import {League} from "@legion/shared/enums";
import {getLeagueIcon} from "../utils";

interface BarProps {
    bigLabel?: boolean;
    league?: League;
    label: string;
    isLeague?: boolean;
}

const leagueMap = new Map([
    [League.BRONZE, 'Bronze'],
    [League.SILVER, 'Silver'],
    [League.GOLD, 'Gold'],
    [League.ZENITH, 'Zenith'],
    [League.APEX, 'Apex'],
]);

class UserInfoBar extends Component<BarProps> {
    
    render() {
        const leagueName = leagueMap.get(this.props.league);
        const leagueIcon = getLeagueIcon(leagueName);

        return (
            <div className="userInfoBar">
                <div className="barLogo">
                    <img 
                        src={this.props.isLeague ? leagueIcon : GoldIcon}
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