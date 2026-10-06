import LanguageSelect from '../LanguageSelect';
import {t} from '../../i18n/core';
import { h } from 'preact';
import { Component } from 'preact';
import { events } from '../HUD/GameHUD';
import { isElectron, getElectronAPI } from '../../utils/electronUtils';
import {applyTextSize, defaultGameSettings, loadGameSettings} from '../../settings';

interface SettingsModalProps {
  onClose: () => void;
}

export class SettingsModal extends Component<SettingsModalProps> {
    state = {
      textSize: defaultGameSettings.textSize,
      musicCurrentValue: defaultGameSettings.musicVolume,
      musicMinValue: 0,
      musicMaxValue: 100,
      sfxCurrentValue: 50,
      sfxMinValue: 0,
      sfxMaxValue: 100,
      selectedKeyboardLayout: 1,
      isFullscreen: false,
    }

    componentDidMount() {
      const settings = loadGameSettings();
      this.setState({
        textSize: settings.textSize,
        musicCurrentValue: settings.musicVolume,
        sfxCurrentValue: settings.sfxVolume,
        selectedKeyboardLayout: localStorage.getItem('gameSettings') ? settings.keyboardLayout : this.detectKeyboardLayout(),
        isFullscreen: settings.isFullscreen,
      });
      if (isElectron()) this.checkFullscreenStatus();
    }

    detectKeyboardLayout = () => {
      // This is a simple heuristic and may not be 100% accurate
      const isAZERTY = navigator.language.startsWith('fr') ||
                       navigator.language.startsWith('be') ||
                       navigator.language.startsWith('dz');

      return isAZERTY ? 0 : 1; // 0 for AZERTY, 1 for QWERTY
    }

    componentDidUpdate(_prevProps, prevState) {
      if (prevState.textSize !== this.state.textSize) {
        this.saveSettings();
      }
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
        textSize: this.state.textSize,
        musicVolume: this.state.musicCurrentValue,
        sfxVolume: this.state.sfxCurrentValue,
        keyboardLayout: this.state.selectedKeyboardLayout,
        isFullscreen: this.state.isFullscreen,
      };
      applyTextSize(settings.textSize);
      localStorage.setItem('gameSettings', JSON.stringify(settings));
      events.emit('settingsChanged', settings);  // Emit the settingsChanged event
    }

    checkFullscreenStatus = async () => {
      const electronAPI = getElectronAPI();
      if (electronAPI && electronAPI.isFullscreen) {
        try {
          const fullscreenStatus = await electronAPI.isFullscreen();
          this.setState({ isFullscreen: fullscreenStatus });
        } catch (error) {
          console.error('SettingsModal: Error checking fullscreen status:', error);
        }
      }
    }

    toggleFullscreen = async () => {
      const electronAPI = getElectronAPI();
      if (electronAPI && electronAPI.toggleFullscreen) {
        try {
          const newFullscreenState = await electronAPI.toggleFullscreen();
          this.setState({ isFullscreen: newFullscreenState });
        } catch (error) {
          console.error('SettingsModal: Error toggling fullscreen:', error);
        }
      }
    }

    render() {
      const showElectronSettings = isElectron();

      return (
        <div className="setting_menu flex flex_col gap_4">
          <h2 className="setting_title" id="settings-title">{t("Settings")}</h2>
          <div className="setting_dialog">
            <LanguageSelect />
            <label className="setting_text_size" htmlFor="text-size">
              {t("Text size")}<select id="text-size" value={this.state.textSize} onChange={event => this.setState({textSize: Number((event.target as HTMLSelectElement).value) as typeof this.state.textSize})}>
                <option value="100">{t("Standard (100%)")}</option>
                <option value="115">{t("Large (115%)")}</option>
                <option value="130">{t("Extra large (130%)")}</option>
              </select>
            </label>
            <div className="setting_dialog_keyboard">{t("Keyboard layout:")}</div>
            <div className="setting_dialog_keyboard_btn_container flex justify_center gap_4">
              <button type="button" aria-pressed={this.state.selectedKeyboardLayout === 0} className={this.state.selectedKeyboardLayout === 0 ? "setting_menu_btn setting_menu_btn_active" : "setting_menu_btn setting_menu_btn_inactive"} onClick={() => this.setState({ selectedKeyboardLayout: 0 })}>{t("Azerty")}</button>
              <button type="button" aria-pressed={this.state.selectedKeyboardLayout === 1} className={this.state.selectedKeyboardLayout === 1 ? "setting_menu_btn setting_menu_btn_active" : "setting_menu_btn setting_menu_btn_inactive"} onClick={() => this.setState({ selectedKeyboardLayout: 1 })}>{t("Qwerty")}</button>
            </div>

            {showElectronSettings && (
              <div className="setting_dialog_fullscreen_container padding_top_16 padding_bottom_16">
                <div className="setting_dialog_fullscreen_label padding_y_4">{t("Display mode:")}</div>
                <div className="setting_dialog_fullscreen_checkbox_container flex items_center gap_4 padding_4">
                  <input
                    type="checkbox"
                    id="fullscreen-toggle"
                    className="setting_dialog_fullscreen_checkbox"
                    checked={this.state.isFullscreen}
                    onChange={this.toggleFullscreen}
                  />
                  <label htmlFor="fullscreen-toggle" className="setting_dialog_fullscreen_text">{t("Fullscreen mode")}</label>
                </div>
              </div>
            )}

            <div className="setting_dialog_control_bar_container">
              <div className="setting_dialog_control_name">{t("Music volume:")}</div>
              <div className="setting_dialog_contol_lable_start">{this.state.musicMinValue}</div>
              <input className="setting_dialog_control_bar" type="range" aria-label={t("Music volume")} min={this.state.musicMinValue} max={this.state.musicMaxValue} value={this.state.musicCurrentValue} onInput={(event) => this.setState({musicCurrentValue: Number((event.target as HTMLInputElement).value)})} />
              <div className="setting_dialog_control_label_end">{this.state.musicMaxValue}</div>
            </div>
            <div className="setting_dialog_control_bar_container">
              <div className="setting_dialog_control_name">{t("SFX volume:")}</div>
              <div className="setting_dialog_contol_lable_start">{this.state.sfxMinValue}</div>
              <input className="setting_dialog_control_bar" type="range" aria-label={t("SFX volume")} min={this.state.sfxMinValue} max={this.state.sfxMaxValue} value={this.state.sfxCurrentValue} onInput={(event) => this.setState({sfxCurrentValue: Number((event.target as HTMLInputElement).value)})} />
              <div className="setting_dialog_contol_lable_end">{this.state.sfxMaxValue}</div>
            </div>
          </div>
          <div className="justify_center flex gap_4">
            <button type="button" className="setting_menu_btn setting_close game-btn game-btn--ink" data-desktop-cancel onClick={this.props.onClose}>{t("Close")}</button>
          </div>
        </div>
      );
    }
  }
