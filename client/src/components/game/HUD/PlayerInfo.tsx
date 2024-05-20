// PlayerInfo.tsx
import { h, Component } from 'preact';
import { route } from 'preact-router';
import { Player } from './GameHUD';

interface Props {
    player: Player;
}

class PlayerInfo extends Component<Props> {

  render() {
    return (
      <div className="player_info_container" onClick={() => {}}>
        <div className="player_info_lv">
            <span>Lv</span>
            <span className="player_info_lvalue">{this.props.player.level}</span>
        </div>
        <div className="player_info_player_profile"></div>
        <div className="player_info">
            <p className="player_info_name">{this.props.player.name}</p>
            <div className="player_info_rank">
                <img src="/icons/gold_rank.png" alt="" />
                <span>RANK {this.props.player.rank}</span>
            </div>
            <div className="player_info_team">TEAM</div>
        </div>
      </div>
    );
  }
}

export default PlayerInfo;