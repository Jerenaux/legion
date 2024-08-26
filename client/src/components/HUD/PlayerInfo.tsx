// PlayerInfo.tsx
import { h, Component, createRef } from 'preact';
import { route } from 'preact-router';
import Modal from 'react-modal';
import { PlayerProfileData } from "@legion/shared/interfaces";
import {getLeagueIcon} from "../utils";

import { ENABLE_PLAYER_LEVEL, ENABLE_SETTINGS } from '@legion/shared/config';

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
  modalOpen2: boolean;
  modalPos: any;
  musicCurrentValue: number;
  musicMinValue: number;
  musicMaxValue: number;
  sfxCurrentValue: number;
  sfxMinValue: number;
  sfxMaxValue: number;
  settingMenuCur: number;
}

class PlayerInfo extends Component<Props, State> {
  events: any;

  musicControlLineRef = createRef();
  musicControlThumbRef = createRef();
  sfxControlLineRef = createRef();
  sfxControlThumbRef = createRef();

  constructor(props: Props) {
    super(props);
    this.state = {
      modalOpen: false,
      modalOpen1: false,
      modalOpen2: false,
      modalPos: null,
      musicCurrentValue: 50,
      musicMinValue: 0,
      musicMaxValue: 100,
      sfxCurrentValue: 50,
      sfxMinValue: 0,
      sfxMaxValue: 100,
      settingMenuCur: 0,
    }
    this.events = this.props.eventEmitter;
  }

