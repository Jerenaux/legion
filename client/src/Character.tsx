// Character.tsx
import { h, Component } from 'preact';
import { route } from 'preact-router';

interface CharacterProps {
    matches: {
        id: string;
    };
}

interface CharacterState {
  portrait: string;
  name: string;
  class: string;
  level: number;
  xp: number;
  xpToLevel: number;
  hp: number;
  mp: number;
  atk: number;
  def: number;
  spAtk: number;
  spDef: number;
}

class Character extends Component<CharacterProps, CharacterState> {
  componentDidMount() {
    // Fetch the character's data here, using this.props.id
    // For now, we'll just use some dummy data
    this.setState({
      portrait: '/assets/sprites/1_1.png',
      name: 'Character Name',
      class: 'Black Mage',
      level: 1,
      xp: 67,
      xpToLevel: 100,
      hp: 100,
      mp: 50,
      atk: 10,
      def: 10,
      spAtk: 10,
      spDef: 10,
    });
  }
  

  render() {
    const { id } = this.props.matches;
    console.log(`id: `, id);
    const { portrait, name, class: characterClass, level, xp, xpToLevel, hp, mp, atk, def, spAtk, spDef } = this.state;
    const portraitStyle = {
        backgroundImage: `url(${portrait})`,
    };
    const xpRatio = xp / (xp + xpToLevel) * 100;

    const classToCssClass = {
        'Warrior': 'warrior',
        'Thief': 'thief',
        'White Mage': 'white-mage',
        'Black Mage': 'black-mage',
    };

    const cssClass = classToCssClass[characterClass];
    const stats = ['hp', 'atk', 'spAtk', 'mp', 'def', 'spDef'];

    return (
      <div className="character-full">
        <div className="character-header">
            <div className="character-header-name">{name}</div>
            <div className="character-header-name-shadow">{name}</div>
            <div className={`character-header-class ${cssClass}`}>{characterClass}</div>
        </div>
        <div className="character-full-content">
            <div className="character-full-stats">
              <div className="level-area">
                  <div className="level-badge">
                      <span>lvl</span>
                      <span className="level-number">{level}</span>
                  </div>
                  <div className="xp-area">
                      <div className="next-level">Next: {xpToLevel - xp} XP</div>
                      <div className="xp-bar-bg">
                          <div className="xp-bar" style={{width: `${xpRatio}%`}}></div>
                      </div>
                  </div>
              </div>
              <div className="stats-area">
                {stats.map((stat) => (
                  <div className={`badge ${stat}`}>
                    <span className="badge-label">{stat.toUpperCase()}</span> 
                    <span>{this.state[stat]}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="character-portrait" style={portraitStyle}></div>
        </div>
      </div>
    );
  }
}

export default Character;