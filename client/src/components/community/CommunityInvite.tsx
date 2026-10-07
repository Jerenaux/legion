import {h} from 'preact';
import {useContext, useEffect, useState} from 'preact/hooks';
import {PlayerContext} from '../../contexts/PlayerContext';
import {getElectronAPI} from '../../utils/electronUtils';
import JoinCommunityDialog from './JoinCommunityDialog';

/** Opens the join confirmation for a creator's community link once the player is loaded. */
export default function CommunityInvite({blocked}: {blocked: boolean}) {
  const {player} = useContext(PlayerContext);
  const [code, setCode] = useState<string | null>(null);
  const desktop = getElectronAPI();

  useEffect(() => {
    if (!player.isLoaded || blocked || code || !desktop?.getPendingCommunity) return;
    let live = true;
    const check = async () => {
      try {
        const pending = await desktop.getPendingCommunity!();
        if (!live || !pending) return;
        // Members can still open their own community's link; anything else is just dropped.
        if (player.community && player.community.id !== pending) {
          await desktop.acknowledgeCommunity?.(pending);
          return;
        }
        setCode(pending);
      } catch { /* The invitation stays pending for the next check. */ }
    };
    const unsubscribe = desktop.onCommunityAvailable?.(() => { void check(); });
    void check();
    return () => { live = false; unsubscribe?.(); };
  }, [player.isLoaded, player.community?.id, blocked, code]);

  if (!code || blocked) return null;
  return <JoinCommunityDialog code={code} via="link" onClose={() => {
    void desktop?.acknowledgeCommunity?.(code);
    setCode(null);
  }} />;
}
