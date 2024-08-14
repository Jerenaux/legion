// SeasonCard.tsx
import './SeasonCard.style.css';
import { h, Component, createRef } from 'preact';

// Import image assets
import eloRatingBg from '@assets/rank/elo_rating_bg.png';
import recapBluebar from '@assets/rank/recap_blue_bar.png';
import infinityIcon from '@assets/rank/infinity_icon.png';
import cdIcon from '@assets/inventory/cd_icon.png';
import shareIcon from '@assets/rank/share_icon.png';

interface SeasonCardProps {
    seasonEnd: number;
    currTab: string;
    playerRanking: {
        rank: number;
        metric: number;
    };
    rankRowNumberStyle: (index: number) => {};
}

class SeasonCard extends Component<SeasonCardProps> {
    private timer: NodeJS.Timeout | null = null;
    captureRef = createRef();

    state = {
        time: 0
    }

    componentDidMount(): void {
        this.seasonTimer();
    }

    componentDidUpdate(previousProps: Readonly<SeasonCardProps>, previousState: Readonly<{}>): void {
        if (this.props.currTab !== previousProps.currTab || this.props.seasonEnd !== previousProps.seasonEnd) {
            clearInterval(this.timer);
            this.seasonTimer();
        }
    }

    componentWillUnmount(): void {
        if (this.timer) {
            clearInterval(this.timer);
        }
    }

    seasonTimer(): void {
        if (this.props.seasonEnd === -1) {
            this.setState({ time: -1 });
        } else {
            const targetEndTime = new Date().getTime() + this.props.seasonEnd * 1000;

            this.timer = setInterval(() => {
                const currentTime = new Date().getTime();
                const remainingTime = Math.max((targetEndTime as number - currentTime) / 1000, 0);

                this.setState({ time: remainingTime });

                if (remainingTime <= 0) {
                    clearInterval(this.timer);
                }
            }, 1000);
        }
    }

    shareOnTwitter = async (rank: number, tab: string) => {
        const leagueName = tab === 'alltime' ? 'All Time' : tab.charAt(0).toUpperCase() + tab.slice(1);
        const tweetText = `I'm ranked #${rank} in the ${leagueName} league in #Legion! Can you beat me? #PvP`
        const twitterUrl = `https://x.com/intent/post?text=${encodeURIComponent(tweetText)}`;
        const width = 550;
        const height = 300;
        const left = (window.innerWidth - width) / 2;
        const top = (window.innerHeight - height) / 2;

        window.open(
            twitterUrl,
            'Share on Twitter',
            `width=${width},height=${height},top=${top},left=${left}`
        );
    }

    render() {
        const eloBGStyle = {
            backgroundImage: `url(${eloRatingBg})`,
            transform: 'scale(1.2)',
        }

        const seasonBGStyle = {
            backgroundImage: `url(${recapBluebar})`,
            width: '100%',
            bottom: `${this.state.time === -1 ? '20px' : '36px'}`,
            padding: `${this.state.time === -1 ? '10px 8px' : '4px 8px'}`
        }

        const countDown = {
            day: Math.floor(Math.min(31, this.state.time / 86400)),
            hour: Math.floor(Math.min(23, (this.state.time % 86400) / 3600)),
            minute: Math.floor((this.state.time % 3600) / 60),
            second: Math.floor(this.state.time % 60)
        }; 

        // console.log("seasonCardPropsData => ", this.props); 

        const isAllTime = this.props.currTab === 'alltime';

        return (
            <div className="season-card-container">
                <div className="season-card-header">
                    <div className="season-card-header-img">
                        <img src={`/icons/${this.props.currTab}_rank.png`} />
                    </div> 
                    <div className="season-card-header-title">
                        <span>{this.props.currTab.toUpperCase()} </span> 
                        <span>LEAGUE</span>
                    </div>
                </div>
                <div className="season-card-body">
                    <div className="recap-single-container" ref={this.captureRef}>
                        <div className="season-recap">
                            <p className="season-recap-title">CURRENT</p>
                            <p className="season-recap-label">RANK</p>
                            <div className="season-recap-img" style={this.props.rankRowNumberStyle(this.props.playerRanking.rank)}>
                                <span>{this.props.playerRanking.rank}</span>
                            </div>
                        </div>
                        <div className="season-recap">
                            <p className="season-recap-title">{isAllTime ? 'ELO' : 'NB'}</p>
                            <p className="season-recap-label">{isAllTime ? 'RATING' : 'WINS'}</p>
                            <div className="season-recap-img" style={eloBGStyle}>
                                <span>{this.props.playerRanking.metric}</span>
                            </div>
                        </div>
                        <div className="season-recap">
                            <p className="season-recap-title">SEASON</p>
                            <p className="season-recap-label">ENDS IN</p>
                            <div className="recap-season-bg" style={seasonBGStyle}>
                                {this.state.time === -1 ? <img src="/rank/infinity_icon.png" alt="infinity" /> : (
                                    <div style={{ width: '100%' }}>
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
                                )}
                            </div>
                            {this.state.time !== -1 && <div><img src={cdIcon} alt="timer" className="season-timer-icon" /></div>}
                        </div>
                    </div>
                    <div className="season-share-button" onClick={() => this.shareOnTwitter(this.props.playerRanking.rank, this.props.currTab)}>
                        <img src={shareIcon} alt="" />
                        <span>SHARE</span>
                    </div>
                </div>
            </div>
        );
    }
}

export default SeasonCard;