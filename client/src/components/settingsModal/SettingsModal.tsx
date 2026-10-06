import LanguageSelect from '../LanguageSelect';
import {t} from '../../i18n/core';
import { h } from 'preact';
import { Component } from 'preact';
import { events } from '../HUD/GameHUD';
import { isElectron, getElectronAPI } from '../../utils/electronUtils';
import {GameSettings, loadGameSettings, saveGameSettings} from '../../settings';
import ControlsSettings from './ControlsSettings';
import './SettingsModal.css';

interface SettingsModalProps {
  onClose: () => void;
}

type Tab = 'general' | 'controls';

export class SettingsModal extends Component<SettingsModalProps, {settings: GameSettings; isFullscreen: boolean; tab: Tab}> {
    state = {settings: loadGameSettings(), isFullscreen: false, tab: 'general' as Tab};

    componentDidMount() {
      if (!isElectron()) return;
      this.checkFullscreenStatus();
      // F11, the macOS window button and the checkbox all resize the window; keep the box in sync.
      window.addEventListener('resize', this.checkFullscreenStatus);
    }

    componentWillUnmount() {
      window.removeEventListener('resize', this.checkFullscreenStatus);
    }

    update = (change: Partial<GameSettings>) => {
      const settings = saveGameSettings(change);
      this.setState({settings});
      events.emit('settingsChanged', settings);
    };

    checkFullscreenStatus = async () => {
      try {
        const isFullscreen = await getElectronAPI()?.isFullscreen?.();
        this.setState({isFullscreen: Boolean(isFullscreen)});
      } catch (error) {
        console.error('SettingsModal: Error checking fullscreen status:', error);
      }
    };

    // The desktop shell saves the display mode itself, so it survives restarts.
    toggleFullscreen = async () => {
      try {
        const isFullscreen = await getElectronAPI()?.toggleFullscreen?.();
        this.setState({isFullscreen: Boolean(isFullscreen)});
      } catch (error) {
        console.error('SettingsModal: Error toggling fullscreen:', error);
      }
    };

    renderVolume(kind: 'music' | 'sfx') {
      const {settings} = this.state;
      const value = kind === 'music' ? settings.musicVolume : settings.sfxVolume;
      const muted = kind === 'music' ? settings.musicMuted : settings.sfxMuted;
      return (
        <div className="setting_dialog_control_bar_container" data-muted={muted}>
          <div className="setting_dialog_control_name">{kind === 'music' ? t("Music volume:") : t("SFX volume:")}</div>
          <input className="setting_dialog_control_bar" type="range" aria-label={kind === 'music' ? t("Music volume") : t("SFX volume")}
            min={0} max={100} value={value}
            onInput={event => this.update(kind === 'music'
              ? {musicVolume: Number((event.target as HTMLInputElement).value), musicMuted: false}
              : {sfxVolume: Number((event.target as HTMLInputElement).value), sfxMuted: false})} />
          <span className="setting_volume_value">{muted ? '0' : value}</span>
          <button type="button" className="setting_mute" aria-pressed={muted}
            aria-label={kind === 'music' ? t("Mute music") : t("Mute sound effects")}
            onClick={() => this.update(kind === 'music' ? {musicMuted: !muted} : {sfxMuted: !muted})}>{t("muteButton")}</button>
        </div>
      );
    }

    renderGeneral() {
      const {settings} = this.state;
      return (
        <div className="setting_dialog" role="tabpanel" id="settings-panel-general" aria-labelledby="settings-tab-general">
          <LanguageSelect />
          <label className="setting_text_size" htmlFor="text-size">
            {t("Text size")}<select id="text-size" value={settings.textSize} onChange={event => this.update({textSize: Number((event.target as HTMLSelectElement).value) as GameSettings['textSize']})}>
              <option value="100">{t("Standard (100%)")}</option>
              <option value="115">{t("Large (115%)")}</option>
              <option value="130">{t("Extra large (130%)")}</option>
            </select>
          </label>

          {isElectron() && (
            <div className="setting_check">
              <input type="checkbox" id="fullscreen-toggle" checked={this.state.isFullscreen} onChange={this.toggleFullscreen} />
              <label htmlFor="fullscreen-toggle">{t("Fullscreen mode")}</label>
            </div>
          )}

          <div className="setting_check">
            <input type="checkbox" id="colorblind-toggle" aria-describedby="colorblind-help" checked={settings.colorblind}
              onChange={() => this.update({colorblind: !settings.colorblind})} />
            <label htmlFor="colorblind-toggle">{t("Colorblind mode")}</label>
            <small id="colorblind-help">{t("Blue and orange replace green and red on the battlefield.")}</small>
          </div>

          {this.renderVolume('music')}
          {this.renderVolume('sfx')}
        </div>
      );
    }

    render() {
      const {tab} = this.state;
      const tabButton = (id: Tab, label: string) => (
        <button type="button" role="tab" id={`settings-tab-${id}`} aria-selected={tab === id} aria-controls={`settings-panel-${id}`}
          className="setting_tab" onClick={() => this.setState({tab: id})}>{label}</button>
      );
      return (
        <div className={`setting_menu flex flex_col gap_4 ${tab === 'controls' ? 'is-wide' : ''}`}>
          <h2 className="setting_title" id="settings-title">{t("Settings")}</h2>
          <div className="setting_tabs" role="tablist" aria-label={t("Settings")}>
            {tabButton('general', t("General"))}
            {tabButton('controls', t("Controls"))}
          </div>
          {tab === 'general' ? this.renderGeneral() : (
            <div className="setting_dialog" role="tabpanel" id="settings-panel-controls" aria-labelledby="settings-tab-controls">
              <ControlsSettings />
            </div>
          )}
          <div className="justify_center flex gap_4">
            <button type="button" className="setting_menu_btn setting_close game-btn game-btn--ink" data-desktop-cancel onClick={this.props.onClose}>{t("Close")}</button>
          </div>
        </div>
      );
    }
  }
