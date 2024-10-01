import { h, Component } from 'preact';
import { io } from 'socket.io-client';
import { route } from 'preact-router';
import { Link, useRouter } from 'preact-router';
import Skeleton from 'react-loading-skeleton';

import { getFirebaseIdToken } from '../services/apiService';
import { ENABLE_APPROX_WT, ENABLE_MM_TOGGLE, ENABLE_Q_NEWS, DISCORD_LINK, X_LINK } from '@legion/shared/config';
import { tips } from './tips'
import { PlayerContext } from '../contexts/PlayerContext';
import { errorToast } from './utils';
import { QueueTips } from './queueTips/QueueTips';

import goldIcon from '@assets/gold_icon.png';
import exitIcon from '@assets/queue/exit_icon.png';
import discordIcon from '@assets/queue/discord_btn.png';
import xIcon from '@assets/queue/x_btn.png';
import blueTriangle from '@assets/queue/blue_triangle.png';

interface QPageProps {
    matches: {
        mode?: number;
    };
}

const playModes = ['practice', 'casual', 'ranked'];

interface QueueData {
    goldRewardInterval: number;
    goldReward: number;
    estimatedWaitingTime: number;
    nbInQueue: number;
    news: {
        title: string;
        date: string;
        text: string;
        link: string;
    }[];
}

interface QpageState {
    tipCount: number;
    progress: number;
    findState: string;
    waited: number;
    tips: string[];
    queueData: QueueData;
    earnedGold: number;
    queueDataLoaded: boolean;
}


/* eslint-disable react/prefer-stateless-function */
class QueuePage extends Component<QPageProps, QpageState> {
    static contextType = PlayerContext; 
    interval = null;
    intervalWaited = null;
    manualDisconnect = false;

    constructor(props: QPageProps) {
        super(props);
        this.state = {
            tipCount: 0,
            progress: 0,
            findState: 'quick',
            waited: 0,
            // Shuffle tips
            tips: tips.sort(() => Math.random() - 0.5),
            queueData: {
                goldRewardInterval: 0,
                goldReward: 0,
                estimatedWaitingTime: -1,
                nbInQueue: 0,
                news: [],
            },
            earnedGold: 0,
            queueDataLoaded: false,
        };
    }

    componentDidMount() {
        this.joinQueue();
        let timeInterval = this.state.queueData.estimatedWaitingTime * 10;
        if (this.state.queueData.estimatedWaitingTime != -1) {
            this.interval = setInterval(() => {
                this.setState((prevState) => ({
                    progress: prevState.progress + 1,
                }));
                if (this.state.progress == 100) {
                    clearInterval(this.interval);
                }
            }, timeInterval);
        }
        this.intervalWaited = setInterval(() => {
            this.setState((prevState) => ({
                waited: prevState.waited + 1,
            }))
        }, 1000);
    }

    // componentWillMount() {
    //     this.joinQueue();
    // }

    componentWillUnmount() {
        if (this.socket) {
            this.manualDisconnect = true;
            this.socket.disconnect();
        }
        clearInterval(this.interval);
        clearInterval(this.intervalWaited);
    }

    prevTip = () => {
        let len = this.state.tips.length;
        this.setState((prevState) => ({
            tipCount: (prevState.tipCount - 1 + len) % len
        }));
    }

    nextTip = () => {
        let len = this.state.tips.length;
        this.setState((prevState) => ({
            tipCount: (prevState.tipCount + 1 + len) % len
        }));
    }

    socket;

    joinQueue = async () => {
        console.log(`Connecting to ${process.env.MATCHMAKER_URL} ...`);
        this.socket = io(
            process.env.MATCHMAKER_URL,
            {
                auth: {
                    token: await getFirebaseIdToken()
                }
            }
        );

        this.socket.on('matchFound', ({ gameId }) => {
            console.log(`Found game ${gameId}!`);
            this.manualDisconnect = true;
            this.socket.disconnect();
            route(`/game/${gameId}`);
        });

        this.socket.on('updateGold', ({ gold }) => {
            this.setState({ earnedGold: gold });
            this.context.setPlayerInfo({ gold: this.context.player.gold + 1 });
            console.log(`Received gold update: ${gold}`);
        });

        this.socket.on('queueData', (data) => {
            this.setState({ 
                queueDataLoaded: true,
                queueData: { ...data }
            });
        });

        this.socket.on('queueCount', (data) => {
            this.setState({
                queueData: {
                    ...this.state.queueData,
                    nbInQueue: data.count
                }
            });
        });

        this.socket.emit('joinQueue', { mode: this.props.matches.mode || 0 });

        // this.socket.on('disconnect', () => {
        //     if (!this.manualDisconnect) {
        //         errorToast('Disconnected from server, pleae refresh the page');
        //     }
        // });

        this.socket.on('error', (e) => {
            errorToast(e);
        });
    }

