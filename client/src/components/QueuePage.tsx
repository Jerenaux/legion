import '../style/QueuePage.style.css';
import { h, Component } from 'preact';
import { io } from 'socket.io-client';
import { route } from 'preact-router';
import { Link, useRouter } from 'preact-router';
import Skeleton from 'react-loading-skeleton';

import { apiFetch, getFirebaseIdToken } from '../services/apiService';
import { ENABLE_APPROX_WT, ENABLE_MM_TOGGLE, ENABLE_Q_NEWS, DISCORD_LINK, X_LINK } from '@legion/shared/config';
import { tips } from './tips'
import { PlayerContext } from '../contexts/PlayerContext';
import { errorToast, playSoundEffect, silentErrorToast } from './utils';
import { QueueTips } from './queueTips/QueueTips';

import goldIcon from '@assets/gold_icon.png';
import exitIcon from '@assets/queue/exit_icon.png';
import discordIcon from '@assets/queue/discord_btn.png';
import xIcon from '@assets/queue/x_btn.png';
import blueTriangle from '@assets/queue/blue_triangle.png';
import matchFound from "@assets/sfx/match_found.wav";
import { PlayModeLabels, PlayMode } from '@legion/shared/enums';

interface QPageProps {
    matches: {
        mode?: number;
        id?: string;
    };
}

interface QueueData {
    goldRewardInterval: number;
    goldReward: number;
    estimatedWaitingTime: number;
    nbInQueue: number;
}

interface NewsItem {
    title: string;
    date: string;
    text: string;
    link: string;
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
    news: NewsItem[];
    newsLoaded: boolean;
    lobbyDetails: {
        type: string;
        opponentName: string | null;
    } | null;
}


/* eslint-disable react/prefer-stateless-function */
class QueuePage extends Component<QPageProps, QpageState> {
    static contextType = PlayerContext;
    interval = null;
    intervalWaited = null;
    socketRetryTimeout = null;
    socketRetryCount = 0;
    maxSocketRetries = 10;
    socketRetryDelay = 1000;

    validateMode() {
        const validModes = [
            PlayMode.PRACTICE,
            PlayMode.CASUAL,
            PlayMode.RANKED,
            PlayMode.STAKED
        ] as number[];
        
        const currentMode = Number(this.props.matches.mode);
        
        if (this.props.matches.id !== undefined) {
            return true;
        }

        if (isNaN(currentMode) || !validModes.includes(currentMode)) {
            silentErrorToast('Invalid play mode, please select a mode from the home page');
            return false;
        }
        
        return true;
    }

