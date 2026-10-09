import {h} from 'preact';
import {useContext} from 'preact/hooks';
import {t, formatNumber} from '../../i18n/core';
import {PlayerContext} from '../../contexts/PlayerContext';
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
