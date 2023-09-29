// Character.tsx
import { h, Component } from 'preact';
import ActionItem from './game/HUD/Action';
import { ActionType } from './game/HUD/ActionTypes';

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
  items: any[];
  spells: any[];
}

class Character extends Component<CharacterProps, CharacterState> {
  componentDidMount() {
    // Fetch the character's data here, using this.props.id
    // For now, we'll just use some dummy data
    this.setState({
      portrait: '/assets/sprites/1_1.png',
      name: 'Character Name!',
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
      items: [
        { id: 1, name: 'Potion', description: 'Restores 50 HP', frame: 'potion.png', price: 100, target: "self", cooldown: 2, effects: [{ stat: "hp", value: 50 }] },
        { id: 1, name: 'Potion', description: 'Restores 50 HP', frame: 'ether.png', price: 100, target: "self", cooldown: 2, effects: [{ stat: "hp", value: 50 }] },
      ],
      spells: [
        { id: 1, name: 'Fireball', description: 'Restores 50 HP', frame: 'fireball.png', price: 100, target: "self", cooldown: 2, effects: [{ stat: "hp", value: 50 }] },
        { id: 1, name: 'Heal', description: 'Restores 50 HP', frame: 'heal.png', price: 100, target: "self", cooldown: 2, effects: [{ stat: "hp", value: 50 }] },
      ]
    });
  }
  

  render() {
    const { id } = this.props.matches;
    const { portrait, name, class: characterClass, level, xp, xpToLevel, items, spells } = this.state;

    if (items) {
      while (items.length < 3) {
        items.push({id: -1});
      }
    }

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
              <div className="character-full-actions">
                <div className="player-items">
                  <div className='slots-header'>Items</div>
                  <div className="slots"> 
                  {items && items.map((item, i) => (
                    <ActionItem 
                      action={item} 
                      index={i} 
                      clickedIndex={-1}
                      canAct={true} 
                      actionType={ActionType.Item}
                    />
                  ))}
                  </div>
                </div>
                {spells && spells.length > 0 && <div className="player-skills">
                  <div className='slots-header'>Skills</div>
                  <div className="slots">
                  {spells && spells.map((spell, i) => (
                    <ActionItem 
                      action={spell} 
                      index={i} 
                      clickedIndex={-1}
                      canAct={true} 
                      actionType={ActionType.Skill}
                    />
                  ))}
                  </div>
                </div>}
              </div>
            </div>
            <div className="character-portrait" style={portraitStyle}></div>
        </div>
      </div>
    );
  }
}

export default Character;