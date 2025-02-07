import { h, Component } from 'preact';
import { PlayerNetworkData } from '@legion/shared/interfaces';
import CharacterCard from '../HUD/XPCountUp';
import './TeamReveal.style.css';

interface TeamRevealProps {
  team: PlayerNetworkData[];
  onComplete: () => void;
}

interface TeamRevealState {
  revealedIndices: boolean[];
  allRevealed: boolean;
}

export class TeamReveal extends Component<TeamRevealProps, TeamRevealState> {
  state = {
    revealedIndices: [false, false, false],
    allRevealed: false,
  };

  handleRevealCharacter = (index: number) => {
    if (!this.state.revealedIndices[index]) {
      const newRevealedIndices = [...this.state.revealedIndices];
      newRevealedIndices[index] = true;
      const allRevealed = newRevealedIndices.every(revealed => revealed);
      
      this.setState({ 
        revealedIndices: newRevealedIndices,
        allRevealed
      });
    }
  };

  render() {
    return (
      <div className="team-reveal-overlay">
        <h2 className="team-reveal-title">Click to discover your champions!</h2>
        <p className="team-reveal-subtitle">They will form your starting team of characters than you can use in the arena!</p>
        <div className="team-reveal-grid">
          {this.props.team.map((character, index) => (
            <div 
              key={index}
              className={`team-reveal-wrapper ${this.state.revealedIndices[index] ? 'revealed' : ''}`}
              onClick={() => this.handleRevealCharacter(index)}
            >
              <CharacterCard
                member={character}
                hideXP={true}
                isQuestionMark={!this.state.revealedIndices[index]}
              />
            </div>
          ))}
        </div>
        {this.state.allRevealed && (
          <button 
            className="team-reveal-play-button"
            onClick={this.props.onComplete}
          >
            PLAY!
          </button>
        )}
      </div>
    );
  }
} 