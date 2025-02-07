import './PlayModes.style.css'
import { h, Component } from 'preact';
import PlayModeButton from '../playModeButton/playModeButton';
import { PlayMode, LockedFeatures } from '@legion/shared/enums';
import { ENABLE_ELYSIUM } from '@legion/shared/config';
import { PlayerContext } from '../../contexts/PlayerContext';
import { lockIcon } from '../utils';
import BottomBorderDivider from '../bottomBorderDivider/BottomBorderDivider';

enum MiddleBtns {
  PRACTICE = 'practice',
  CASUAL = 'casual',
  RANKED = 'ranked',
  ELYSIUM = 'elysium',
}

class PlayModes extends Component {
  static contextType = PlayerContext;

  state = {
    isSolanaWalletPresent: false
  };

  componentDidMount() {
    this.checkSolanaWallet();
  }

  checkSolanaWallet = () => {
    // Check if Solana object is present in the window
    const isSolanaPresent = 'solana' in window;
    
    this.setState({ isSolanaWalletPresent: isSolanaPresent });
  };

  render() {
    const { isSolanaWalletPresent } = this.state;
    const isRankedUnlocked = this.context.canAccessFeature(LockedFeatures.RANKED_MODE);
    
    return (
      <div className="barContainer">
        <BottomBorderDivider label="PLAY MODES" />
        <div className="playModesRow">
          <PlayModeButton 
            label={MiddleBtns.PRACTICE} 
            mode={PlayMode.PRACTICE}
            data-playmode="practice"
          />
          <PlayModeButton 
            label={MiddleBtns.CASUAL} 
            mode={PlayMode.CASUAL}
            players={Math.floor(Math.random() * 4) + 1} 
            data-playmode="casual"
          />
          <PlayModeButton 
            label={MiddleBtns.RANKED} 
            players={Math.floor(Math.random() * 2) + 1} 
            mode={PlayMode.RANKED}
            disabled={!isRankedUnlocked}
            lockIcon={!isRankedUnlocked ? lockIcon : undefined}
          />
          {ENABLE_ELYSIUM && isSolanaWalletPresent && (
            <PlayModeButton 
              label={MiddleBtns.ELYSIUM} 
              players={1} 
              mode={PlayMode.STAKED} 
              isLobbies={true}
            />
          )}
        </div>
      </div>
    );
  }
}

export default PlayModes;