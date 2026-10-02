
import { h } from 'preact';
import { Component } from 'preact';
import { PlayerNetworkData } from '@legion/shared/interfaces';
import CharacterCard from '../HUD/CharacterCard';
import './TeamReveal.style.css';
import { Class } from '@legion/shared/enums';
import { GAME_0_TURN_DURATION } from '@legion/shared/config';
import { events } from '../HUD/GameHUD';

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
    this.setState(previous => {
      const revealedIndices = previous.revealedIndices.map((revealed, i) => revealed || i === index);
      return { revealedIndices, allRevealed: revealedIndices.every(Boolean) };
    });
  };

  render() {
    return (
      <div className="team-reveal-overlay">
        <h2 className="team-reveal-title">Your first battle</h2>
        <p className="team-reveal-subtitle">Discover your champions, then defeat the enemy team.<br />
          Each character takes <strong>one action per turn</strong>. We’ll guide you as you play.</p>
        <div className="team-reveal-grid">
          {this.props.team.map((character, index) => (
            <button type="button" data-game-control
              key={index}
              className={`team-reveal-wrapper ${this.state.revealedIndices[index] ? 'revealed' : ''}`}
              aria-label={this.state.revealedIndices[index] ? character.name : `Reveal champion ${index + 1}`}
              onClick={() => this.handleRevealCharacter(index)}
            >
              <CharacterCard
                member={character}
                hideXP={true}
                isQuestionMark={!this.state.revealedIndices[index]}
              />
              {this.state.revealedIndices[index] && <span className="team-reveal-role">{
                character.class === Class.WARRIOR ? 'Close combat' :
                character.class === Class.WHITE_MAGE ? 'Healing' : 'Ranged magic'
              }</span>}
            </button>
          ))}
        </div>
        {this.state.allRevealed && (
          <div className="team-reveal-actions">
            <button type="button" data-game-control className="team-reveal-play-button"
              onClick={() => { events.emit('combatTipsVisibility', true); this.props.onComplete(); }}>
              Start guided match
            </button>
            <button type="button" data-game-control className="team-reveal-skip"
              onClick={() => { events.emit('combatTipsVisibility', false); this.props.onComplete(); }}>
              Play without tips
            </button>
            <p>Take your time: {GAME_0_TURN_DURATION}-second turns here. Later matches are faster.</p>
          </div>
        )}
      </div>
    );
  }
}