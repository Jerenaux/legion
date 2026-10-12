import {t, formatNumber} from '../../i18n/core';
import { h, Component } from 'preact';
import { InventoryType, StatLabels, Target } from "@legion/shared/enums";
import { BaseItem } from '@legion/shared/BaseItem';
import { Effect } from '@legion/shared/interfaces';
import { getSpeedClass, inflictedStatuses, statusIcons, statusSummary } from '../utils';
import ShopItemCard from '../shopContent/ShopItemCard';

import consumablesSpritesheet from '@assets/consumables.png';

// Import stat icons
import hpIcon from '@assets/stats_icons/hp_icon.png';
import mpIcon from '@assets/stats_icons/mp_icon.png';
import attackIcon from '@assets/stats_icons/attack_icon.png';
import defIcon from '@assets/stats_icons/def_icon.png';
import satkIcon from '@assets/stats_icons/satk_icon.png';
import sdefIcon from '@assets/stats_icons/sdef_icon.png';
import speedIcon from '@assets/stats_icons/speed_icon.png';

import cdIcon from '@assets/inventory/cd_icon.png';
import targetIcon from '@assets/inventory/target_icon.png';

export const StatIcons = [
  hpIcon,
  mpIcon,
  attackIcon,
  defIcon,
  satkIcon,
  sdefIcon,
  speedIcon,
];

interface modalData {
  id: string | number;
  name: string;
  frame: number;
  url: string;
  price: number;
}

interface ShopCardProps {
  key: number;
  data: BaseItem;
  getItemAmount: (index: number, type: InventoryType) => number;
  handleOpenModal: (e: Event, modalData: modalData) => void;
  isHighlighted?: boolean;
}

const effectValue = (effect: Effect) => effect.value === -1 ? '∞' : formatNumber(effect.value, {signDisplay: 'always'});

class ShopConsumableCard extends Component<ShopCardProps> {
  render() {
    const { data } = this.props;
    const modalData: modalData = {id: data.id, name: data.name, url: consumablesSpritesheet, frame: data.frame, price: data.price};
    return (
      <ShopItemCard
        name={data.name}
        description={data.description}
        sheet={consumablesSpritesheet}
        frame={data.frame}
        effort={data.effort}
        owned={this.props.getItemAmount(data.id, InventoryType.CONSUMABLES)}
        price={data.price}
        isHighlighted={this.props.isHighlighted}
        dataItem={`consumable-${data.id}`}
        onClick={(e) => this.props.handleOpenModal(e, modalData)}
        stats={[
          ...inflictedStatuses(data).map(status => ({icon: statusIcons[status.effect], label: t(status.effect), value: statusSummary(status), wide: true})),
          ...data.effects.map(effect => ({icon: StatIcons[effect.stat], label: t(StatLabels[effect.stat]), value: effectValue(effect)})),
          {icon: cdIcon, label: t("cooldown"), value: getSpeedClass(data.speedClass)},
          {icon: targetIcon, label: t("target"), value: t(Target[data.target])},
        ]}
      />
    );
  }
}

export default ShopConsumableCard;
