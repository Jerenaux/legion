import {t, formatNumber, i18n} from '../i18n/core';
import {Trans} from '../i18n/Trans';
import {h} from 'preact';
import {BaseEquipment} from '@legion/shared/BaseEquipment';
import {BaseItem} from '@legion/shared/BaseItem';
import {BaseSpell} from '@legion/shared/BaseSpell';
import {Class, InventoryType, StatLabels, STATS_BG_COLOR, Target} from '@legion/shared/enums';
import {getConsumableById} from '@legion/shared/Items';
import {getSpellById} from '@legion/shared/Spells';
import {getEquipmentById} from '@legion/shared/Equipments';
import {Tooltip as ReactTooltip} from 'react-tooltip';
import {classEnumToString, getSpeedClass, mapFrameToCoordinates} from './utils';
import equipmentSpritesheet from '@assets/equipment.png';
import consumablesSpritesheet from '@assets/consumables.png';
import spellsSpritesheet from '@assets/spells.png';
import mpIcon from '@assets/stats_icons/mp_icon.png';
import speedIcon from '@assets/inventory/cd_icon.png';
import targetIcon from '@assets/inventory/target_icon.png';
import './ItemTooltipContent.css';

/** The character the tooltip judges requirements against (team screens). */
export type RequirementCharacter = {class: Class; level: number} | null | undefined;

export function ItemTooltip({id, showClasses = true, character}: {id: string; showClasses?: boolean; character?: RequirementCharacter}) {
  return <ReactTooltip id={id} className="item-details-tooltip" place="top" positionStrategy="fixed" delayShow={0} delayHide={0}
    closeEvents={{mouseleave: true, blur: true, click: true}} globalCloseEvents={{escape: true}}
    render={({activeAnchor}) => {
      const itemId = Number(activeAnchor?.getAttribute('data-tooltip-item-id'));
      const type = activeAnchor?.getAttribute('data-tooltip-item-type');
      if (type === 'xp') return <div className="item-preview">
        <strong className="item-preview-name">{t('Experience')}</strong>
        <p className="item-preview-description">{t('Split among your characters by how many targets each one hit or helped. Each level gained grants stat points to spend in Team.')}</p>
      </div>;
      if (type === 'gold') return <div className="item-preview">
        <strong className="item-preview-name">{t('Gold')}</strong>
        <p className="item-preview-description">{t('Spend gold in Shop to buy consumables, spells, equipment, and new recruits as they unlock.')}</p>
      </div>;
      const item = type === InventoryType.CONSUMABLES ? getConsumableById(itemId)
        : type === InventoryType.SPELLS ? getSpellById(itemId)
        : type === InventoryType.EQUIPMENTS ? getEquipmentById(itemId) : null;
      return item ? <ItemTooltipContent item={item} showClasses={showClasses} character={character} /> : null;
    }} />;
}

function Requirement({met, children}: {met: boolean | null; children: h.JSX.Element | string}) {
  if (met === null) return <p className="item-preview-classes">{children}</p>;
  return <p className={`item-preview-classes item-preview-requirement ${met ? 'is-met' : 'is-unmet'}`}>
    <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
      {met ? <path d="M2 6.5 4.8 9.2 10 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        : <path d="M3 3l6 6M9 3 3 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />}
    </svg>
    <span className="visually-hidden">{t(met ? 'Requirement met:' : 'Requirement not met:')} </span>
    {children}
  </p>;
}

/** The item card shared by hover tooltips and the inventory action dialog. */
export function ItemTooltipContent({item, showClasses, character}: {
  showClasses: boolean;
  item: BaseItem | BaseSpell | BaseEquipment;
  character?: RequirementCharacter;
}) {
  const spell = item instanceof BaseSpell;
  const equipment = item instanceof BaseEquipment;
  const sprite = spell ? spellsSpritesheet : equipment ? equipmentSpritesheet : consumablesSpritesheet;
  const {x, y} = mapFrameToCoordinates(item.frame);
  return <div className="item-preview">
    <div className="item-preview-heading">
      <div className="item-preview-icon">
        <div className="item-preview-sprite" style={{backgroundImage: `url(${sprite})`, backgroundPosition: `-${x}px -${y}px`}} />
      </div>
      <div>
        <span className="item-preview-kind">{spell ? t("Spell") : equipment ? t("Equipment") : t("Consumable")}</span>
        <strong className="item-preview-name">{t(item.name)}</strong>
      </div>
    </div>
    {item.description && <p className="item-preview-description">{t(item.description)}</p>}
    {!equipment && <div className="item-preview-facts">
      {spell && <span><Trans i18n={i18n} i18nKey={"<0/>{{value0}} MP"} components={[<img src={mpIcon} alt="" />]} values={{value0: item.cost}} /></span>}
      <span><img src={speedIcon} alt={""} />{getSpeedClass(item.speedClass).toLowerCase()}</span>
      <span><img src={targetIcon} alt={""} />{item.target === Target.AOE ? t("Area") : item.target === Target.SELF ? t("Self") : t("Single")}</span>
    </div>}
    {item.effects.length > 0 && <div className="item-preview-effects">
      {item.effects.map((effect, index) => {
        const full = item instanceof BaseItem && effect.value === -1;
        const label = StatLabels[effect.stat];
        return <div className="item-preview-effect" key={index}>
          <span className="item-preview-stat" style={{backgroundColor: STATS_BG_COLOR[label]}}>{t(label)}</span>
          <strong className={full || effect.value > 0 ? 'item-preview-positive' : 'item-preview-negative'}>
            {full ? t("Full") : formatNumber(effect.value, {signDisplay: effect.value > 0 ? 'always' : 'auto'})}
          </strong>
        </div>;
      })}
    </div>}
    {showClasses && 'classes' in item && item.classes.length > 0 &&
      <Requirement met={character ? item.classes.includes(character.class) : null}>{item.classes.map(classEnumToString).join(' · ')}</Requirement>}
    {/* Requirements matter when choosing gear, not in combat, where the action is already equipped. */}
    {showClasses && spell && <Requirement met={character ? character.level >= item.minLevel : null}>
      {t('Requires level {{level}}', {level: item.minLevel})}
    </Requirement>}
  </div>;
}
