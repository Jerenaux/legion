// PlayerInfo.tsx
import { h, Component } from 'preact';
import { route } from 'preact-router';
import Modal from 'react-modal';
import { PlayerProfileData } from "@legion/shared/interfaces";

import { ENABLE_PLAYER_LEVEL, ENABLE_TEAM_NAME } from '@legion/shared/config';

interface Props {
  player: PlayerProfileData;
  position: string;
  isSpectator: boolean;
  eventEmitter: any; 
  isPlayerTeam: boolean; 
}
interface State {
  modalOpen: boolean;
  modalOpen1: boolean;
  modalPos: any;
}

class PlayerInfo extends Component<Props, State> {
  events: any;

  constructor(props: Props) {
    super(props);
    this.state = {
      modalOpen: false,
      modalOpen1: false,
      modalPos: null
    }
    this.events = this.props.eventEmitter;
  }

  handleOpenModal = (e: any, isExit: boolean) => {
    if (isExit) {
      this.setState({ modalOpen: false, modalOpen1: true });
      return;
    }

    const elementRect = e.currentTarget.getBoundingClientRect();

    const modalPosition = {
      top: elementRect.top + elementRect.height,
      left: elementRect.left - 56,
    };

    this.setState({ modalOpen: true, modalPos: modalPosition });
  }

  handleCloseModal = () => {
    this.setState({
      modalOpen: false,
      modalOpen1: false
    });
  }

  handleExit = () => {
    this.events.emit('abandonGame');
    route('/play');
  }

  render() {
    const { position, isSpectator } = this.props;

    const customStyles = {
      content: {
        top: this.state.modalPos?.top,
        left: this.state.modalPos?.left,
        right: 'auto',
        bottom: 'auto',
        padding: 0,
        border: 'none',
        background: 'transparent',
        overflow: 'visible'
      },
      overlay: {
        zIndex: 10,
        backgroundColor: 'transparent',
      }
    };

    const customStyles1 = {
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

    console.log("playerInfoData => ", this.props.player); 

    return (
      <div className={`player_info_container relative ${position === 'right' && 'player_info_container_right'}`} onClick={() => { }}>
        {ENABLE_PLAYER_LEVEL && <div className={`player_info_lv ${position === 'right' && 'player_info_lv_right'}`}>
          <span>Lvl</span>
          <span className="player_info_lvalue">{this.props.player.playerLevel}</span>
        </div>}
        <div className="player_info_player_profile">
          <img src={`/avatars/${this.props.player.playerAvatar? this.props.player.playerAvatar: 'default'}.png`} />
        </div>
        <div className="player_info">
          <p className="player_info_name">{this.props.player.playerName}</p>
          <div className={`player_info_rank ${position === 'right' && 'justify_end'}`}>
            <img src="/icons/gold_rank.png" alt="" />
            <span>RANK {this.props.player.playerRank}</span>
          </div>
          {/* {ENABLE_TEAM_NAME && <div className="player_info_team"><span>TEAM</span></div>}  */}
          <div className="player_info_team"></div>
        </div>
        {this.props.isPlayerTeam && <div className="spectator_container_right">
          {isSpectator &&  <div className="spectator_div">
            <div className="spectator" onClick={() => { }}>
              <img src="/HUD/applause_icon.png" alt="" />
            </div>
            <div className="spectator" onClick={() => { }}>
              <img src="/HUD/donate_icon.png" alt="" />
            </div>
          </div>}
          <div className="spectator" onClick={(e) => this.handleOpenModal(e, false)}>
            <img src="/HUD/settings_icon.png" alt="" />
          </div>
        </div>}
        <Modal isOpen={this.state.modalOpen} style={customStyles} onRequestClose={this.handleCloseModal}>
          <div className="exit_game_label" onClick={(e) => this.handleOpenModal(e, true)}>
            <p>Abandon Game!</p>
          </div>
        </Modal>
        <Modal isOpen={this.state.modalOpen1} onRequestClose={this.handleCloseModal} style={customStyles1}>
          <div className="exit_game_menu flex flex_col gap_4">
            <div className="game_leave_dialog">Are you sure want to abandon the game? This will count as a loss.</div>
            <div className="flex gap_4">
              <div className="game_leave_btn" onClick={this.handleExit}>Leave</div>
              <div className="game_leave_btn" onClick={this.handleCloseModal}>Cancel</div>
            </div>
          </div>
        </Modal>
      </div>
    );
  }
}

export default PlayerInfo;