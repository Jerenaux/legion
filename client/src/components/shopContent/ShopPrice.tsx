import {h} from 'preact';
import {useContext} from 'preact/hooks';
import {t, formatNumber} from '../../i18n/core';
import {PlayerContext} from '../../contexts/PlayerContext';
import {inventorySize} from '@legion/shared/utils';
import {Link} from 'preact-router';
import goldIcon from '@assets/gold_icon.png';

/** A shop price, in red when the player cannot afford it yet. */
export default function ShopPrice({price, className = 'shop-card-price'}: {price: number; className?: string}) {
  const {player} = useContext(PlayerContext);
  const unaffordable = player.isLoaded && player.gold < price;
  return <div className={`${className}${unaffordable ? ' is-unaffordable' : ''}`}
    title={unaffordable ? t('Not enough gold') : undefined}>
    <img src={goldIcon} alt={t("gold")} />
    {formatNumber(price)}
  </div>;
}

/** The player's gold, shown where prices are compared. Pulses when the amount changes. */
export function ShopPurse() {
  const {player} = useContext(PlayerContext);
  if (!player.isLoaded) return null;
  return <div className="shop-purse" role="status" aria-live="polite">
    <img src={goldIcon} alt="" />
    <span className="shop-purse-label">{t('Your gold')}</span>
    <strong key={player.gold} className="shop-purse-amount">{formatNumber(player.gold)}</strong>
  </div>;
}

/** Inventory space, next to the gold it is spent with. When full, it says so before any item is picked. */
export function ShopInventory() {
  const {player} = useContext(PlayerContext);
  if (!player.isLoaded) return null;
  const used = inventorySize(player.inventory);
  const full = used >= player.carrying_capacity;
  return <div className={`shop-inventory${full ? ' is-full' : ''}`} role="status" aria-live="polite">
    <span className="shop-inventory-label">{full ? t('Your inventory is full.') : t('INVENTORY')}</span>
    <strong className="shop-inventory-count">{formatNumber(used)} / {formatNumber(player.carrying_capacity)}</strong>
    {full && <Link href="/team" className="shop-inventory-action">{t('Sell or equip items in Team to make room.')}</Link>}
  </div>;
}
