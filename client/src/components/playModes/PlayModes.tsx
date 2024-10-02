import './PlayModes.style.css'
import { h, Component } from 'preact';
import PlayModeButton from '../playModeButton/playModeButton';
import { PlayMode } from '@legion/shared/enums';

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
        <PlayModeButton label={MiddleBtns.CASUAL} players={0} mode={PlayMode.CASUAL}/>
        <PlayModeButton label={MiddleBtns.RANKED} players={8} mode={PlayMode.RANKED}/>
        {isSolanaWalletPresent && (
          <PlayModeButton label={MiddleBtns.ELYSIUM} players={8} mode={PlayMode.STAKED}/>
        )}
      </div>
    );
  }
}

export default PlayModes;