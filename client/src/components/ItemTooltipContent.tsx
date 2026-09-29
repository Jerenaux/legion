import {h} from 'preact';
import {BaseEquipment} from '@legion/shared/BaseEquipment';
import {BaseItem} from '@legion/shared/BaseItem';
import {BaseSpell} from '@legion/shared/BaseSpell';
import {InventoryType, StatLabels, STATS_BG_COLOR, Target} from '@legion/shared/enums';
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

export function ItemTooltip({id}: {id: string}) {
  return <ReactTooltip id={id} className="item-details-tooltip" place="top" positionStrategy="fixed" delayShow={0} delayHide={0}
    closeEvents={{mouseleave: true, blur: true, click: true}} globalCloseEvents={{escape: true}}
    render={({activeAnchor}) => {
      const itemId = Number(activeAnchor?.getAttribute('data-tooltip-item-id'));
      const type = activeAnchor?.getAttribute('data-tooltip-item-type');
      const item = type === InventoryType.CONSUMABLES ? getConsumableById(itemId)
        : type === InventoryType.SPELLS ? getSpellById(itemId)
        : type === InventoryType.EQUIPMENTS ? getEquipmentById(itemId) : null;
      return item ? <ItemTooltipContent item={item} /> : null;
    }} />;
}

function ItemTooltipContent({item}: {
  item: BaseItem | BaseSpell | BaseEquipment;
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
        <span className="item-preview-kind">{spell ? 'Spell' : equipment ? 'Equipment' : 'Consumable'}</span>
        <strong className="item-preview-name">{item.name}</strong>
      </div>
    </div>
    {item.description && <p className="item-preview-description">{item.description}</p>}
    {!equipment && <div className="item-preview-facts">
      {spell && <span><img src={mpIcon} alt="" />{item.cost} MP</span>}
      <span><img src={speedIcon} alt="" />{getSpeedClass(item.speedClass).toLowerCase()}</span>
      <span><img src={targetIcon} alt="" />{item.target === Target.AOE ? 'Area' : item.target === Target.SELF ? 'Self' : 'Single'}</span>
    </div>}
    {item.effects.length > 0 && <div className="item-preview-effects">
      {item.effects.map((effect, index) => {
        const full = item instanceof BaseItem && effect.value === -1;
        const label = StatLabels[effect.stat];
        return <div className="item-preview-effect" key={index}>
          <span className="item-preview-stat" style={{backgroundColor: STATS_BG_COLOR[label]}}>{label}</span>
          <strong className={full || effect.value > 0 ? 'item-preview-positive' : 'item-preview-negative'}>
            {full ? 'Full' : effect.value > 0 ? `+${effect.value}` : effect.value}
          </strong>
        </div>;
      })}
    </div>}
    {'classes' in item && item.classes.length > 0 &&
      <p className="item-preview-classes">{item.classes.map(classEnumToString).join(' · ')}</p>}
  </div>;
}
