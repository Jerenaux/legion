// Character.tsx
import { h, Component } from 'preact';
import ActionItem from './game/HUD/Action';
import { ActionType } from './game/HUD/ActionTypes';
import { classEnumToString } from './utils';
import { CharacterContext } from './CharacterContext';

import firebase from 'firebase/compat/app'
import firebaseConfig from '@legion/shared/firebaseConfig';
firebase.initializeApp(firebaseConfig);
interface CharacterProps {
    matches: {
        id: string;
    };
}

interface CharacterState {
  user: firebase.User | null;
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
  inventory: any[];
  skills: any[];
  carrying_capacity: number;
  skill_slots: number;
}

class Character extends Component<CharacterProps, CharacterState> {
  static contextType = CharacterContext;
  authSubscription: firebase.Unsubscribe | null = null;
  
  componentDidMount() {
    console.log('mounting');
    this.authSubscription = firebase.auth().onAuthStateChanged((user) => {
      this.setState({ user }, () => {
        if (user) {
          console.log('User is logged in');
          this.fetchCharacterData(this.state.user); 
        }
      });
    });
  }

  componentDidUpdate(prevProps) {
    if (prevProps.matches.id !== this.props.matches.id) {
      this.fetchCharacterData(this.state.user); 
    }
  }

  componentWillUnmount() {
    // Don't forget to unsubscribe when the component unmounts
    this.authSubscription();
  }

  async fetchCharacterData(user) {
    user.getIdToken(true).then((idToken) => {
      // Make the API request, including the token in the Authorization header
      fetch(`${process.env.PREACT_APP_API_URL}/characterData?id=${this.props.matches.id}`, {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      })
      .then(response => response.json())
      .then(data => {
        console.log(data);
        this.setState({ 
          ...data,
        });
      })
      .catch(error => console.error('Error:', error));
    }).catch((error) => {
      console.error(error);
    });
  }

  onActionClick = (type: string, letter: string, index: number) => {
    console.log('clicked', index);
  }

  render() {
    const { characterId } = this.context;
    const { portrait, name, class: characterClass, level, xp, inventory, carrying_capacity, skills, skill_slots } = this.state;
    const xpToLevel = 100;

    const portraitStyle = {
        backgroundImage: `url(/assets/sprites/${portrait}.png)`,
    };
    const xpRatio = xp / (xp + xpToLevel) * 100;

    const stats = ['hp', 'atk', 'spatk', 'mp', 'def', 'spdef'];

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
                  {filledItems && filledItems.map((item, i) => (
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
                {filledSpells && filledSpells.length > 0 && <div className="player-skills">
                  <div className='slots-header'>Skills</div>
                  <div className="slots">
                  {filledSpells && filledSpells.map((spell, i) => (
                    <ActionItem 
                      action={spell} 
                      index={i} 
                      clickedIndex={-1}
                      canAct={true} 
                      actionType={ActionType.Skill}
                      onActionClick={this.onActionClick}
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