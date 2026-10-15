import {t} from '../../i18n/core';
import { h } from 'preact';
import { Component } from 'preact';
import { SettingsModal } from '../settingsModal/SettingsModal';
import { isElectron, getElectronAPI } from '../../utils/electronUtils';
import Modal from 'react-modal';
import './SystemMenu.css';

export const OPEN_SYSTEM_MENU_EVENT = 'legion:open-system-menu';
export const openSystemMenu = () => window.dispatchEvent(new Event(OPEN_SYSTEM_MENU_EVENT));

export function quitGame() {
  void getElectronAPI()?.quitApp?.();
}

// Opened with Esc or the controller's Menu button outside combat: resume, settings or quit.
export class SystemMenu extends Component<{}, {view: 'closed' | 'menu' | 'settings'}> {
  state = {view: 'closed' as const};
  private previousFocus: HTMLElement | null = null;

  componentDidMount() {
    window.addEventListener(OPEN_SYSTEM_MENU_EVENT, this.open);
  }

  componentWillUnmount() {
    window.removeEventListener(OPEN_SYSTEM_MENU_EVENT, this.open);
  }

  open = () => {
    if (this.state.view !== 'closed') return;
    this.previousFocus = document.activeElement as HTMLElement;
    this.setState({view: 'menu'});
  };

  close = () => {
    this.setState({view: 'closed'}, () => this.previousFocus?.focus?.({preventScroll: true}));
  };

  focusFirst = (element: HTMLElement | null) => element?.focus({preventScroll: true});

  render() {
    const {view} = this.state;
    if (view === 'closed') return null;
    if (view === 'settings') {
      return <SettingsModal onClose={this.close} />;
    }
    return (
      <Modal isOpen onRequestClose={this.close} className="system-menu loot-popup" overlayClassName="loot-popup-scrim"
        aria={{labelledby: 'system-menu-title'}} shouldReturnFocusAfterClose={false}>
        <h2 id="system-menu-title">{t("Game menu")}</h2>
        <div className="system-menu-actions">
          <button type="button" className="game-btn game-btn--gold" ref={this.focusFirst} data-desktop-cancel onClick={this.close}>{t("Resume")}</button>
          <button type="button" className="game-btn game-btn--ink" onClick={() => this.setState({view: 'settings'})}>{t("Settings")}</button>
          {isElectron() && <button type="button" className="game-btn game-btn--ink system-menu-quit" onClick={quitGame}>{t("Quit game")}</button>}
        </div>
      </Modal>
    );
  }
}

export default SystemMenu;
