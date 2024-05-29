// PlayerInfo.tsx
import { h, Component } from 'preact';
import { route } from 'preact-router';
import { Player } from './GameHUD';
import Modal from 'react-modal';

interface Props {
    player: Player;
    position: string;
    isSpectator: boolean;
}

class PlayerInfo extends Component<Props> {
  state = {
    modalOpen: false,
  }

  handleCloseModal = () => {
    this.setState({modalOpen: false});
  }

  render() {
  const {position, isSpectator} = this.props;

  const customStyles = {
    content: {
      top: '50%',
      left: '50%',
      right: 'auto',
      bottom: 'auto',
      marginRight: '-50%',
      transform: 'translate(-50%, -50%)',
      padding: 0,
      border: 'none',
      background: 'transparent'
    },
    overlay: {
      zIndex: 10,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
    }
  };

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
          {!isSpectator && <div onClick={() => this.setState({modalOpen: true})}>
            <img src="/HUD/settings_icon.png" alt="" />
          </div>}
        </div>
        <Modal isOpen={this.state.modalOpen}  onRequestClose={this.handleCloseModal} style={customStyles}>
          <div className="flex flex_col gap_4">
            <div className="game_leave_dialog">Are you sure want to leave?</div>
            <div className="flex gap_4">
              <div className="game_leave_btn" onClick={() => route('/play')}>Leave</div>
              <div className="game_leave_btn" onClick={this.handleCloseModal}>Cancel</div>
            </div>
          </div>
        </Modal>
      </div>
    );
  }
}

export default PlayerInfo;