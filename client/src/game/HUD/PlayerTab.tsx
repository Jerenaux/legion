import { h, Component } from 'preact';
import ActionItem from './Action';
import { ActionType } from './ActionTypes';
import { BaseItem } from "@legion/shared/BaseItem";
import { BaseSpell } from "@legion/shared/BaseSpell";

interface Player {
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  cooldown: number;
  casting: boolean;
  portrait: string;
  number: number;
  name: string;
  spells: BaseSpell[];
  items: BaseItem[];
}

interface Props {
  player: Player;
  eventEmitter: any;
}

interface State {
  player: Player;
  clickedItem: number;
  clickedSpell: number;
}

class PlayerTab extends Component<Props, State> {
  timerID: NodeJS.Timeout;
  events: any;

  constructor(props: Props) {
    super(props);
    this.state = {
      player: this.props.player,
      clickedItem: -1,
      clickedSpell: -1,
    };
    this.events = this.props.eventEmitter;
  }

  componentDidMount() {
    this.timerID = setInterval(() => this.tick(), 1000);
  }

  componentWillUnmount() {
    clearInterval(this.timerID);
  }

  formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  getBackground(fullColor: string, emptyColor: string, ratio: number): string {
    let percent = 27 + Math.round(((ratio) * 73));
    return `linear-gradient(to right, ${fullColor} 0%, ${fullColor} ${percent}%, ${emptyColor} ${percent}%, ${emptyColor} 100%)`;
  }  

  getHPBackground(player: Player): string {
    return this.getBackground('#028406', '#AD0606', player.hp / player.maxHp);
  }

  getMPBackground(player: Player): string {
    return this.getBackground('#0645AD', '#AD0606', player.mp / player.maxMp);
  }

  tick() {
    this.setState(prevState => {
      if (prevState.player.cooldown > 0) {
        prevState.player.cooldown--;
        prevState.player.cooldown = Math.max(0, prevState.player.cooldown);
      }
      return prevState;
    });
  }

  actionClick(type: string, letter: string, index: number) {
    this.events.emit('itemClick', letter);

    const stateField = type == 'item' ? 'clickedItem' : 'clickedSpell';
    this.setState({ [stateField]: index });

    setTimeout(() => {
      this.setState({ [stateField]: -1 });
    }, 1000);
  }

  render(props: Props, state: State) {
    const { player } = props;

      const portraitStyle = {
        backgroundImage: `url(assets/sprites/${player.portrait})`,
      };
      const HPBackground = this.getHPBackground(player);
      const MPBackground = this.getMPBackground(player);
      const isCooldownActive = player.cooldown > 0;
      const cooldownClass = isCooldownActive ? "cooldown-state" : "cooldown-state cooldown-complete";
      const isDead = player.hp <= 0;
      const canAct = !isCooldownActive && !isDead && !player.casting;
  
      return <div className="player-tab box">
          <div className="player-info">
            <div className='badge'>
              <span className="badge-label">#{player.number} </span> 
              <span>{player.name}</span>
            </div>
            <div className='badge'>
              <span className="badge-label">Lvl </span> 
              <span>1</span>
            </div>
            <div className='badge'>
              <span className="badge-label">XP </span> 
              <span>0 / 100</span>
            </div>  
          </div>
          <div className="player-main">
            <div className="player-content">
              <div style={portraitStyle} className="player-portrait" />
              <div className="player-stats">
                  <div className="cooldown">
                    <span className="cooldown-label">⏱ Cooldown</span>
                    <span className="cooldown-amount" >{this.formatTime(player.cooldown)} </span>
                    <span className={cooldownClass} >{isCooldownActive ? `⏳` : `✅`}</span>
                    </div>
                  <div className="hp" style={{background: HPBackground}}>  
                    <span className="hp-label">❤️ HP</span>
                    <span className="hp-amount">{player.hp} / {player.maxHp}</span>
                  </div>
  
                  <div className="mp" style={{background: MPBackground}}>  
                    <span className="mp-label">⚡️ MP</span>
                    <span className="mp-amount">{player.mp} / {player.maxMp}</span>
                  </div>
              </div>
            </div>
          </div>
          {player.spells && player.spells.length > 0 && (
            <div className="player-skills">
              <h4>🔥 Spells </h4>
              {player.spells.map((skill, i) => (
                <ActionItem 
                  action={skill} 
                  index={i} 
                  clickedIndex={this.state.clickedSpell} 
                  canAct={canAct} 
                  actionType={ActionType.Skill} 
                  onActionClick={this.actionClick.bind(this)} 
                />
              ))}
            </div>
          )}

          {player.items && player.items.length > 0 && (
            <div className="player-items">
              <h4>🧪 Items </h4>
              {player.items.map((item, i) => (
                <ActionItem 
                  action={item} 
                  index={i} 
                  clickedIndex={this.state.clickedItem} 
                  canAct={canAct} 
                  actionType={ActionType.Item}
                  onActionClick={this.actionClick.bind(this)} 
                />
              ))}
            </div>
          )}
      </div>;
  }
}

export default PlayerTab;