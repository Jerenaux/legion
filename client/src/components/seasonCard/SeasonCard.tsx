// SeasonCard.tsx
import './SeasonCard.style.css';
import { h, Component } from 'preact';

interface SeasonCardProps {
    seasonEnd: number;
    playerRanking: {
        rank: number;
        elo: number;
        player: string;
    };
}

class SeasonCard extends Component<SeasonCardProps> {
    private timer: NodeJS.Timeout | null = null;

    state = {
        time: 0
    }

    componentDidMount(): void {
        // Get the target end time from localStorage or set it if not present
        const endTime = localStorage.getItem('seasonEndtime');
        const targetEndTime = endTime || new Date().getTime() + this.props.seasonEnd * 1000;

        if (!endTime) {
            localStorage.setItem('seasonEndtime', targetEndTime.toString());
        }

        this.timer = setInterval(() => {
            const currentTime = new Date().getTime();
            const remainingTime = Math.max((targetEndTime as number - currentTime) / 1000, 0);

            this.setState({ time: remainingTime });

            if (remainingTime <= 0) {
                clearInterval(this.timer);
                localStorage.removeItem('seasonEndtime');
            }
        }, 1000);
    }

    componentWillUnmount(): void {
        if (this.timer) {
            clearInterval(this.timer);
        }
    }

    render() {
        const eloBGStyle = {
            backgroundImage: 'url(/rank/elo_rating_bg.png)',
            transform: 'scale(1.2)',
        }

        const seasonBGStyle = {
            backgroundImage: 'url(/rank/recap_blue_bar.png)',
            width: '80%',
            bottom: `${this.state.time > 0 ? '36px' : '20px'}`,
            padding: `${this.state.time > 0 ? '4px 8px' : '10px 8px'}`
        }

        const countDown = {
            day: Math.floor(Math.min(31, this.state.time / 86400)),
            hour: Math.floor(Math.min(23, (this.state.time % 86400) / 3600)),
            minute: Math.floor((this.state.time % 3600) / 60),
            second: Math.floor(this.state.time % 60)
        };

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
                        <p className="season-recap-label">ENDS IN</p>
                        <div className="recap-season-bg" style={seasonBGStyle}>
                            {this.state.time > 0 ? (
                                <div style={{width: '100%'}}>
                                    <div className="recap-season-timer-label">
                                        <span>D</span>
                                        <span>H</span>
                                        <span>M</span>
                                        <span>S</span>
                                    </div>
                                    <div className="recap-season-timer">
                                        <span>{`${countDown.day}`.padStart(2, "0")}</span> :
                                        <span>{`${countDown.hour}`.padStart(2, "0")}</span> :
                                        <span>{`${countDown.minute}`.padStart(2, "0")}</span> :
                                        <span>{`${countDown.second}`.padStart(2, "0")}</span>
                                    </div>
                                </div>
                            ) : <img src="/rank/infinity_icon.png" alt="infinity" />}
                        </div>
                        {this.state.time > 0 && <img src="/inventory/cd_icon.png" alt="timer" className="season-timer-icon" />}
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