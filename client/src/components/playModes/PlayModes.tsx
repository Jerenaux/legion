import './PlayModes.style.css'
import { h, Component } from 'preact';
import PlayModeButton from '../playModeButton/playModeButton';
import { PlayMode } from '@legion/shared/enums';
import { ENABLE_ELYSIUM } from '@legion/shared/config';

enum MiddleBtns {
  PRACTICE = 'practice',
  CASUAL = 'casual',
  RANKED = 'ranked',
  ELYSIUM = 'elysium',
}

class PlayModes extends Component {
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
    
    return (
      <div className="barContainer">
        <PlayModeButton label={MiddleBtns.PRACTICE} mode={PlayMode.PRACTICE}/>
        <PlayModeButton label={MiddleBtns.CASUAL} players={Math.floor(Math.random() * 4) + 1} mode={PlayMode.CASUAL}/>
        <PlayModeButton label={MiddleBtns.RANKED} players={Math.floor(Math.random() * 2) + 1} mode={PlayMode.RANKED}/>
        {ENABLE_ELYSIUM && isSolanaWalletPresent && (
          <PlayModeButton label={MiddleBtns.ELYSIUM} players={1} mode={PlayMode.STAKED} isLobbies={true}/>
        )}
      </div>
    );
  }
}

export default PlayModes;