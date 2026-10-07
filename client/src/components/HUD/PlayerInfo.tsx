import {t} from '../../i18n/core';
import { h } from 'preact';
import { Component } from 'preact';
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
import { EventEmitter } from 'eventemitter3';
import {DESKTOP_ACTION_EVENT, DesktopAction} from '../../input/actions';

interface Props {
  player: PlayerProfileData;
  position: string;
  isSpectator: boolean;
  eventEmitter: EventEmitter;
  isPlayerTeam: boolean;
}
interface State {
  isMenuModalOpen: boolean;
  isExitModalOpen: boolean;
  isSettingsModalOpen: boolean;
  modalPos: {top: number; left: number} | null;
}

class PlayerInfo extends Component<Props, State> {
  state = {
    isMenuModalOpen: false,
    isExitModalOpen: false,
    isSettingsModalOpen: false,
    modalPos: null,
  }

  componentDidMount() {
    window.addEventListener(DESKTOP_ACTION_EVENT, this.handleDesktopAction as EventListener);
  }

  componentWillUnmount() {
    window.removeEventListener(DESKTOP_ACTION_EVENT, this.handleDesktopAction as EventListener);
  }

  handleDesktopAction = (event: CustomEvent<{action: DesktopAction}>) => {
    // Esc in combat offers the game menu (Settings or Abandon) rather than jumping straight
    // to the abandon confirmation; Abandon there still asks for confirmation.
    if (event.detail.action === 'abandon-dialog' && this.props.isPlayerTeam) {
      this.handleOpenModal(null, 'menu_modal');
    }
  };

  handleOpenModal = (e, modalType) => {
    if (modalType === "menu_modal") {
      // Anchor to the gear; the tutorial can hide it, so fall back to the top-left corner.
      const gear = (e?.currentTarget ?? document.querySelector('[data-game-menu]')) as HTMLElement | null;
      const elementRect = gear?.getClientRects().length ? gear.getBoundingClientRect() : {top: 16, right: 6} as DOMRect;
      // Open beside the gear so the menu never covers the player's own name and rank.
      const modalPosition = {
        top: elementRect.top,
        left: elementRect.right + 10,
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

    const isBot = player.playerRank === -1;

    return (
      <div className={`player_info_container relative ${position === 'right' && 'player_info_container_right'}`}>
        {ENABLE_PLAYER_LEVEL && <div className={`player_info_lv ${position === 'right' && 'player_info_lv_right'}`}>
          <span>{t("Lvl")}</span>
          <span className="player_info_lvalue">{player.playerLevel}</span>
        </div>}
        <div className="player_info_player_profile">
          <img src={player.playerAvatar ? loadAvatar(player.playerAvatar) : loadAvatar('default')} alt={t("{{value0}} avatar", {value0: player.playerName})} />
        </div>
        <div className="player_info">
          <div
            className="player_info_name"
            style={position === 'right' ? { backgroundImage: `url(${teamBgReverse})`, textAlign: "right" } : { backgroundImage: `url(${teamBg})` }}
          >
            {!isBot && player.playerName}
            {isBot && <div class="glitch">
              {player.playerName}
            </div>}
          </div>
          <div className={`player_info_rank ${position === 'right' && 'row_reverse'}`}>
            <img src={getLeagueIcon(player.playerLeague)} alt={""} />
            <span>{!isBot ? `# ${player.playerRank}` : ''}</span>
          </div>
        </div>
        {isPlayerTeam && <div className={position === 'right' ? "spectator_container_right" : "spectator_container"}>
          {isSpectator && <div className="spectator_div">
            <div className="spectator">
              <img src={applauseIcon} alt={""} />
            </div>
            <div className="spectator">
              <img src={donateIcon} alt={""} />
            </div>
          </div>}
          <button type="button" className="spectator" data-game-menu aria-label={t("Game menu")} onClick={(e) => this.handleOpenModal(e, "menu_modal")}>
            <img src={settingsIcon} alt={""} />
          </button>
        </div>}
        <Modal contentLabel={t("Game menu")} isOpen={this.state.isMenuModalOpen} style={customStyles} onRequestClose={this.handleCloseModal}
          onAfterOpen={() => document.querySelector<HTMLButtonElement>('.game_menu_panel button')?.focus()}>
          <div className="game_menu_panel">
            {ENABLE_SETTINGS && <button type="button" className="game_setting" onClick={(e) => this.handleOpenModal(e, "setting_modal")}>
              <p>{t("Settings")}</p>
            </button>}
            <button type="button" className="exit_game_label" onClick={(e) => this.handleOpenModal(e, "exit_modal")}>
              <p>{t("Abandon Game!")}</p>
            </button>
          </div>
        </Modal>
        <Modal contentLabel={t("Abandon Game!")} isOpen={this.state.isExitModalOpen} onRequestClose={this.handleCloseModal} style={customStyles1}
          onAfterOpen={() => document.querySelector<HTMLButtonElement>('.exit_game_menu [data-desktop-cancel]')?.focus()}>
          <div className="exit_game_menu flex flex_col gap_4">
            <div className="game_leave_dialog">{t("Are you sure you want to abandon the game? This will count as a loss.")}</div>
            <div className="game_leave_actions">
              <button type="button" className="game_leave_btn game_leave_btn_danger" onClick={this.handleExit}>{t("Leave")}</button>
              <button type="button" className="game_leave_btn" data-desktop-cancel onClick={this.handleCloseModal}>{t("Cancel")}</button>
            </div>
          </div>
        </Modal>
        <Modal isOpen={this.state.isSettingsModalOpen} onRequestClose={this.handleCloseModal} style={customStyles1} aria={{labelledby: "settings-title"}}>
          <SettingsModal onClose={this.handleCloseModal} />
        </Modal>
      </div>
    );
  }
}

export default PlayerInfo;
