// CharacterCard.tsx
import { h, Component } from 'preact';
import { route } from 'preact-router';
import {Class} from "@legion/shared/enums";
import { classEnumToString } from '../utils';
import { CharacterStats } from '@legion/shared/interfaces';
import './ChracterCard.style.css';

interface CharacterProps {
  id: number;
  portrait: string;
  name: string;
  class: number;
  level: number;
  xp: number;
  stats: CharacterStats
}

class CharacterCard extends Component<CharacterProps> {
  state = {
    active: false
  }

  handleCardClick = () => {
    const { id } = this.props;
    route(`/team/${id}`);
  }

  render() {
    const { portrait, name, class: characterClass, level } = this.props;
    const portraitStyle = {
        backgroundImage: `url(/sprites/${portrait}.png)`,
    };

    const bgStyle = {
      backgroundImage: `url(/team_Bg_${this.state.active ? 'active' : 'idle'}.png)`,
      cursor: 'pointer'
    }
    
    return (
      <div className="cardContainer" style={bgStyle} onClick={this.handleCardClick} onMouseEnter={() => this.setState({active: true})} onMouseLeave={() => this.setState({active: false})}>
        <div className="characterLevel">
          <span className="level">Lv</span>
          <span className="levelVal">{level}</span>
        </div>
        <div className="characterName">
          <span className="name">{name}</span>
          <span className="class">{classEnumToString(characterClass)}</span>
        </div>
        <div className="portraitContainer">
          <div className="portrait" style={portraitStyle} />
        </div>
      </div>
    );
  }
}

export default CharacterCard;