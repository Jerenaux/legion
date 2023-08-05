// AliveCount.js
import { h, Component } from 'preact';

class PlayerTab extends Component {
  constructor(props) {
    super(props);
    this.state = {
      player: this.props.player,
    };
  }

  componentDidMount() {
    this.timerID = setInterval(() => this.tick(), 1000);
  }

  componentWillUnmount() {
    clearInterval(this.timerID);
  }

  formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
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
      }
      return prevState;
    });
  }

  render({player}) {
    const portraitStyle = {
      backgroundImage: `url(${player.portrait})`,
      backgroundPosition: '-45px -45px', // adjust these values to your needs
      backgroundRepeat: 'no-repeat',
    };
    const HPBackground = this.getHPBackground(player);
    const MPBackground = this.getMPBackground(player);
    const isCooldownActive = player.cooldown > 0;
    const cooldownClass = isCooldownActive ? "cooldown" : "cooldown cooldown-complete";
    
    return <div className="player-tab box">
        <div className="player-info">
          <span className="player-num">#{player.number} </span> 
          <span>{player.name}</span>
          <span className="player-level">Lvl 1</span>
          <span className="player-xp">XP 0/100</span>
          <span className="player-class">Warrior</span>
          {/* <span className="player-status"></span> */}
        </div>
        <div className="player-main">
          <div className="player-content">
            <div style={portraitStyle} className="player-portrait" />
            <div className="player-stats">
                <div className={cooldownClass}>
                  <span className="cooldown-label">⏱ Cooldown</span>
                  <span className="cooldown-amount" >{this.formatTime(player.cooldown)} </span>
                  <span className="cooldown-state" >{isCooldownActive ? `⏳` : `✅`}</span>
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
            <h4>Skills</h4>
            {player.skills.map(skill => 
                <div className="skill">
                    {skill.name}: {skill.cooldown} seconds cooldown
                </div>
            )}
        </div>
        <div className="player-items">
            <h4>Items</h4>
            {player.items.map(item => 
                <div className="item">
                    {item.name}: {item.quantity}
                </div>
            )}
        </div>
    </div>;
  }
}

export default PlayerTab;
