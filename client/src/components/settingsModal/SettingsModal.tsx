import { h, Component } from "preact";
import { events } from "../HUD/GameHUD";
import { isElectron, getElectronAPI } from "../../utils/electronUtils";
import { loadGameSettings } from "../../settings";

interface SettingsModalProps {
  onClose: () => void;
}

export class SettingsModal extends Component<SettingsModalProps> {
  state = {
    musicCurrentValue: 50,
    musicMinValue: 0,
    musicMaxValue: 100,
    sfxCurrentValue: 50,
    sfxMinValue: 0,
    sfxMaxValue: 100,
    selectedKeyboardLayout: 1,
    isFullscreen: false,
  };

  componentDidMount() {
    const settings = loadGameSettings();
    this.setState({
      musicCurrentValue: settings.musicVolume,
      sfxCurrentValue: settings.sfxVolume,
      selectedKeyboardLayout: localStorage.getItem("gameSettings")
        ? settings.keyboardLayout
        : this.detectKeyboardLayout(),
      isFullscreen: settings.isFullscreen,
    });
    if (isElectron()) this.checkFullscreenStatus();
  }

  detectKeyboardLayout = () => {
    // This is a simple heuristic and may not be 100% accurate
    const isAZERTY =
      navigator.language.startsWith("fr") || navigator.language.startsWith("be") || navigator.language.startsWith("dz");

    return isAZERTY ? 0 : 1; // 0 for AZERTY, 1 for QWERTY
  };

  componentDidUpdate(prevProps, prevState) {
    if (prevState.musicCurrentValue !== this.state.musicCurrentValue) {
      this.saveSettings();
    }
    if (prevState.sfxCurrentValue !== this.state.sfxCurrentValue) {
      this.saveSettings();
    }
    if (prevState.selectedKeyboardLayout !== this.state.selectedKeyboardLayout) {
      this.saveSettings();
    }
    if (prevState.isFullscreen !== this.state.isFullscreen) {
      this.saveSettings();
    }
  }

  saveSettings = () => {
    const settings = {
      musicVolume: this.state.musicCurrentValue,
      sfxVolume: this.state.sfxCurrentValue,
      keyboardLayout: this.state.selectedKeyboardLayout,
      isFullscreen: this.state.isFullscreen,
    };
    localStorage.setItem("gameSettings", JSON.stringify(settings));
    events.emit("settingsChanged", settings); // Emit the settingsChanged event
  };

  checkFullscreenStatus = async () => {
    const electronAPI = getElectronAPI();
    if (electronAPI && electronAPI.isFullscreen) {
      try {
        const fullscreenStatus = await electronAPI.isFullscreen();
        this.setState({ isFullscreen: fullscreenStatus });
      } catch (error) {
        console.error("SettingsModal: Error checking fullscreen status:", error);
      }
    }
  };

  toggleFullscreen = async () => {
    const electronAPI = getElectronAPI();
    if (electronAPI && electronAPI.toggleFullscreen) {
      try {
        const newFullscreenState = await electronAPI.toggleFullscreen();
        this.setState({ isFullscreen: newFullscreenState });
      } catch (error) {
        console.error("SettingsModal: Error toggling fullscreen:", error);
      }
    }
  };

  render() {
    const showElectronSettings = isElectron();

    return (
      <div className="setting_menu flex flex_col gap_4">
        <div className="setting_dialog">
          <div className="setting_dialog_keyboard">Keyboard layout:</div>
          <div className="setting_dialog_keyboard_btn_container flex justify_center gap_4">
            <button
              className={
                this.state.selectedKeyboardLayout === 0
                  ? "setting_menu_btn setting_menu_btn_active"
                  : "setting_menu_btn setting_menu_btn_inactive"
              }
              onClick={() => this.setState({ selectedKeyboardLayout: 0 })}
            >
              Azerty
            </button>
            <button
              className={
                this.state.selectedKeyboardLayout === 1
                  ? "setting_menu_btn setting_menu_btn_active"
                  : "setting_menu_btn setting_menu_btn_inactive"
              }
              onClick={() => this.setState({ selectedKeyboardLayout: 1 })}
            >
              Qwerty
            </button>
          </div>

          {showElectronSettings && (
            <div className="setting_dialog_fullscreen_container padding_top_16 padding_bottom_16">
              <div className="setting_dialog_fullscreen_label padding_y_4">Display mode:</div>
              <div className="setting_dialog_fullscreen_checkbox_container flex items_center gap_4 padding_4">
                <input
                  type="checkbox"
                  id="fullscreen-toggle"
                  className="setting_dialog_fullscreen_checkbox"
                  checked={this.state.isFullscreen}
                  onChange={this.toggleFullscreen}
                />
                <label htmlFor="fullscreen-toggle" className="setting_dialog_fullscreen_text">
                  Fullscreen mode
                </label>
              </div>
            </div>
          )}

          <div className="setting_dialog_control_bar_container">
            <div className="setting_dialog_control_name">Music volume: </div>
            <div className="setting_dialog_contol_lable_start">{this.state.musicMinValue}</div>
            <input
              className="setting_dialog_control_bar"
              type="range"
              aria-label="Music volume"
              min={this.state.musicMinValue}
              max={this.state.musicMaxValue}
              value={this.state.musicCurrentValue}
              onInput={(event) =>
                this.setState({ musicCurrentValue: Number((event.target as HTMLInputElement).value) })
              }
            />
            <div className="setting_dialog_control_label_end">{this.state.musicMaxValue}</div>
          </div>
          <div className="setting_dialog_control_bar_container">
            <div className="setting_dialog_control_name">SFX volume: </div>
            <div className="setting_dialog_contol_lable_start">{this.state.sfxMinValue}</div>
            <input
              className="setting_dialog_control_bar"
              type="range"
              aria-label="SFX volume"
              min={this.state.sfxMinValue}
              max={this.state.sfxMaxValue}
              value={this.state.sfxCurrentValue}
              onInput={(event) => this.setState({ sfxCurrentValue: Number((event.target as HTMLInputElement).value) })}
            />
            <div className="setting_dialog_contol_lable_end">{this.state.sfxMaxValue}</div>
          </div>
        </div>
        <div className="justify_center flex gap_4">
          <button className="setting_menu_btn" data-desktop-cancel onClick={this.props.onClose}>
            Exit
          </button>
        </div>
      </div>
    );
  }
}
