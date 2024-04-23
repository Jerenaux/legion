// SeasonCard.tsx
import './SeasonCard.style.css';
import { h, Component } from 'preact';

interface SeasonCardProps {
    seasonEnd: string;
    playerRanking: {
        rank: number;
        elo: number;
        player: string;
    };
  }

class SeasonCard extends Component<SeasonCardProps> {

  render() {
    const eloBGStyle = {
        backgroundImage: 'url(/rank/elo_rating_bg.png)',
        transform: 'scale(1.2)',
    }

    const seasonBGStyle = {
        backgroundImage: 'url(/rank/recap_blue_bar.png)',
        width: '94%',
    }

    return (
      <div className="season-card-container">
        <div className="recap-single-container">
            <div className="season-recap">
                <p className="season-recap-title">CURRENT</p>
                <p className="season-recap-label">RANK</p>
                <div className="season-recap-img">
                    <span>{this.props.playerRanking.rank}</span>
                </div>
            </div>
            <div className="season-recap">
                <p className="season-recap-title">ELO</p>
                <p className="season-recap-label">RATING</p>
                <div className="season-recap-img" style={eloBGStyle}>
                    <span>{this.props.playerRanking.elo}</span>
                </div>
            </div>
            <div className="season-recap">
                <p className="season-recap-title">SEASON</p>
                <p className="season-recap-label">ENDED</p>
                <div className="recap-season-bg" style={seasonBGStyle}>
                    <img src="/rank/infinity_icon.png" alt="infinity" />
                </div>
            </div>
        </div>
        <div className="season-share-button" onClick={() => {}}>
            <img src="/rank/share_icon.png" alt="" />
            <span>SHARE</span>
        </div>
      </div>
    );
  }
}

export default SeasonCard;