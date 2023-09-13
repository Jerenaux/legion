// CharacterCard.tsx
import { h, Component } from 'preact';

interface CharacterProps {
  portrait: string;
  name: string;
  class: string;
  level: number;
}

class CharacterCard extends Component<CharacterProps> {
  render() {
    const { portrait, name, class: characterClass, level } = this.props;
    const portraitStyle = {
        backgroundImage: `url(${portrait})`,
    };
    return (
      <div className="character-card">
        <div className="character-portrait" style={portraitStyle}></div>
        <div className="character-info">
          <span className="character-name">{name}</span>
          <span className="character-class">{characterClass}</span>
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