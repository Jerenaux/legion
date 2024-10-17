import { h, Component } from 'preact';
import { route } from 'preact-router';
import Modal from 'react-modal';
import { PlayerProfileData } from "@legion/shared/interfaces";
import { getLeagueIcon, loadAvatar } from "../utils";

import { ENABLE_PLAYER_LEVEL, ENABLE_SETTINGS } from '@legion/shared/config';

import teamBg from '@assets/HUD/team_bg.png';
import teamBgReverse from '@assets/HUD/team_bg_reverse.png';
import applauseIcon from '@assets/HUD/applause_icon.png';
import donateIcon from '@assets/HUD/donate_icon.png';
import settingsIcon from '@assets/HUD/settings_icon.png';
import { SettingsModal } from '../settingsModal/SettingsModal';

interface Props {
  player: PlayerProfileData;
  position: string;
  isSpectator: boolean;
  eventEmitter: any;
  isPlayerTeam: boolean;
}
interface State {
  isMenuModalOpen: boolean;
  isExitModalOpen: boolean;
  isSettingsModalOpen: boolean;
  modalPos: any;
}

class PlayerInfo extends Component<Props, State> {
  state = {
    isMenuModalOpen: false,
    isExitModalOpen: false,
    isSettingsModalOpen: false,
    modalPos: null,
  }

  handleOpenModal = (e, modalType) => {
    if (modalType === "menu_modal") {
      const elementRect = e.currentTarget.getBoundingClientRect();
      const modalPosition = {
        top: elementRect.top + elementRect.height,
        left: elementRect.left - 56,
      };
      this.setState({ isMenuModalOpen: true, modalPos: modalPosition });
    } else if (modalType === "exit_modal") {
      this.setState({ isMenuModalOpen: false, isExitModalOpen: true, isSettingsModalOpen: false });
    } else if (modalType === "setting_modal") {
      this.setState({ isMenuModalOpen: false, isExitModalOpen: false, isSettingsModalOpen: true });
    }
  }

  handleCloseModal = () => {
    this.setState({
      isMenuModalOpen: false,
      isExitModalOpen: false,
      isSettingsModalOpen: false,
    });
  }

  handleExit = () => {
    this.props.eventEmitter.emit('abandonGame');
    route('/play');
  }

  render() {
    const { player, position, isSpectator, isPlayerTeam } = this.props;

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

    const isBot = player.playerRank == -1;

    return (
      <div className={`player_info_container relative ${position === 'right' && 'player_info_container_right'}`} onClick={() => { }}>
        {ENABLE_PLAYER_LEVEL && <div className={`player_info_lv ${position === 'right' && 'player_info_lv_right'}`}>
          <span>Lvl</span>
          <span className="player_info_lvalue">{player.playerLevel}</span>
        </div>}
        <div className="player_info_player_profile">
          <img src={player.playerAvatar ? loadAvatar(player.playerAvatar) : loadAvatar('default')} />
        </div>
        <div className="player_info">
          <div
            className="player_info_name"
            style={position === 'right' ? { backgroundImage: `url(${teamBgReverse})`, textAlign: "right" } : { backgroundImage: `url(${teamBg})` }}
          >
            {!isBot && player.playerName}
            {isBot && <div class="glitch">
              {player.playerName}
                <span aria-hidden="true">{player.playerName}</span>
                <span aria-hidden="true">{player.playerName}</span>
            </div>}
          </div>
          <div className={`player_info_rank ${position === 'right' && 'row_reverse'}`}>
            <img src={getLeagueIcon(player.playerLeague)} alt="" />
            <span>{!isBot ? `# ${player.playerRank}` : ''}</span>
          </div>
        </div>
        {isPlayerTeam && <div className={position === 'right' ? "spectator_container_right" : "spectator_container"}>
          {isSpectator && <div className="spectator_div">
            <div className="spectator" onClick={() => { }}>
              <img src={applauseIcon} alt="" />
            </div>
            <div className="spectator" onClick={() => { }}>
              <img src={donateIcon} alt="" />
            </div>
          </div>}
          <div className="spectator" onClick={(e) => this.handleOpenModal(e, "menu_modal")}>
            <img src={settingsIcon} alt="" />
          </div>
        </div>}
        <Modal isOpen={this.state.isMenuModalOpen} style={customStyles} onRequestClose={this.handleCloseModal}>
          <div>
            {ENABLE_SETTINGS && <div className="game_setting" onClick={(e) => this.handleOpenModal(e, "setting_modal")}>
              <p>Settings</p>
            </div>}
            <div className="exit_game_label" onClick={(e) => this.handleOpenModal(e, "exit_modal")}>
              <p>Abandon Game!</p>
            </div>
          </div>
        </Modal>
        <Modal isOpen={this.state.isExitModalOpen} onRequestClose={this.handleCloseModal} style={customStyles1}>
          <div className="exit_game_menu flex flex_col gap_4">
            <div className="game_leave_dialog">Are you sure want to abandon the game? This will count as a loss.</div>
            <div className="flex gap_4">
              <div className="game_leave_btn" onClick={this.handleExit}>Leave</div>
              <div className="game_leave_btn" onClick={this.handleCloseModal}>Cancel</div>
            </div>
          </div>
        </Modal>
        <Modal isOpen={this.state.isSettingsModalOpen} onRequestClose={this.handleCloseModal} style={customStyles1}>
          <SettingsModal onClose={this.handleCloseModal} />
        </Modal>
      </div>
    );
  }
}

export default PlayerInfo;