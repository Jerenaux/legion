// PlayerInfo.tsx
import { h, Component } from 'preact';
import { route } from 'preact-router';
import { Player } from './GameHUD';

interface Props {
    player: Player;
    position: string;
    isSpectator: boolean;
}

class PlayerInfo extends Component<Props> {
  render() {
  const {position, isSpectator} = this.props;

    return (
      <div className={`player_info_container relative ${position === 'right' && 'player_info_container_right'}`} onClick={() => {}}>
        <div className={`player_info_lv ${position === 'right' && 'player_info_lv_right'}`}>
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
            <div className="player_info_team"><span>TEAM</span></div>
        </div>
        <div className={position === 'right' ? 'spectator_container_right' : 'spectator_container'}>
          <div onClick={() => {}}>
            <img src="/HUD/applause_icon.png" alt="" />
          </div>
          <div onClick={() => {}}>
            <img src="/HUD/donate_icon.png" alt="" />
          </div>
          {!isSpectator && <div onClick={() => {}}>
            <img src="/HUD/settings_icon.png" alt="" />
          </div>}
        </div>
      </div>
    );
  }
}

export default PlayerInfo;