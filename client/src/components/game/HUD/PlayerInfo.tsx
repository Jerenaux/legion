// PlayerInfo.tsx
import { h, Component } from 'preact';
import { route } from 'preact-router';
import Modal from 'react-modal';

interface Props {
  player: any;
  position: string;
  isSpectator: boolean;
}

class PlayerInfo extends Component<Props> {
  state = {
    modalOpen: false,
    modalOpen1: false,
    modalPos: null
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

    return (
      <div className={`player_info_container relative ${position === 'right' && 'player_info_container_right'}`} onClick={() => { }}>
        <div className={`player_info_lv ${position === 'right' && 'player_info_lv_right'}`}>
          <span>Lv</span>
          <span className="player_info_lvalue">{this.props.player.level}</span>
        </div>
        <div className="player_info_player_profile"></div>
        <div className="player_info">
          <p className="player_info_name">{this.props.player.name}</p>
          <div className={`player_info_rank ${position === 'right' && 'justify_end'}`}>
            <img src="/icons/gold_rank.png" alt="" />
            <span>RANK {this.props.player.rank}</span>
          </div>
          <div className="player_info_team"><span>TEAM</span></div>
        </div>
        {position === 'right' && <div className="spectator_container_right">
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
          <div className="exit_game_menu" onClick={(e) => this.handleOpenModal(e, true)}>
            <p>Exit Game!</p>
          </div>
        </Modal>
        <Modal isOpen={this.state.modalOpen1} onRequestClose={this.handleCloseModal} style={customStyles1}>
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