import {t, formatNumber} from '../../i18n/core';
import { h, Component, Fragment } from 'preact';
import { InventoryType, Stat, StatusEffect, Target } from '@legion/shared/enums';
import { PlayerProps } from '@legion/shared/interfaces';
import { BaseItem } from '@legion/shared/BaseItem';
import { BaseSpell } from '@legion/shared/BaseSpell';
import { loadGameSettings } from '../../settings';
import { CONTROLS_CHANGED_EVENT, DesktopAction } from '../../input/actions';
import { SPELL_SLOT_OFFSET, primaryKeyLabel } from '../../input/bindings';
import { statusIcons } from '../utils';
import hpIcon from '@assets/stats_icons/hp_icon.png';
import mpIcon from '@assets/stats_icons/mp_icon.png';
import { ItemTooltip } from '../ItemTooltipContent';
import { CircularTimer } from './CircularTimer';
import ItemIcon from './NewItemIcon';
import './PlayerBar.style.css';

type EventEmitter = {on: Function; off: Function; emit: Function};
interface PlayerBarProps {
  player: PlayerProps | null;
  /** Name of the character selected for inspection, when it is not the acting one. */
  inspectedName?: string;
  canAct: boolean;
  isPlayerTurn: boolean;
  turnDuration: number;
  timeLeft: number;
  turnNumber: number;
  onPassTurn: (event: MouseEvent) => void;
  eventEmitter: EventEmitter;
}

// What a self-target consumable would restore, for the hover preview in the dock bars.
function selfRestore(item: BaseItem | undefined, stat: Stat, current: number, max: number) {
  if (!item || item.target !== Target.SELF) return null;
  const effect = item.effects.find(effect => effect.stat === stat && !effect.onKO && (effect.value > 0 || effect.value === -1));
  if (!effect || current >= max) return null;
  return effect.value === -1 ? max : Math.min(max, current + effect.value);
}

class PlayerBar extends Component<PlayerBarProps> {
  state = {controls: loadGameSettings().controls, previewItem: null as number | null};

  previewItem(index: number | null) {
    if (this.state.previewItem === index) return;
    this.setState({previewItem: index});
    // The arena highlights who the item affects: always the acting character.
    this.props.eventEmitter.emit('itemPreview', index);
  }

  componentDidMount() {
    window.addEventListener(CONTROLS_CHANGED_EVENT, this.handleControlsChanged);
  }

  componentWillUnmount() {
    window.removeEventListener(CONTROLS_CHANGED_EVENT, this.handleControlsChanged);
  }

  handleControlsChanged = () => {
    this.setState({controls: loadGameSettings().controls});
  };

  renderActionRow(actions: Array<BaseItem | BaseSpell>, startIndex: number, type: InventoryType) {
    const {player, canAct} = this.props;
    const isSpell = type === InventoryType.SPELLS;
    const pending = isSpell ? player?.pendingSpell : player?.pendingItem;
    const muted = isSpell && player?.statuses[StatusEffect.MUTE] !== 0;
    return (
      <section className="player_bar_action_group" aria-label={t(isSpell ? 'Spells' : 'Items')}>
        <div className="player_bar_group_label">{t(isSpell ? 'Spells' : 'Items')}{muted && <span>{t('Silenced')}</span>}</div>
        <div className="player_bar_actions">
          {actions.map((action, index) => {
            const cost = 'cost' in action ? action.cost : null;
            const self = !isSpell && action.target === Target.SELF;
            const lowMP = cost !== null && cost > player.mp;
            const unavailable = !canAct || muted || lowMP;
            const reason = muted ? 'Silenced' : lowMP ? 'Not enough MP' : !canAct ? 'Not available this turn' : '';
            return (
              <button type="button" data-game-control
                id={index === 0 ? `player_hud_${type}` : undefined}
                key={`${action.id}-${index}`}
                className={`player_bar_action ${pending === index && canAct ? 'pending-action' : ''}`}
                aria-label={[t(action.name), cost !== null ? t('{{cost}} MP', {cost}) : '', self ? t('Self') : '', reason ? t(reason) : ''].filter(Boolean).join(', ')}
                aria-disabled={unavailable}
                aria-pressed={pending === index && canAct}
                data-tooltip-id="combat-action-details"
                data-tooltip-item-id={action.id}
                data-tooltip-item-type={type}
                onMouseEnter={() => { if (!isSpell && canAct) this.previewItem(index); }}
                onFocus={() => { if (!isSpell && canAct) this.previewItem(index); }}
                onMouseLeave={() => { if (!isSpell) this.previewItem(null); }}
                onBlur={() => { if (!isSpell) this.previewItem(null); }}
                onClick={(event) => {
                  event.stopPropagation();
                  // Validation also explains unavailable actions without spending the turn.
                  this.props.eventEmitter.emit('itemClick', startIndex + index);
                }}
              >
                <ItemIcon action={action} index={index} canAct={!unavailable} actionType={type}
                  keyLabel={primaryKeyLabel(`${isSpell ? 'spell' : 'item'}-${index + 1}` as DesktopAction, this.state.controls)} />
                <span className="player_bar_action_name">{t(action.name)}</span>
                {self && <span className="player_bar_action_self" aria-hidden="true">
                  <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true"><circle cx="5" cy="3" r="2.2" /><path d="M1 10c0-2.6 1.8-4.2 4-4.2S9 7.4 9 10Z" /></svg>
                </span>}
                {cost !== null && <span className={`player_bar_action_cost ${lowMP ? 'insufficient-mp' : ''}`}><img src={mpIcon} alt={t("MP")} />{formatNumber(cost)}</span>}
              </button>
            );
          })}
          {!actions.length && <span className="player_bar_empty">{t(isSpell ? 'No spells learned' : 'No items equipped')}</span>}
        </div>
      </section>
    );
  }