  componentDidMount() {
    this.updateMusicControlThumb();
    this.updateSFXControlThumb();
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevState.musicCurrentValue !== this.state.musicCurrentValue) {
      this.updateMusicControlThumb();
    }
    if (prevState.sfxCurrentValue !== this.state.sfxCurrentValue) {
      this.updateSFXControlThumb();
    }
  }

  updateMusicControlThumb = () => {
    if (this.musicControlLineRef.current && this.musicControlThumbRef.current) {
      const musicControlLineRect = this.musicControlLineRef.current.getBoundingClientRect();
      const musicThumbPosition = ((this.state.musicCurrentValue - this.state.musicMinValue) / (this.state.musicMaxValue - this.state.musicMinValue)) * musicControlLineRect.width;
      this.musicControlThumbRef.current.style.left = `${musicThumbPosition}px`;
    }
  }

  handleMusicThumbDrag = (event) => {
    event.preventDefault();

    const musicControlLineRect = this.musicControlLineRef.current.getBoundingClientRect();

    const handleMusicMouseMove = (e) => {
      const newPosition = e.clientX - musicControlLineRect.left;
      const newValue = ((newPosition / musicControlLineRect.width) * (this.state.musicMaxValue - this.state.musicMinValue)) + this.state.musicMinValue;
      this.setState({ musicCurrentValue: Math.max(this.state.musicMinValue, Math.min(this.state.musicMaxValue, newValue)) });
    };

    const handleMusicMouseUp = () => {
      document.removeEventListener('mousemove', handleMusicMouseMove);
      document.removeEventListener('mouseup', handleMusicMouseUp);
    };

    document.addEventListener('mousemove', handleMusicMouseMove);
    document.addEventListener('mouseup', handleMusicMouseUp);
  };

  updateSFXControlThumb = () => {
    if (this.sfxControlLineRef.current && this.sfxControlThumbRef.current) {
      const sfxControlLineRect = this.sfxControlLineRef.current.getBoundingClientRect();
      const sfxThumbPosition = ((this.state.sfxCurrentValue - this.state.sfxMinValue) / (this.state.sfxMaxValue - this.state.sfxMinValue)) * sfxControlLineRect.width;
      this.sfxControlThumbRef.current.style.left = `${sfxThumbPosition}px`;
    }
  }

  handleSFXThumbDrag = (event) => {
    event.preventDefault();

    const sfxControlLineRect = this.sfxControlLineRef.current.getBoundingClientRect();

    const handleSFXMouseMove = (e) => {
      const newPosition = e.clientX - sfxControlLineRect.left;
      const newValue = ((newPosition / sfxControlLineRect.width) * (this.state.sfxMaxValue - this.state.sfxMinValue)) + this.state.sfxMinValue;
      this.setState({ sfxCurrentValue: Math.max(this.state.sfxMinValue, Math.min(this.state.sfxMaxValue, newValue)) });
    };

    const handleSFXMouseUp = () => {
      document.removeEventListener('mousemove', handleSFXMouseMove);
      document.removeEventListener('mouseup', handleSFXMouseUp);
    };

    document.addEventListener('mousemove', handleSFXMouseMove);
    document.addEventListener('mouseup', handleSFXMouseUp);
  };

  handleOpenModal = (e: any, modalType: string) => {
    if (modalType !== "menu_modal") {
      if (modalType === "exit_modal") {
        this.setState({ modalOpen: false, modalOpen1: true, modalOpen2: false });
        return;
      } else {
        this.setState({ modalOpen: false, modalOpen1: false, modalOpen2: true });
        return;
      }
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
      modalOpen1: false,
      modalOpen2: false,
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

    const isBot = this.props.player.playerRank == -1;

    return (
      <div className={`player_info_container relative ${position === 'right' && 'player_info_container_right'}`} onClick={() => { }}>
        {ENABLE_PLAYER_LEVEL && <div className={`player_info_lv ${position === 'right' && 'player_info_lv_right'}`}>
          <span>Lvl</span>
          <span className="player_info_lvalue">{this.props.player.playerLevel}</span>
        </div>}
        <div className="player_info_player_profile">
          <img src={`/avatars/${this.props.player.playerAvatar ? this.props.player.playerAvatar : 'default'}.png`} />
        </div>
        <div className="player_info">
          <div
            className="player_info_name"
            style={position === 'right' ? { backgroundImage: `url("/HUD/team_bg_reverse.png")`, textAlign: "right" } : { backgroundImage: `url("/HUD/team_bg.png")` }}
          >
            {!isBot && this.props.player.playerName}
            {isBot && <div class="glitch">
              {this.props.player.playerName}
                <span aria-hidden="true">{this.props.player.playerName}</span>
                <span aria-hidden="true">{this.props.player.playerName}</span>
            </div>}
          </div>
          <div className={`player_info_rank ${position === 'right' && 'row_reverse'}`}>
            <img src={getLeagueIcon(this.props.player.playerLeague)} alt="" />
            <span>{!isBot ? `# ${this.props.player.playerRank}` : ''}</span>
          </div>
        </div>
        {this.props.isPlayerTeam && <div className={position === 'right' ? "spectator_container_right" : "spectator_container"}>
          {isSpectator && <div className="spectator_div">
            <div className="spectator" onClick={() => { }}>
              <img src="/HUD/applause_icon.png" alt="" />
            </div>
            <div className="spectator" onClick={() => { }}>
              <img src="/HUD/donate_icon.png" alt="" />
            </div>
          </div>}
          <div className="spectator" onClick={(e) => this.handleOpenModal(e, "menu_modal")}>
            <img src="/HUD/settings_icon.png" alt="" />
          </div>
        </div>}
        <Modal isOpen={this.state.modalOpen} style={customStyles} onRequestClose={this.handleCloseModal}>
          <div>
            {ENABLE_SETTINGS && <div className="game_setting" onClick={(e) => this.handleOpenModal(e, "setting_modal")}>
              <p>Settings</p>
            </div>}
            <div className="exit_game_label" onClick={(e) => this.handleOpenModal(e, "exit_modal")}>
              <p>Abandon Game!</p>
            </div>
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
        <Modal isOpen={this.state.modalOpen2} onRequestClose={this.handleCloseModal} style={customStyles1}>
          <div className="setting_menu flex flex_col gap_4">
            <div className="setting_dialog">
              <div className="setting_dialog_keyboard">
                Keyboard layout:
              </div>
              <div className="setting_dialog_keyboard_btn_container flex justify_center gap_4">
                <div className={this.state.settingMenuCur === 0 ? "setting_menu_btn setting_menu_btn_active" : "setting_menu_btn setting_menu_btn_inactive"} onClick={() => this.setState({ settingMenuCur: 0 })}>Azerty</div>
                <div className={this.state.settingMenuCur === 1 ? "setting_menu_btn setting_menu_btn_active" : "setting_menu_btn setting_menu_btn_inactive"} onClick={() => this.setState({ settingMenuCur: 1 })}>Qwerty</div>
              </div>
              <div className="setting_dialog_control_bar_container">
                <div className="setting_dialog_control_name">Music volume: </div>
                <div className="setting_dialog_contol_lable_start">{this.state.musicMinValue}</div>
                <div className="setting_dialog_control_bar">
                  <div className="setting_dialog_control_line" ref={this.musicControlLineRef}>
                    <div className="setting_dialog_control_thumb" ref={this.musicControlThumbRef} onMouseDown={this.handleMusicThumbDrag}></div>
                  </div>
                </div>
                <div className="setting_dialog_control_label_end">{this.state.musicMaxValue}</div>
              </div>
              <div className="setting_dialog_control_bar_container">
                <div className="setting_dialog_control_name">SFX volume: </div>
                <div className="setting_dialog_contol_lable_start">{this.state.sfxMinValue}</div>
                <div className="setting_dialog_control_bar">
                  <div className="setting_dialog_control_line" ref={this.sfxControlLineRef}>
                    <div className="setting_dialog_control_thumb" ref={this.sfxControlThumbRef} onMouseDown={this.handleSFXThumbDrag}></div>
                  </div>
                </div>
                <div className="setting_dialog_contol_lable_end">{this.state.sfxMaxValue}</div>
              </div>
            </div>
            <div className="justify_center flex gap_4">
              {/* <div className="setting_exit_btn" onClick={() => {}}>Leave</div> */}
              <div className="setting_menu_btn" onClick={this.handleCloseModal}>Exit</div>
            </div>
          </div>
        </Modal>
      </div>
    );
  }
}

export default PlayerInfo;