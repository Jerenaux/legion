import {t, formatNumber} from '../../i18n/core';
import { h, Component } from 'preact';
import { InventoryType, StatLabels, equipmentSlotFields } from "@legion/shared/enums";
import { BaseEquipment } from '@legion/shared/BaseEquipment';
import { inflictedStatuses, statusIcons, statusSummary } from '../utils';
import { StatIcons } from '../shopConsumableCard/ShopConsumableCard';
import ShopItemCard from '../shopContent/ShopItemCard';

import equipmentSpritesheet from '@assets/equipment.png';

interface modalData {
  id: string | number;
  name: string;
  frame: number;
  url: string;
  price: number;
}

interface ShopCardProps {
  key: number;
  data: BaseEquipment;
  getItemAmount: (index: number, type: InventoryType) => number;
  handleOpenModal: (e: Event, modalData: modalData) => void;
  isHighlighted?: boolean;
}

class ShopEquipmentCard extends Component<ShopCardProps> {
  render() {
    const { data } = this.props;
    const modalData: modalData = {id: data.id, name: data.name, frame: data.frame, url: equipmentSpritesheet, price: data.price};
    return (
      <ShopItemCard
        name={data.name}
        description={data.description}
        sheet={equipmentSpritesheet}
        frame={data.frame}
        effort={data.effort}
        owned={this.props.getItemAmount(data.id, InventoryType.EQUIPMENTS)}
        price={data.price}
        classes={data.classes}
        slotIcon={require(`@assets/inventory/${equipmentSlotFields[data.slot]}_icon.png`)}
        isHighlighted={this.props.isHighlighted}
        onClick={(e) => this.props.handleOpenModal(e, modalData)}
        stats={[
          ...inflictedStatuses(data).map(status => ({icon: statusIcons[status.effect], label: t(status.effect), value: statusSummary(status), wide: true})),
          ...data.effects.map(effect => ({icon: StatIcons[effect.stat], label: t(StatLabels[effect.stat]), value: formatNumber(effect.value, {signDisplay: 'always'})})),
        ]}
      />
    );
  }
}

export default ShopEquipmentCard;
