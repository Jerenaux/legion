// Button.tsx
import { h, Component } from 'preact';
import './UserInfoBar.style.css';
import GoldIcon from '@assets/gold_icon.png';
import { League } from "@legion/shared/enums";

import Skeleton from 'react-loading-skeleton';

interface BarProps {
  isgold: boolean; 
  gold: number; 
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
    let leagueIcon = "bronze";
    leagueIcon = leagueName?.toLowerCase();

    return (
      <div className="userInfoBar">
        <div className="barLogo">
          {!this.props.isgold ? this.props.elo ?
            <img src={`icons/${leagueIcon}_rank.png`} alt="rank_icon" title={`${leagueName} league`} /> :
            <img src={`icons/bronze_rank.png`} alt="rank_icon" title={`bronze league`} /> :
            <img src={GoldIcon} alt="gold_icon" title="Gold" />}
        </div>
        {this.props.gold > -1 ?
          <div className="userInfoLabel">
            <span className="labelSpan">{this.props.label}</span>
            {this.props.elo && <span className="eloSpan"> <strong>Elo:</strong> {this.props.elo}</span>}
          </div> :
          <div className="userInfoLabel">
            <Skeleton height={20} count={1} highlightColor='#0000004d' baseColor='#0f1421' style={{ margin: '-4px -8px 0 -20px', width: '100px' }} />
          </div>}
      </div>
    );
  }
}

export default UserInfoBar;