  render({player, inspectedName, canAct, isPlayerTurn, turnDuration, timeLeft, turnNumber, onPassTurn}: PlayerBarProps) {
    const {items = [], spells = [], statuses} = player || {};
    const spellsIndex = SPELL_SLOT_OFFSET;
    const pending = canAct && (player.pendingSpell != null ? spells[player.pendingSpell] : items[player.pendingItem]);
    const condition = player?.hp <= 0 ? 'Knocked out' : player?.isParalyzed ? 'Unable to act' : player?.casting ? 'Casting' : '';
    // One status at a time, shown above the arena so the dock layout never changes.
    const status = !isPlayerTurn ? null
      : condition ? {tone: 'warning', subject: player.name, text: condition}
      : pending ? {tone: 'targeting', subject: pending.name, text: 'Select a target'}
      : !canAct ? {tone: 'muted', subject: inspectedName ?? player?.name, text: 'Inspecting'} : null;
    const hovered = canAct && this.state.previewItem != null ? items[this.state.previewItem] : undefined;
    const restoredHP = player ? selfRestore(hovered, Stat.HP, player.hp, player.maxHp) : null;
    const restoredMP = player ? selfRestore(hovered, Stat.MP, player.mp, player.maxMp) : null;
    const previewMP = restoredMP ?? (pending && 'cost' in pending ? player.mp - pending.cost : player?.mp);

    return (
      <>
      <section className="player_bar_container" aria-label={t("Combat commands")} data-active={canAct} data-pending={Boolean(pending)} data-dense={spells.length + items.length > 6} data-has-spells={spells.length > 0}>
        <div className="player_bar">
          {isPlayerTurn ? <div className="player_bar_body">
            <div className="player_bar_character">
              <div className="player_bar_stats">
                <div className="player_bar_heading" key={turnNumber}>
                  <strong className="player_bar_name">{player?.name || t('Combat')}</strong>
                </div>
                {player && <>
                  <div className="player_bar_stat">
                    <span className="player_bar_stat_icon"><img src={hpIcon} alt="" />{t('HP')}</span><meter min={0} max={player.maxHp || 1} value={restoredHP ?? player.hp} aria-label={t("Health")} />
                    <span className={restoredHP != null ? 'player_bar_restore_preview' : ''}>{formatNumber(Math.round(restoredHP ?? player.hp))}<span className="player_bar_max">/{formatNumber(Math.round(player.maxHp))}</span></span>
                  </div>
                  {spells.length > 0 && <div className="player_bar_stat player_bar_mana">
                    <span className="player_bar_stat_icon"><img src={mpIcon} alt="" />{t('MP')}</span><meter min={0} max={player.maxMp || 1} value={Math.round(previewMP)} aria-label={t("Mana after selected spell")} />
                    <span className={restoredMP != null ? 'player_bar_restore_preview' : pending && 'cost' in pending ? 'player_bar_mana_preview' : ''}>{formatNumber(Math.round(previewMP))}<span className="player_bar_max">/{formatNumber(Math.round(player.maxMp))}</span></span>
                  </div>}
                </>}
                <div className="player_bar_statuses">
                  {Object.entries(statuses || {}).filter(([, duration]) => duration !== 0).map(([status, duration]) => (
                    <span key={status} role="img" aria-label={duration === -1 ? t('{{status}}, indefinite', {status: t(status)}) : t('statusTurns', {status: t(status), count: Number(duration)})}>
                      <img src={statusIcons[status]} alt={t(status)} /><span>{duration === -1 ? '∞' : formatNumber(Number(duration))}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="player_bar_actions_container">
              {this.renderActionRow(items, 0, InventoryType.CONSUMABLES)}
              {spells.length > 0 && this.renderActionRow(spells, spellsIndex, InventoryType.SPELLS)}
            </div>
            <div className="player_bar_controls">
              <CircularTimer turnDuration={turnDuration} timeLeft={timeLeft} turnNumber={turnNumber} size={36} strokeWidth={3} />
              <button type="button" data-game-control className="player_bar_pass_turn" onClick={onPassTurn} disabled={!canAct || Boolean(pending)}>
                <span>{t("Pass Turn")}</span><span className="player_bar_pass_key">{t("Space")}</span>
              </button>
            </div>
          </div> : <div className="enemy_turn_banner" role="status">{t("Enemy Turn")}</div>}
        </div>
      </section>
      <div className="combat-status-banner" role="status" aria-live="polite">
        {status && <span key={`${status.text}-${status.subject}`} data-tone={status.tone}>
          {status.subject && <strong>{status.tone === 'targeting' ? t(status.subject) : status.subject}</strong>}<em>{t(status.text)}</em>
        </span>}
      </div>
      {isPlayerTurn && <ItemTooltip id="combat-action-details" showClasses={false} />}
      </>
    );
  }
}

export default PlayerBar;
