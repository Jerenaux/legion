// Character.tsx
import { h, Component } from 'preact';
import ActionItem from './game/HUD/Action';
import { InventoryType } from '@legion/shared/enums';
import { classEnumToString, statStrings } from './utils';
import { items } from '@legion/shared/Items';
import { spells } from '@legion/shared/Spells';
import { CharacterStats } from '@legion/shared/interfaces';
import { getXPThreshold } from '@legion/shared/levelling';

import { apiFetch } from '../services/apiService';
import { successToast, errorToast } from './utils';

interface CharacterProps {
    id: string;
    refreshInventory: () => void;
}

interface CharacterState {
  portrait: string;
  name: string;
  class: number;
  level: number;
  xp: number;
  stats: CharacterStats;
  inventory: any[];
  skills: any[];
  carrying_capacity: number;
  skill_slots: number;
}

class Character extends Component<CharacterProps, CharacterState> {
  
  componentDidMount() {
    this.fetchCharacterData(); 
  }

  componentDidUpdate(prevProps) {
    if (prevProps.id !== this.props.id) {
      this.fetchCharacterData(); 
    }
  }

  async fetchCharacterData() {
    try {
        const data = await apiFetch(`characterData?id=${this.props.id}`);
        console.log(data);
        this.setState({ 
          ...data
        });
    } catch (error) {
        errorToast(`Error: ${error}`);
    }
  }

  onActionClick = (type: string, letter: string, index: number) => {
    const payload = {
        index,
        characterId: this.props.id,
    };
    
    apiFetch('unequipConsumable', {
        method: 'POST',
        body: payload
    })
    .then((data) => {
      if(data.status == 0) {
        successToast('Item unequipped!');
        this.props.refreshInventory();
      } else {
        errorToast('Inventory is full!');
      }
    })
    .catch(error => errorToast(`Error: ${error}`));
  }

  render() {
    const { portrait, name, class: characterClass, level, xp, inventory, carrying_capacity, skills, skill_slots } = this.state;
    const xpToLevel = getXPThreshold(level);

    const portraitStyle = {
        backgroundImage: `url(/sprites/${portrait}.png)`,
    };
    const xpRatio = xp / (xp + xpToLevel) * 100;

    const filledItems = Array.from({ length: carrying_capacity }, (_, i) => inventory[i] ?? -1);
    const filledSpells = Array.from({ length: skill_slots }, (_, i) => skills[i] ?? -1);

    return (
      <div className="character-full">
        <div className="character-header">
            <div className="character-header-name">{name}</div>
            <div className="character-header-name-shadow">{name}</div>
            <div className={`character-header-class`}>{classEnumToString(characterClass)}</div>
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
                          <div className="xp-bar" style={{width: `${xpRatio}%`}} />
                      </div>
                  </div>
              </div>
              <div className="stats-area">
                {this.state.stats && statStrings.map((stat) => (
                  <div key={stat} className={`badge ${stat}`}>
                    <span className="badge-label">{stat.toUpperCase()}</span> 
                    <span>{this.state.stats[stat]}</span>
                  </div>
                ))}
              </div>
              <div className="character-full-actions">
                <div className="player-items">
                  <div className='slots-header'>Items</div>
                  <div className="slots"> 
                  {filledItems && filledItems.map((item, i) => (
                    <ActionItem 
                      action={item > -1 ? items[item] : null} 
                      index={i} 
                      clickedIndex={-1}
                      canAct={true} 
                      actionType={InventoryType.CONSUMABLES}
                      onActionClick={this.onActionClick}
                      key={i}
                    />
                  ))}
                  </div>
                </div>
                {filledSpells && filledSpells.length > 0 && <div className="player-skills">
                  <div className='slots-header'>Skills</div>
                  <div className="slots">
                  {filledSpells && filledSpells.map((spell, i) => (
                    <ActionItem 
                      action={spell > -1 ? spells[spell] : null} 
                      index={i} 
                      clickedIndex={-1}
                      canAct={true} 
                      actionType={InventoryType.SKILLS}
                      key={i}
                    />
                  ))}
                  </div>
                </div>}
              </div>
            </div>
            <div className="character-portrait" style={portraitStyle} />
        </div>
      </div>
    );
  }
}

export default Character;