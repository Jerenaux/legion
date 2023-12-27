// CharacterCard.tsx
import { h, Component } from 'preact';
import { route } from 'preact-router';
import {Class} from "@legion/shared/types";

interface CharacterProps {
  id: number;
  portrait: string;
  name: string;
  class: number;
  level: number;
  xp: number;
  hp: number;
  mp: number;
  atk: number;
  def: number;
  spAtk: number;
  spDef: number;
}

class CharacterCard extends Component<CharacterProps> {
  handleCardClick = () => {
    const { id } = this.props;
    route(`/team/${id}`);
  }

  render() {
    const { portrait, name, class: characterClass, level, xp, hp, mp, atk, def, spAtk, spDef } = this.props;
    const portraitStyle = {
        backgroundImage: `url(/assets/sprites/${portrait}.png)`,
    };
    
    const classToCssClass: { [key in Class]?: string } = {};
    classToCssClass[Class.WARRIOR] = "warrior";
    classToCssClass[Class.WHITE_MAGE] = "white-mage";
    classToCssClass[Class.BLACK_MAGE] = "black-mage";
    classToCssClass[Class.THIEF] = "thief";
    const cssClass = classToCssClass[characterClass];
    
    const classToName: { [key in Class]?: string } = {};
    classToName[Class.WARRIOR] = "Warrior";
    classToName[Class.WHITE_MAGE] = "White Mage";
    classToName[Class.BLACK_MAGE] = "Black Mage";
    classToName[Class.THIEF] = "Thief";
    const className = classToName[characterClass];

    return (
      <div className={`character-card ${cssClass}`} onClick={this.handleCardClick}>
        <div className="character-portrait" style={portraitStyle}></div>
        <div className="character-info">
          <span className="character-name">{name}</span>
          <span className="character-class">{className}</span>
        </div>
        <div className="level-badge">
            <span>lvl</span>
            <span className="level-number">{level}</span>
        </div>
      </div>
    );
  }
}

export default CharacterCard;