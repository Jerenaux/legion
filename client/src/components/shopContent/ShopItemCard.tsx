// The shop's item card, shared by consumables, equipment and spells: the item on a lit
// display stand, who can use it, what it does, and its price on the buy bar.
import {h, ComponentChildren} from 'preact';
import {useEffect, useRef} from 'preact/hooks';
import {t, formatNumber} from '../../i18n/core';
import {Class, Rarity} from '@legion/shared/enums';
import ShopPrice from './ShopPrice';
import {mapFrameToCoordinates} from '../utils';
import ClassCrest from '../HUD/ClassCrest';
import itemCountIcon from '@assets/shop/item_count_icon.png';
import './ShopItemCard.css';

export interface ShopCardStat {
  icon: string;
  label: string;
  value: ComponentChildren;
  /** Status effects read as a phrase; they get a wider chip. */
  wide?: boolean;
}

interface ShopItemCardProps {
  name: string;
  description: string;
  sheet: string;
  frame: number;
  rarity: Rarity;
  owned: number;
  price: number;
  stats: ShopCardStat[];
  classes?: Class[];
  /** The equipment slot icon, shown on the stand. */
  slotIcon?: string;
  minLevel?: number;
  isHighlighted?: boolean;
  onClick: (event: Event) => void;
  dataItem?: string;
}

/** Each item's own rarity: equipment sets it per item, consumables and spells derive it from effort. */
export function rarityOf(rarity: Rarity) {
  if (rarity === Rarity.COMMON) return {key: 'common', label: t("Common")};
  if (rarity === Rarity.RARE) return {key: 'rare', label: t("Rare")};
  if (rarity === Rarity.EPIC) return {key: 'epic', label: t("Epic")};
  return {key: 'legendary', label: t("Legendary")};
}

const CLASS_NAMES = {
  [Class.WARRIOR]: () => t("Warrior"),
  [Class.WHITE_MAGE]: () => t("White Mage"),
  [Class.BLACK_MAGE]: () => t("Black Mage"),
};

export default function ShopItemCard(props: ShopItemCardProps) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (props.isHighlighted) ref.current?.scrollIntoView({behavior: 'smooth', block: 'center'});
  }, [props.isHighlighted]);
  const rarity = rarityOf(props.rarity);
  const {x, y} = mapFrameToCoordinates(props.frame);
  return (
    <button type="button" data-game-control ref={ref} onClick={props.onClick} data-shop-item={props.dataItem}
      className={`shop-item-card rarity-${rarity.key}${props.isHighlighted ? ' feature-highlight' : ''}`}>
      <span className="shop-item-stand">
        <span className="shop-item-rarity">{rarity.label}</span>
        <span className={`shop-item-owned${props.owned > 0 ? ' has-some' : ''}`} title={t("count icon")}>
          <img src={itemCountIcon} alt="" />{formatNumber(props.owned)}
        </span>
        <span className="shop-item-icon" aria-hidden="true" style={{backgroundImage: `url(${props.sheet})`, '--fx': x / 32, '--fy': y / 32}} />
        {props.slotIcon && <img className="shop-item-slot" src={props.slotIcon} alt="" />}
      </span>
      <span className="shop-item-name">{t(props.name)}</span>
      {(props.classes?.length || props.minLevel > 1) && <span className="shop-item-who">
        {props.classes?.map(characterClass => (
          <span key={characterClass} className={`shop-item-class class-${Class[characterClass]}`} title={CLASS_NAMES[characterClass]?.()}>
            <ClassCrest characterClass={characterClass} />
            <span>{CLASS_NAMES[characterClass]?.()}</span>
          </span>
        ))}
        {props.minLevel > 1 && <span className="shop-item-level" title={t('Requires level {{level}}', {level: props.minLevel})}>
          {t("Lvl")} {formatNumber(props.minLevel)}
        </span>}
      </span>}
      <span className="shop-item-description" title={t(props.description)}>{t(props.description)}</span>
      <span className="shop-item-stats">
        {props.stats.map((stat, index) => (
          <span key={index} className={`shop-item-stat${stat.wide ? ' is-wide' : ''}`} title={stat.label}>
            <span className="shop-stat-symbol"><img src={stat.icon} alt="" /></span>
            <span className="shop-stat-label">{stat.label}</span>
            <span className="shop-stat-value">{stat.value}</span>
          </span>
        ))}
      </span>
      <ShopPrice price={props.price} className="shop-item-price" />
    </button>
  );
}
