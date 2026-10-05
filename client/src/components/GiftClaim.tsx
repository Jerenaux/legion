import {h} from 'preact';
import {useContext, useEffect, useRef, useState} from 'preact/hooks';
import Modal from 'react-modal';
import {PlayerContext} from '../contexts/PlayerContext';
import {getElectronAPI} from '../utils/electronUtils';
import {apiFetch} from '../services/apiService';
import {t} from '../i18n/core';
import type {ChestReward} from '@legion/shared/interfaces';
import {RewardType} from '@legion/shared/enums';
import {getRewardObject, getRewardBgImage, mapFrameToCoordinates} from './utils';
import './GiftClaim.css';

type Receipt = {status: 'claimed' | 'already_claimed' | 'unavailable' | 'error' | 'loading'; rewards?: ChestReward[]};

export default function GiftClaim({blocked}: {blocked: boolean}) {
  const {player, refreshAllData} = useContext(PlayerContext);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
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
    setReceipt(null);
  };

  const success = receipt?.status === 'claimed' || receipt?.status === 'already_claimed';
  return <Modal isOpen={!!receipt && !blocked} onRequestClose={close} contentLabel={t('Your gift')}
    className="gift-dialog" overlayClassName="gift-overlay" shouldCloseOnOverlayClick={false}>
    <h2>{t(success ? 'Your gear is ready' : 'Your gift')}</h2>
    <div aria-live="polite" aria-busy={receipt?.status === 'loading'}>
      <p>{receipt?.status === 'loading' ? t('Claiming your gift…')
        : receipt?.status === 'claimed' ? t('Your gift has been added to your shared inventory.')
        : receipt?.status === 'already_claimed' ? t('You already claimed this gift. Your gear is in your shared inventory.')
        : receipt?.status === 'unavailable' ? t('This gift link is invalid, expired, revoked, or already used by another player.')
        : t('We couldn’t claim your gift. Check your connection and try again.')}</p>
      {success && <ul className="gift-rewards">{receipt?.rewards?.map((reward, index) => {
        const item = getRewardObject(reward.type, reward.id);
        const coordinates = item ? mapFrameToCoordinates(item.frame) : {x: 0, y: 0};
        return <li key={index}><span className="gift-icon" aria-hidden="true" style={{
          backgroundImage: `url(${getRewardBgImage(reward.type)})`,
          backgroundPosition: reward.type === RewardType.GOLD ? 'center' : `-${coordinates.x}px -${coordinates.y}px`,
          backgroundSize: reward.type === RewardType.GOLD ? 'contain' : undefined,
        }} /><span>{t(item?.name || 'Gold')}</span><strong>×{reward.amount}</strong></li>;
      })}</ul>}
      {success && <p>{t('Open Team to equip your gear. Normal class and level requirements still apply.')}</p>}
    </div>
    {receipt?.status !== 'loading' && <div className="gift-actions">
      {receipt?.status === 'error' && <button type="button" onClick={claim}>{t('Try again')}</button>}
      <button type="button" data-desktop-cancel onClick={close}>{t(receipt?.status === 'error' ? 'Later' : 'Continue')}</button>
    </div>}
  </Modal>;
}
