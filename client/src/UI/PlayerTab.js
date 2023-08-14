// AliveCount.js
import { h, Component } from 'preact';

class PlayerTab extends Component {
  constructor(props) {
    super(props);
    this.state = {
      player: this.props.player,
    };
    this.events = this.props.eventEmitter;
  }

  componentDidMount() {
    this.timerID = setInterval(() => this.tick(), 1000);
  }

  componentWillUnmount() {
    clearInterval(this.timerID);
  }

  formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  getBackground(fullColor, emptyColor, ratio) {
    // let percent = Math.round((ratio) * 100);
    let percent = 27 + Math.round(((ratio) * 73));
    return `linear-gradient(to right, ${fullColor} 0%, ${fullColor} ${percent}%, ${emptyColor} ${percent}%, ${emptyColor} 100%)`;
  }  

  getHPBackground(player) {
    return this.getBackground('#028406', '#AD0606', player.hp / player.maxHp);
  }

  getMPBackground(player) {
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

  itemClick(letter) {
    this.events.emit('itemClick', letter);
  }

  render({player}) {
    const portraitStyle = {
      backgroundImage: `url(assets/sprites/${player.portrait})`,
      backgroundPosition: '-45px -45px', // adjust these values to your needs
      backgroundRepeat: 'no-repeat',
    };
    const HPBackground = this.getHPBackground(player);
    const MPBackground = this.getMPBackground(player);
    const isCooldownActive = player.cooldown > 0;
    const cooldownClass = isCooldownActive ? "cooldown-state" : "cooldown-state cooldown-complete";
    const keyboardLayout = 'QWERTYUIOPASDFGHJKLZXCVBNM';
    const isDead = player.hp <= 0;

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
        <div className="player-skills">
            <h4>🔥 Spells </h4>
            {player.spells.map((skill, i) => {
                const startPosition = keyboardLayout.indexOf('Q');
                const keyBinding = keyboardLayout.charAt(startPosition + i);
                return (<div className="skill" onClick={() => this.itemClick(keyBinding)}>
                  <div 
                      className={isCooldownActive || isDead ? 'skill-item-image skill-item-image-off' : 'skill-item-image'}
                      style={{backgroundImage: `url(assets/skills/${skill.frame})`, }} />
                  <span className="key-binding">{keyBinding}</span>
                  <div className="info-box box">
                    <div className="info-box-title">{skill.name}</div>
                    <div className="info-box-desc">{skill.description}</div>
                    <div className="mp mini">  
                      <span className="mp-label">MP</span>
                      <span className="mp-amount">{skill.cost}</span>
                    </div>
                    <div className='badge'>
                          <span className="badge-label">⏳ </span> 
                          <span>{skill.cooldown}s</span>
                        </div>
                    <div className='badge'>
                      <span className="badge-label">🎯 </span> 
                      <span>{skill.target}</span>
                    </div>
                  </div>
                </div>)
              }
            )}
        </div>
        <div className="player-items">
            <h4>🧪 Items </h4>
            {player.items.map((item, i) => {
                const startPosition = keyboardLayout.indexOf('Z');
                const keyBinding = keyboardLayout.charAt(startPosition + i);
                return (
                  <div className="item" onClick={() => this.itemClick(keyBinding)}>
                    <div 
                      className={isCooldownActive || isDead ? 'skill-item-image skill-item-image-off' : 'skill-item-image'}
                      style={{backgroundImage: item.quantity !== 0 ? `url(assets/items/${item.frame})` : 'none'}}
                      />
                    {item.quantity !== 0 && <span className="item-qty">x{item.quantity}</span>}
                    <span className="key-binding">{keyBinding}</span>
                    <div className="info-box box">
                      <div className="info-box-title">{item.name}</div>
                      <div className="info-box-desc">{item.description}</div>
                      {
                        item.effects.map((effect) => {
                          return (
                            <div className="hp mini">  
                            <span className="mp-label">{effect.stat}</span>
                            <span className="mp-amount">+{effect.value}</span>
                          </div>
                          );
                        })
                      }
                      <div class="info-box-extra">
                        <div className='badge'>
                          <span className="badge-label">⏳ </span> 
                          <span>{item.cooldown}s</span>
                        </div>
                        <div className='badge'>
                          <span className="badge-label">🎯 </span> 
                          <span>{item.target}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
            }
            )}
        </div>
    </div>;
  }
}

export default PlayerTab;
