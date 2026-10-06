import {t} from '../../i18n/core';
import { h, Fragment } from 'preact';
import { Component } from 'preact';
import { CONTROLS_CHANGED_EVENT, DesktopAction } from '../../input/actions';
import {
  BINDINGS, BindingContext, KEY_SLOTS, assignButton, assignKey, buttonLabel, buttonsFor, comboFromEvent, keyLabel, keysFor,
} from '../../input/bindings';
import { captureNextButton } from '../../input/gamepad';
import { loadGameSettings, saveGameSettings } from '../../settings';
import { getElectronAPI } from '../../utils/electronUtils';

type Capture = {action: DesktopAction; slot: number | 'pad'} | null;

const SLOT_ACTION = /^(item|spell|select-unit)-(\d)$/;
const FIXED_NAMES: Partial<Record<DesktopAction, string>> = {
  'end-turn': 'Pass Turn', 'next-unit': 'Next character', 'previous-unit': 'Previous character', pause: 'Game menu',
  'abandon-dialog': 'Abandon Game!', confirm: 'Confirm', cancel: 'Cancel',
  'menu-up': 'Move up', 'menu-down': 'Move down', 'menu-left': 'Move left', 'menu-right': 'Move right',
};

export function actionName(action: DesktopAction) {
  const slot = SLOT_ACTION.exec(action);
  if (slot) {
    const value0 = slot[2];
    return slot[1] === 'item' ? t('Item {{value0}}', {value0}) : slot[1] === 'spell' ? t('Spell {{value0}}', {value0})
      : t('Select character {{value0}}', {value0});
  }
  return t(FIXED_NAMES[action] ?? action);
}

const CONTEXTS: {context: BindingContext; label: string}[] = [{context: 'combat', label: 'Combat'}, {context: 'menu', label: 'Menus'}];

// Rebind any action to up to two keys and one controller button.
export class ControlsSettings extends Component<{}, {controls: ReturnType<typeof loadGameSettings>['controls']; capture: Capture; notice: string; family: 'xbox' | 'playstation'}> {
  state = {controls: loadGameSettings().controls, capture: null as Capture, notice: '', family: 'xbox' as const};
  private captureTimer: ReturnType<typeof setTimeout> | null = null;

  async componentDidMount() {
    try {
      const type = await getElectronAPI()?.getControllerType?.();
      if (type && /ps\d|playstation|dualsense|dualshock/i.test(type)) this.setState({family: 'playstation'});
    } catch { /* Generic labels remain correct for standard controllers. */ }
  }

  componentWillUnmount() {
    this.stopCapture();
  }

  save(controls: typeof this.state.controls, displaced: DesktopAction | null, label: string) {
    saveGameSettings({controls});
    window.dispatchEvent(new Event(CONTROLS_CHANGED_EVENT));
    this.setState({controls, capture: null,
      notice: displaced ? t('{{key}} was removed from {{action}}.', {key: label, action: actionName(displaced)}) : ''});
  }

  startCapture(action: DesktopAction, slot: number | 'pad') {
    this.stopCapture();
    this.setState({capture: {action, slot}, notice: ''});
    window.addEventListener('keydown', this.handleCaptureKey, true);
    if (slot === 'pad') {
      captureNextButton(button => {
        const {controls, displaced} = assignButton(this.state.controls, action, button);
        this.stopCapture();
        this.save(controls, displaced, buttonLabel(button, this.state.family));
      });
      // A controller press is optional; stop waiting rather than trap the next press forever.
      this.captureTimer = setTimeout(() => this.cancelCapture(), 8000);
    }
  }

  stopCapture() {
    window.removeEventListener('keydown', this.handleCaptureKey, true);
    captureNextButton(null);
    if (this.captureTimer) clearTimeout(this.captureTimer);
    this.captureTimer = null;
  }

  cancelCapture = () => {
    this.stopCapture();
    this.setState({capture: null});
  };

  // Runs before every other key handler, so the pressed key only ever becomes a binding.
  handleCaptureKey = (event: KeyboardEvent) => {
    const {capture} = this.state;
    if (!capture) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.code === 'Escape' && !event.shiftKey) return this.cancelCapture();
    if (capture.slot === 'pad') {
      if (event.code === 'Backspace' || event.code === 'Delete') {
        const {controls} = assignButton(this.state.controls, capture.action, null);
        this.stopCapture();
        this.save(controls, null, '');
      }
      return;
    }
    if (event.code === 'Backspace' || event.code === 'Delete') {
      const {controls} = assignKey(this.state.controls, capture.action, capture.slot, null);
      this.stopCapture();
      return this.save(controls, null, '');
    }
    const combo = comboFromEvent(event);
    if (!combo) return;
    const {controls, displaced} = assignKey(this.state.controls, capture.action, capture.slot, combo);
    this.stopCapture();
    this.save(controls, displaced, keyLabel(combo, t));
  };

  reset = () => {
    this.cancelCapture();
    this.save({}, null, '');
  };

  renderCell(action: DesktopAction, slot: number | 'pad', label: string) {
    const {capture} = this.state;
    const listening = capture?.action === action && capture.slot === slot;
    const column = slot === 'pad' ? t('Controller') : slot === 0 ? t('Key') : t('Second key');
    return (
      <td>
        <button type="button" className={`controls-binding ${listening ? 'is-listening' : ''} ${label ? '' : 'is-empty'}`}
          aria-label={`${actionName(action)}, ${column}: ${listening ? (slot === 'pad' ? t('Press a button…') : t('Press a key…')) : label || t('Unassigned')}`}
          onClick={() => listening ? this.cancelCapture() : this.startCapture(action, slot)}
          onBlur={() => { if (listening && slot !== 'pad') this.cancelCapture(); }}>
          {listening ? (slot === 'pad' ? t('Press a button…') : t('Press a key…')) : label || '—'}
        </button>
      </td>
    );
  }

  render() {
    const {controls, notice, family} = this.state;
    return (
      <div className="controls-settings">
        <p className="controls-help">{t('Esc cancels; Backspace clears the binding.')} {t('The left stick always moves focus.')}</p>
        <div className="controls-table-wrap">
          <table className="controls-table">
            <thead>
              <tr><th scope="col"><span className="visually-hidden">{t('Action')}</span></th><th scope="col">{t('Key')}</th><th scope="col">{t('Second key')}</th><th scope="col">{t('Controller')}</th></tr>
            </thead>
            {CONTEXTS.map(({context, label}) => (
              <tbody key={context}>
                <tr><th scope="rowgroup" colSpan={4} className="controls-group">{t(label)}</th></tr>
                {BINDINGS.filter(binding => binding.context === context).map(({action}) => {
                  const keys = keysFor(action, controls);
                  const [button] = buttonsFor(action, controls);
                  return (
                    <tr key={action}>
                      <th scope="row">{actionName(action)}</th>
                      {Array.from({length: KEY_SLOTS}, (_, slot) => this.renderCell(action, slot, keys[slot] ? keyLabel(keys[slot], t) : ''))}
                      {this.renderCell(action, 'pad', button === undefined ? '' : buttonLabel(button, family))}
                    </tr>
                  );
                })}
              </tbody>
            ))}
          </table>
        </div>
        <p className="controls-notice" role="status" aria-live="polite">{notice}</p>
        <button type="button" className="game-btn game-btn--ink controls-reset" onClick={this.reset}>{t('Reset controls')}</button>
      </div>
    );
  }
}

export default ControlsSettings;
