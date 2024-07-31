// Button.tsx
import { h, Component } from 'preact';
import './UserInfoBar.style.css';
import GoldIcon from '@assets/gold_icon.png';
import {League} from "@legion/shared/enums";

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
  league: League;
  leagueName = 'Bronze';
  leagueIcon = 'apex';
  
  render() {
    const leagueName = leagueMap.get(this.props.league);
    const leagueIcon = leagueName?.toLowerCase();
  
    return (
      <div className="userInfoBar">
        <div className="barLogo">
          {this.props.elo ? <img src={`icons/${leagueIcon}_rank.png`} alt="rank_icon" title={`${leagueName} league`} /> : <img src={GoldIcon} alt="gold_icon" title="Gold" />}
        </div>
        <div className="userInfoLabel">
          <span className="labelSpan">{this.props.label}</span>
          {this.props.elo && <span className="eloSpan"> <strong>Elo:</strong> {this.props.elo}</span>}
        </div>
      </div>
    );
  }
}

export default UserInfoBar;