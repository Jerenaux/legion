// PlayPage.tsx
import { h, Component } from 'preact';

class PlayPage extends Component {
  render() {
    // This is just a placeholder. Replace this with the actual data.
    const team = [
      { name: 'Character 1', class: 'Class 1', level: 1, image: 'assets/sprites/1_1.png' },
      { name: 'Character 2', class: 'Class 2', level: 2, image: 'assets/sprites/1_2.png' },
    ];

    return (
        <div>
          <div className="page-header">
            <img src="assets/play.png" className="page-icon" />
            <h1 className="page-title">Play</h1>
          </div>
          <div className="play-content">
            <div className="team-container">
              <h2 className="team-title">Your team</h2>
              <div className="team-members">
                {team.map((character) => (
                  <div className="team-member">
                    <div className="player-portrait" style={{ backgroundImage: `url(${character.image})` }}>
                      <span className="character-level">{character.level}</span>
                    </div>
                    <div className="character-info">
                      <span className="character-name">{character.name}</span>
                      <span className="character-class">{character.class}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
  }
}

export default PlayPage;