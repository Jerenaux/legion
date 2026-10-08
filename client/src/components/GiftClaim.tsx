import {h, Fragment} from 'preact';
import {useContext, useEffect, useRef, useState} from 'preact/hooks';
import Modal from 'react-modal';
import {PlayerContext} from '../contexts/PlayerContext';
import {getElectronAPI} from '../utils/electronUtils';
import {apiFetch} from '../services/apiService';
import {t} from '../i18n/core';
import type {ChestReward} from '@legion/shared/interfaces';
import type {CommunitySummary} from '@legion/shared/communities';
import Sigil from './sigil/Sigil';
import JoinCommunityDialog from './community/JoinCommunityDialog';
import {RewardType, InventoryType, RarityColor} from '@legion/shared/enums';
import {getRewardObject, getRewardBgImage, mapFrameToCoordinates, playSoundEffect} from './utils';
import {ItemTooltip} from './ItemTooltipContent';
import goldChest from '@assets/shop/gold_chest.png';
import shine from '@assets/game_end/shine_bg.png';
import rewardSound from '@assets/sfx/purchase.wav';
import './GiftClaim.css';

type Receipt = {status: 'claimed' | 'already_claimed' | 'unavailable' | 'error' | 'loading'; rewards?: ChestReward[]; community?: CommunitySummary | null};

export default function GiftClaim({blocked}: {blocked: boolean}) {
  const {player, refreshAllData} = useContext(PlayerContext);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  // A creator's gift can also invite to their community: offered after the gift dialog closes.
  const [communityInvite, setCommunityInvite] = useState<string | null>(null);
  const token = useRef<string | null>(null);
  const busy = useRef(false);
  const postponed = useRef(false);
  const mounted = useRef(false);
  const desktop = getElectronAPI();

  const claim = async () => {
    if (!token.current) return;
    setReceipt({status: 'loading'});
    try {
      const result = await apiFetch('redeemGift', {method: 'POST', body: {token: token.current}});
      if (!mounted.current) return;
      if (result.status === 'claimed' || result.status === 'already_claimed') {
        refreshAllData();
        setReceipt(result);
        if (result.status === 'claimed') playSoundEffect(rewardSound);
      } else setReceipt({status: result.status === 'unavailable' ? 'unavailable' : 'error'});
    } catch {
      if (mounted.current) setReceipt({status: 'error'});
    }
  };

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!player.isLoaded || blocked || postponed.current || !desktop?.getPendingGift) return;
    const check = async () => {
      if (busy.current) return;
      busy.current = true;
      try {
        const pending = await desktop.getPendingGift!();
        if (!mounted.current) return;
        if (!pending) { busy.current = false; return; }
        token.current = pending;
        await claim();
      } catch { busy.current = false; }
    };
    const unsubscribe = desktop.onGiftAvailable?.(() => { void check(); });
    void check();
    return unsubscribe;
  }, [player.isLoaded, blocked, receipt === null]);

  const close = async () => {
    if (!receipt || receipt.status === 'loading') return;
    if (receipt.status === 'error') postponed.current = true; // Keep the token on disk for the next launch.
    else {
      try { await desktop?.acknowledgeGift?.(token.current!); }
      catch { postponed.current = true; } // A repeated receipt is safe; do not loop on an IPC failure.
    }
    token.current = null;
    busy.current = false;
    const community = receipt.community;
    setReceipt(null);
    if (community && !player.community) setCommunityInvite(community.id);
  };

  const success = receipt?.status === 'claimed' || receipt?.status === 'already_claimed';
  return <>
  <Modal isOpen={!!receipt && !blocked} onRequestClose={close} contentLabel={t('Your gift')}
    className={`gift-dialog${success ? ' gift-dialog--received' : ''}`} overlayClassName="gift-overlay" shouldCloseOnOverlayClick={false}>
    <div className="gift-emblem" aria-hidden="true">
      <img className="gift-rays" src={shine} alt="" />
      <img className="gift-chest" src={goldChest} alt="" />
    </div>
    {success && receipt?.community && <p className="gift-from">
      <Sigil sigil={receipt.community.sigil} size={28} />{t('From {{value0}}', {value0: receipt.community.name})}
    </p>}
    <h2>{t(success ? 'Your gear is ready' : 'Your gift')}</h2>
    <div aria-live="polite" aria-busy={receipt?.status === 'loading'}>
      <p className="gift-message">{receipt?.status === 'loading' ? t('Claiming your gift…')
        : receipt?.status === 'claimed' ? t('Your gift has been added to your shared inventory.')
        : receipt?.status === 'already_claimed' ? t('You already claimed this gift. Your gear is in your shared inventory.')
        : receipt?.status === 'unavailable' ? t('This gift link is invalid, expired, revoked, or already used by another player.')
        : t('We couldn’t claim your gift. Check your connection and try again.')}</p>
      {success && <ul className="gift-rewards">{receipt?.rewards?.map((reward, index) => {
        const item = getRewardObject(reward.type, reward.id);
        const coordinates = item ? mapFrameToCoordinates(item.frame) : {x: 0, y: 0};
        const type = reward.type === RewardType.EQUIPMENT ? InventoryType.EQUIPMENTS
          : reward.type === RewardType.SPELL ? InventoryType.SPELLS
          : reward.type === RewardType.CONSUMABLES ? InventoryType.CONSUMABLES : 'gold';
        return <li key={index} style={{'--loot-color': item ? RarityColor[item.rarity] : 'oklch(0.8 0.14 85)', '--loot-order': Math.min(index, 5)}}>
          <button type="button" className="gift-reward" data-tooltip-id="gift-item-details"
            data-tooltip-item-id={reward.id} data-tooltip-item-type={type}>
            <span className="gift-loot-slot"><span className="gift-icon" aria-hidden="true" style={{
          backgroundImage: `url(${getRewardBgImage(reward.type)})`,
          backgroundPosition: reward.type === RewardType.GOLD ? 'center' : `-${coordinates.x}px -${coordinates.y}px`,
          backgroundSize: reward.type === RewardType.GOLD ? 'contain' : undefined,
        }} /><strong className="gift-quantity">×{reward.amount}</strong></span>
            <span className="gift-item-name">{t(item?.name || 'Gold')}</span>
          </button>
        </li>;
      })}</ul>}
      {success && <p className="gift-hint">{t('Hover over or focus a reward to inspect it. Equip your gear in Team.')}</p>}
    </div>
    {receipt?.status !== 'loading' && <div className="gift-actions">
      {receipt?.status === 'error' && <button type="button" onClick={claim}>{t('Try again')}</button>}
      <button type="button" data-desktop-cancel onClick={close}>{t(receipt?.status === 'error' ? 'Later' : 'Continue')}</button>
    </div>}
    <ItemTooltip id="gift-item-details" />
  </Modal>
  {communityInvite && !receipt && !blocked && <JoinCommunityDialog code={communityInvite} via="link" onClose={() => setCommunityInvite(null)} />}
  </>;
}
