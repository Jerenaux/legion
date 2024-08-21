import { h, Component } from 'preact';
import './UserInfoBar.style.css';
import GoldIcon from '@assets/gold_icon.png';
import {League} from "@legion/shared/enums";

const leagueIconContext = require.context('@assets/icons', false, /_rank\.png$/);

interface BarProps {
    elo?: number;
    league?: League;
    label: string;
}

const leagueMap = new Map([
    [League.BRONZE, 'Bronze'],
    [League.SILVER, 'Silver'],
    [League.GOLD, 'Gold'],
    [League.ZENITH, 'Zenith'],
    [League.APEX, 'Apex'],
]);

class UserInfoBar extends Component<BarProps> {
    getLeagueIcon(leagueName: string | undefined): string {
        if (!leagueName) return GoldIcon;
        const iconName = `${leagueName.toLowerCase()}_rank.png`;
        return leagueIconContext(`./${iconName}`);
    }

    render() {
        const leagueName = leagueMap.get(this.props.league);
        const leagueIcon = this.getLeagueIcon(leagueName);

        return (
            <div className="userInfoBar">
                <div className="barLogo">
                    <img 
                        src={this.props.elo ? leagueIcon : GoldIcon}
                    />
                </div>
                <div className="userInfoLabel">
                    <span className={`labelSpan ${this.props.elo ? 'bigLabel' : 'smallLabel'}`}>
                        {this.props.label}
                    </span>
                </div>
            </div>
        );
    }
}

export default UserInfoBar;