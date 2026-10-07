import {h} from 'preact';
import {useContext, useEffect, useState} from 'preact/hooks';
import Modal from 'react-modal';
import {route} from 'preact-router';
import type {CommunitySummary, PlayerCommunity} from '@legion/shared/communities';
import {PlayerContext} from '../../contexts/PlayerContext';
import {apiFetch} from '../../services/apiService';
import {t} from '../../i18n/core';
import Sigil from '../sigil/Sigil';
import '../GiftClaim.css';
import './community.style.css';

type Step = 'loading' | 'confirm' | 'joining' | 'joined' | 'not-found' | 'already-member' | 'error';

interface Props {
  code: string;
  via: 'code' | 'link';
  onClose: () => void;
}

const status = (error: unknown) => (error as {status?: number})?.status;

/** Shows the community behind a code or link and asks before the permanent join. */
export default function JoinCommunityDialog({code, via, onClose}: Props) {
  const {player, setPlayerInfo, refreshFriends} = useContext(PlayerContext);
  const [step, setStep] = useState<Step>('loading');
  const [community, setCommunity] = useState<CommunitySummary | null>(null);

  useEffect(() => {
    let live = true;
    setStep('loading');
    apiFetch(`getCommunity?id=${encodeURIComponent(code)}`, {}, 2)
      .then(details => {
        if (!live) return;
        setCommunity(details);
        setStep(player.community?.id === details.id ? 'joined' : player.community ? 'already-member' : 'confirm');
      })
      .catch(error => { if (live) setStep(status(error) === 404 || status(error) === 400 ? 'not-found' : 'error'); });
    return () => { live = false; };
  }, [code]);

  const join = async () => {
    setStep('joining');
    try {
      const membership = await apiFetch('joinCommunity', {method: 'POST', body: {code, via}}) as PlayerCommunity;
      setPlayerInfo({community: membership});
      void refreshFriends();
      setStep('joined');
    } catch (error) {
      setStep(status(error) === 409 ? 'already-member' : status(error) === 404 ? 'not-found' : 'error');
    }
  };

  const openCommunity = () => {
    onClose();
    route(`/community/${community!.id}`);
  };

  const message = {
    'loading': t('Looking up this community…'),
    'confirm': t('Its sigil appears beside your name in matches, on your profile and in leaderboards. Your ranked wins count toward its weekly ranking. You can join one community, and you cannot leave it.'),
    'joining': t('Joining…'),
    'joined': t('Your ranked wins now count toward its weekly ranking.'),
    'not-found': t('No community uses the code {{value0}}.', {value0: code.toUpperCase()}),
    'already-member': t('You already belong to {{value0}}.', {value0: player.community?.name || ''}),
    'error': t('Check your connection and try again.'),
  }[step];
  const shown = step === 'already-member' ? player.community : community;

  return <Modal isOpen onRequestClose={step === 'joining' ? undefined : onClose} contentLabel={t('Join a community')}
    className="gift-dialog community-dialog" overlayClassName="gift-overlay" shouldCloseOnOverlayClick={false}>
    <div className="community-dialog-emblem" aria-hidden="true">
      {shown ? <Sigil sigil={shown.sigil} size={112} /> : <div className="community-dialog-placeholder" />}
    </div>
    <h2>{step === 'joined' && community ? t('Welcome to {{value0}}', {value0: community.name})
      : shown && step !== 'not-found' ? shown.name : t('Join a community')}</h2>
    {shown && step !== 'not-found' && <p className="community-dialog-tag">{shown.tag}</p>}
    <p className="gift-message" aria-live="polite" aria-busy={step === 'loading' || step === 'joining'}>{message}</p>
    {step !== 'loading' && step !== 'joining' && <div className="gift-actions">
      {step === 'confirm' && <button type="button" onClick={join}>{t('Join')}</button>}
      {step === 'joined' && <button type="button" onClick={openCommunity}>{t('View community')}</button>}
      <button type="button" data-desktop-cancel className="community-dialog-secondary" onClick={onClose}>
        {t(step === 'confirm' ? 'Not now' : 'Close')}
      </button>
    </div>}
  </Modal>;
}