    handleQuickFind = () => {
        this.setState({ findState: 'quick' });
    }
    handleAccurateFind = () => {
        this.setState({ findState: 'accurate' });
    }

    render() {
        const { progress, queueData } = this.state;
        return (
            <div className="queue-container">
                <div className="queue-body">
                    {this.state.queueDataLoaded ? (<div className="queue-info">
                        <div class="queue-spinner">
                            <div className="queue-spinner-loader"></div>
                        </div>
                        <div className="queue-count">
                            <div role="progressbar" style={`--value: ${progress}`}>
                                <div>
                                    <div className="queue-count-number">
                                        {queueData.nbInQueue}
                                    </div>
                                    <div className="queue-count-text">
                                        Queueing
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="queue-detail">
                            <div>
                                {ENABLE_MM_TOGGLE && <div className="queue-detail-header">
                                    <div
                                        className={this.state.findState == 'quick' ? 'queue-detail-btn active' : 'queue-detail-btn'}
                                        onClickCapture={this.handleQuickFind}
                                    >
                                        Quick find
                                    </div>
                                    <div
                                        className={this.state.findState == 'accurate' ? 'queue-detail-btn active' : 'queue-detail-btn'}
                                        onClick={this.handleAccurateFind}
                                    >
                                        Accurate find
                                    </div>
                                </div>}
                                <div className="queue-detail-body">
                                    <div>
                                        <div>EARNINGS</div>
                                        <div>
                                            <div><img src={goldIcon} /></div>
                                            <div><span style={{ color: 'coral' }}>{queueData.goldReward}</span>/<span style={{ color: 'deepskyblue' }}>{queueData.goldRewardInterval}</span>&nbsp;Sec</div>
                                        </div>
                                    </div>
                                    <div>
                                        <div>EARNED</div>
                                        <div>
                                            <div><img src={goldIcon}/></div>
                                            <div><span style={{ color: 'coral' }}>{this.state.earnedGold}</span></div>
                                        </div>
                                    </div>
                                    <div>
                                        <div>WAITED</div>
                                        <div>
                                            <span style={{ color: 'deepskyblue' }}>{this.state.waited}</span>&nbsp;Secs
                                        </div>
                                    </div>
                                    {ENABLE_APPROX_WT && <div>
                                        <div>APPROX WAITING TIME</div>
                                        <div>
                                            <span style={{ color: 'deepskyblue' }}>{this.state.queueData.estimatedWaitingTime == -1 ? '?' : this.state.queueData.estimatedWaitingTime}</span>&nbsp;
                                            {this.state.queueData.estimatedWaitingTime == -1 ? '' : 'Secs'}
                                        </div>
                                    </div>}
                                </div>

                                <Link href="/play">
                                    <div className="queue-detail-footer">
                                        <div className="queue-footer-exit">
                                            <img src={exitIcon} />
                                        </div>
                                        <div className="queue-footer-text">
                                            LEAVE QUEUE
                                        </div>
                                    </div>
                                </Link>
                                <div className="queue-detail-arrow">
                                    <img src={blueTriangle} />
                                </div>
                            </div>
                        </div>
                        <div className="queue-number">

                        </div>
                        <div className="queue-text">
                            Waiting for players in {playModes[this.props.matches.mode]} mode…
                        </div>
                    </div>) : (
                        <Skeleton
                            height={350}
                            width={350}
                            count={1}
                            highlightColor='#0000004d'
                            baseColor='#0f1421'
                            circle={true}
                        />
                    )}
                </div>

                {ENABLE_Q_NEWS && <div className="queue-news">
                    {queueData.news.map(newsItem => (
                        <div className="queue-news-container">
                            <div class="queue-news-title">
                                <div><span style={{ color: 'cyan' }}>{newsItem.title}</span></div>
                                <div class='queue-news-date'><span style={{ color: 'coral' }}>{newsItem.date}</span></div>
                            </div>
                            <div className="queue-news-content">
                                {newsItem.text}
                            </div>
                            <div className="queue-news-readmore"  onClick={() => window.open(newsItem.link, '_blank')}>
                                READ MORE &nbsp;&nbsp; <span style={{ color: 'coral' }}>▶</span>
                            </div>
                        </div>
                    ))}
                </div>}

                <QueueTips />

                <div className="queue-btns">
                    <Link href={X_LINK} target="_blank">
                        <div className="btn-x">
                            <img src={xIcon} />
                        </div>
                    </Link>
                    <Link href={DISCORD_LINK} target="_blank">
                        <div className="btn-discord">
                            <img src={discordIcon} />
                        </div>
                    </Link>
                </div>
            </div >
        );
    }
}

export default QueuePage;