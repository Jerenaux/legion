import {t} from '../../i18n/core';

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
        <header className="team-reveal-header">
          <span className="team-reveal-eyebrow">{t("Welcome to the arena")}</span>
          <h2 className="team-reveal-title">{t("Meet your champions")}</h2>
          <p className="team-reveal-subtitle">{t("Three champions. One team. Lead them to victory.")}</p>
        </header>
        <div className="team-reveal-grid">
          {this.props.team.map((character, index) => (
            <button type="button" data-game-control
              key={index}
              className={`team-reveal-wrapper ${this.state.revealedIndices[index] ? 'revealed' : ''}`}
              aria-label={this.state.revealedIndices[index] ? character.name : t("Reveal champion {{number}}", {number: index + 1})}
              onClick={() => this.handleRevealCharacter(index)}
            >
              <CharacterCard
                member={character}
                hideXP={true}
                isQuestionMark={!this.state.revealedIndices[index]}
              />
              {this.state.revealedIndices[index] && <span className="team-reveal-role">{
                t(character.class === Class.WARRIOR ? 'Close combat' :
                character.class === Class.WHITE_MAGE ? 'Healing' : 'Ranged magic')
              }</span>}
              {!this.state.revealedIndices[index] && <span className="team-reveal-role">{t("Select to reveal")}</span>}
            </button>
          ))}
        </div>
        {this.state.allRevealed && (
          <div className="team-reveal-actions">
            <p className="team-reveal-rule">{t("One action per turn. A little guidance as you go.")}</p>
            <button type="button" data-game-control className="team-reveal-play-button"
              onClick={() => { events.emit('combatTipsVisibility', true); this.props.onComplete(); }}>
              {t("Start guided match")}
            </button>
            <button type="button" data-game-control className="team-reveal-skip"
              onClick={() => { events.emit('combatTipsVisibility', false); this.props.onComplete(); }}>
              {t("Play without tips")}
            </button>
            <p className="team-reveal-time">{t("{{seconds}}-second turns · Time to learn, room to experiment", {seconds: GAME_0_TURN_DURATION})}</p>
          </div>
        )}
      </div>
    );
  }
}
