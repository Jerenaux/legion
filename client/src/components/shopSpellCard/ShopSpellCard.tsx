import {t, formatNumber} from '../../i18n/core';
import { h, Component } from 'preact';
import { InventoryType, Target } from "@legion/shared/enums";
import { BaseSpell } from '@legion/shared/BaseSpell';
import { getSpeedClass, inflictedStatuses, statusIcons, statusSummary } from '../utils';
import ShopItemCard from '../shopContent/ShopItemCard';

import spellsSpritesheet from '@assets/spells.png';
import mpIcon from '@assets/stats_icons/mp_icon.png';
import cdIcon from '@assets/inventory/cd_icon.png';
import targetIcon from '@assets/inventory/target_icon.png';

interface modalData {
  id: string | number;
  name: string;
  url: string;
  frame: number;
  price: number;
}

interface ShopCardProps {
  key: number;
  data: BaseSpell;
  getItemAmount: (index: number, type: InventoryType) => number;
  handleOpenModal: (e: Event, modalData: modalData) => void;
  isHighlighted?: boolean;
}

class ShopSpellCard extends Component<ShopCardProps> {
  render() {
    const { data } = this.props;
    const modalData: modalData = {id: data.id, name: data.name, frame: data.frame, url: spellsSpritesheet, price: data.price};
    return (
      <ShopItemCard
        name={data.name}
        description={data.description}
        sheet={spellsSpritesheet}
        frame={data.frame}
        rarity={data.rarity}
        owned={this.props.getItemAmount(data.id, InventoryType.SPELLS)}
        price={data.price}
        classes={data.classes}
        minLevel={data.minLevel}
        isHighlighted={this.props.isHighlighted}
        onClick={(e) => this.props.handleOpenModal(e, modalData)}
        stats={[
          ...inflictedStatuses(data).map(status => ({icon: statusIcons[status.effect], label: t(status.effect), value: statusSummary(status), wide: true})),
          {icon: mpIcon, label: t("MP"), value: formatNumber(data.cost)},
          {icon: cdIcon, label: t("cooldown"), value: getSpeedClass(data.speedClass)},
          {icon: targetIcon, label: t("target"), value: t(Target[data.target])},
        ]}
      />
    );
  }
}

export default ShopSpellCard;