    constructor(props: QPageProps) {
        super(props);
        if (!this.validateMode()) {
            return;
        }
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
            },
            earnedGold: 0,
            queueDataLoaded: false,
            news: [], // Add this line
            newsLoaded: false, // Add this line
            lobbyDetails: null,
        };
    }

    setupSocketListeners = (socket) => {
        // Setup all game-related socket listeners
        socket.on('matchFound', ({ gameId }) => {
            console.log('matchFound', gameId);
            playSoundEffect(matchFound, 0.5);
            route(`/game/${gameId}`);
        });

        socket.on('updateGold', ({ gold }) => {
            this.context.setPlayerInfo({ 
                gold: this.context.player.gold + 1 
            });
        });

        socket.on('queueData', (data) => {
            this.setState({
                queueDataLoaded: true,
                queueData: { ...data }
            });
        });

        socket.on('queueCount', (data) => {
            this.setState({
                queueData: {
                    ...this.state.queueData,
                    nbInQueue: data.count
                }
            });
        });

        socket.on('lobbyJoined', (data) => {
            this.setState({
                lobbyDetails: {
                    type: data.type,
                    opponentName: data.opponentName
                }
            });
        });

        // Join queue or lobby
        const isLobbyMode = this.props.matches.id !== undefined;
        if (isLobbyMode) {
            socket.emit('joinLobby', { lobbyId: this.props.matches.id });
        } else {
            socket.emit('joinQueue', { mode: this.props.matches.mode || 0 });
        }
    }

    waitForSocket = () => {
        const { socket } = this.context;
        if (socket) {
            this.setupSocketListeners(socket);
            return;
        }

        if (this.socketRetryCount >= this.maxSocketRetries) {
            errorToast('Could not connect to matchmaker after multiple attempts. Please reload the page.');
            return;
        }

        this.socketRetryCount++;
        this.socketRetryTimeout = setTimeout(() => {
            this.waitForSocket();
        }, this.socketRetryDelay);
    }

    componentDidMount() {
        if (!this.validateMode()) {
            return;
        }

        this.loadNews();
        this.waitForSocket();

        // Setup other timers
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

    componentWillUnmount() {
        const { socket } = this.context;
        if (socket) {
            // Emit leaveQueue event before removing listeners
            socket.emit('leaveQueue');
            
            // Remove all game-related listeners
            socket.off('matchFound');
            socket.off('updateGold');
            socket.off('queueData');
            socket.off('queueCount');
            socket.off('lobbyJoined');
        }
        clearInterval(this.interval);
        clearInterval(this.intervalWaited);
        if (this.socketRetryTimeout) {
            clearTimeout(this.socketRetryTimeout);
        }
    }

    loadNews = async () => {
        try {
            const news = await apiFetch('getNews');
            this.setState({ news, newsLoaded: true });
        } catch (error) {
            console.error('Failed to load news:', error);
            this.setState({ newsLoaded: true });
        }
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

    handleQuickFind = () => {
        this.setState({ findState: 'quick' });
    }
    handleAccurateFind = () => {
        this.setState({ findState: 'accurate' });
    }

    render() {
        const { progress, queueData, news, newsLoaded } = this.state;
        const isLobbyMode = this.props.matches.id !== undefined;

        return (
            <div className="queue-container">
                <div className="queue-body">
                    {this.state.queueDataLoaded || isLobbyMode ? (
                        isLobbyMode ? (
                            <div className="queue-info lobby-mode">
                                <div className="queue-spinner-centered">
                                    <div className="queue-spinner-loader"></div>
                                </div>
                                {this.state.lobbyDetails && (
                                    <div className="queue-text">
                                        {this.state.lobbyDetails.type === 'friend' ? (
                                            `Waiting for ${this.state.lobbyDetails.opponentName} to join...`
                                        ) : (
                                            'Waiting for another player to join...'
                                        )}
                                    </div>
                                )}
                                <Link href="/play" className="cancel-game-link">
                                    <div className="queue-detail-footer centered">
                                        <div className="queue-footer-exit">
                                            <img src={exitIcon} alt="Exit" />
                                        </div>
                                        <div className="queue-footer-text">
                                            CANCEL GAME
                                        </div>
                                    </div>
                                </Link>
                            </div>
                        ) : (
                            // Render queue mode UI (existing code)
                            <div className="queue-info">
                                <div className="queue-spinner">
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
                                        {ENABLE_MM_TOGGLE && (
                                            <div className="queue-detail-header">
                                                <div
                                                    className={this.state.findState === 'quick' ? 'queue-detail-btn active' : 'queue-detail-btn'}
                                                    onClickCapture={this.handleQuickFind}
                                                >
                                                    Quick find
                                                </div>
                                                <div
                                                    className={this.state.findState === 'accurate' ? 'queue-detail-btn active' : 'queue-detail-btn'}
                                                    onClick={this.handleAccurateFind}
                                                >
                                                    Accurate find
                                                </div>
                                            </div>
                                        )}
                                        <div className="queue-detail-body">
                                            <div>
                                                <div>EARNINGS</div>
                                                <div>
                                                    <div><img src={goldIcon} /></div>
                                                    <div>
                                                        <span style={{ color: 'coral' }}>{queueData.goldReward}</span>/
                                                        <span style={{ color: 'deepskyblue' }}>{queueData.goldRewardInterval}</span>&nbsp;Sec
                                                    </div>
                                                </div>
                                            </div>
                                            <div>
                                                <div>EARNED</div>
                                                <div>
                                                    <div><img src={goldIcon} /></div>
                                                    <div><span style={{ color: 'coral' }}>{this.state.earnedGold}</span></div>
                                                </div>
                                            </div>
                                            <div>
                                                <div>WAITED</div>
                                                <div>
                                                    <span style={{ color: 'deepskyblue' }}>{this.state.waited}</span>&nbsp;Secs
                                                </div>
                                            </div>
                                            {ENABLE_APPROX_WT && (
                                                <div>
                                                    <div>APPROX WAITING TIME</div>
                                                    <div>
                                                        <span style={{ color: 'deepskyblue' }}>
                                                            {this.state.queueData.estimatedWaitingTime === -1 ? '?' : this.state.queueData.estimatedWaitingTime}
                                                        </span>&nbsp;
                                                        {this.state.queueData.estimatedWaitingTime === -1 ? '' : 'Secs'}
                                                    </div>
                                                </div>
                                            )}
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
                                <div className="queue-number"></div>
                                <div className="queue-text">
                                    Looking for a worthy opponent in {PlayModeLabels[this.props.matches.mode]} mode…
                                </div>
                            </div>
                        )
                    ) : (
                        // Skeleton loader
                        <Skeleton
                            height={350}
                            width={350}
                            count={1}
                            highlightColor="#0000004d"
                            baseColor="#0f1421"
                            circle={true}
                        />
                    )}
                </div>

                {ENABLE_Q_NEWS && (
                    <div className="queue-news">
                        {newsLoaded ? (
                            [...news].reverse().map((newsItem) => (
                                <div className="queue-news-container" key={newsItem.title}>
                                    <div className="queue-news-title">
                                        <div><span style={{ color: 'cyan' }}>{newsItem.title}</span></div>
                                        <div className="queue-news-date"><span style={{ color: 'coral' }}>{newsItem.date}</span></div>
                                    </div>
                                    <div className="queue-news-content">
                                        {newsItem.text}
                                    </div>
                                    <div
                                        className="queue-news-readmore"
                                        onClick={() => window.open(newsItem.link, '_blank')}
                                    >
                                        READ MORE &nbsp;&nbsp; <span style={{ color: 'coral' }}>▶</span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="queue-news-loading">
                                <Skeleton
                                    height={100}
                                    width={300}
                                    count={1}
                                    highlightColor="#0000004d"
                                    baseColor="#0f1421"
                                />
                            </div>
                        )}
                    </div>
                )}

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
            </div>
        );
    }

}

export default QueuePage;
