
import { h } from 'preact';
import '../style/QueuePage.style.css';
import { Component } from 'preact';
import { route } from 'preact-router';
import { Link, } from 'preact-router';
import Skeleton from 'react-loading-skeleton';

import { apiFetch, } from '../services/apiService';
import { ENABLE_APPROX_WT, ENABLE_MM_TOGGLE, ENABLE_Q_NEWS, DISCORD_LINK, X_LINK } from '@legion/shared/config';
import { tips } from './tips'
import { PlayerContext } from '../contexts/PlayerContext';
import { playSoundEffect, silentErrorToast } from './utils';
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
    statusMessage: string;
    statusIsError: boolean;
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
        ] as number[];

        const currentMode = Number(this.props.matches.mode);

        if (this.props.matches.id !== undefined) {
            return true;
        }

        if (Number.isNaN(currentMode) || !validModes.includes(currentMode)) {
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
            statusMessage: this.getPendingMessage(),
            statusIsError: false,
            lobbyDetails: null,
        };
    }

    getPendingMessage = () => {
        if (this.props.matches.id !== undefined) return 'Connecting to lobby…';
        if (Number(this.props.matches.mode) === PlayMode.PRACTICE) return 'Preparing your practice match…';
        return 'Connecting to matchmaking…';
    }

    startProgressTimer = (estimatedWaitingTime: number) => {
        clearInterval(this.interval);
        this.setState({ progress: 0 });
        if (!Number.isFinite(estimatedWaitingTime) || estimatedWaitingTime <= 0) return;

        this.interval = setInterval(() => {
            this.setState((prevState) => {
                const progress = Math.min(prevState.progress + 1, 100);
                if (progress === 100) clearInterval(this.interval);
                return { progress };
            });
        }, estimatedWaitingTime * 10);
    }

    joinMatchmaking = () => {
        const { socket } = this.context;
        if (!socket?.connected) return;

        this.setState({ statusMessage: this.getPendingMessage(), statusIsError: false });
        if (this.props.matches.id !== undefined) {
            socket.emit('joinLobby', { lobbyId: this.props.matches.id });
        } else {
            socket.emit('joinQueue', { mode: this.props.matches.mode || 0 });
        }
    }

    handleDisconnect = () => {
        clearInterval(this.interval);
        this.setState({
            progress: 0,
            queueDataLoaded: false,
            statusMessage: 'Connection lost. Reconnecting…',
            statusIsError: false,
        });
    }

    handleConnectError = (error?: Error) => {
        const sessionExpired = error?.message === 'Authentication failed';
        this.setState({
            queueDataLoaded: false,
            statusMessage: sessionExpired ? 'Your session expired. Restart Legion to reconnect.' : 'Could not connect. Retrying…',
            statusIsError: true,
        });
    }

    handleQueueError = (data?: { message?: string }) => {
        this.setState({
            queueDataLoaded: false,
            statusMessage: data?.message || 'Matchmaking is unavailable. Please try again.',
            statusIsError: true,
        });
    }

    setupSocketListeners = (socket) => {
        // Setup all game-related socket listeners
        socket.on('matchFound', ({ gameId }) => {
            console.log('matchFound', gameId);
            playSoundEffect(matchFound, 0.5);
            route(`/game/${gameId}`);
        });

        socket.on('updateGold', ({ gold }) => {
            const earnedGold = Number(gold) || 0;
            const gainedGold = Math.max(0, earnedGold - this.state.earnedGold);
            this.setState({ earnedGold });
            this.context.setPlayerInfo({
                gold: this.context.player.gold + gainedGold
            });
        });

        socket.on('queueData', (data) => {
            this.startProgressTimer(data.estimatedWaitingTime);
            this.setState({
                queueDataLoaded: true,
                queueData: { ...data },
                statusIsError: false,
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
                statusMessage: data.type === 'friend'
                    ? `Waiting for ${data.opponentName} to join…`
                    : 'Waiting for another player to join…',
                statusIsError: false,
                lobbyDetails: {
                    type: data.type,
                    opponentName: data.opponentName
                }
            });
        });

        socket.on('connect', this.joinMatchmaking);
        socket.on('disconnect', this.handleDisconnect);
        socket.on('connect_error', this.handleConnectError);
        socket.on('queueError', this.handleQueueError);
        socket.on('authError', this.handleQueueError);

        this.joinMatchmaking();
    }

    waitForSocket = () => {
        const { socket } = this.context;
        if (socket) {
            this.setupSocketListeners(socket);
            return;
        }

        if (this.socketRetryCount >= this.maxSocketRetries) {
            this.setState({
                statusMessage: 'Could not connect to matchmaking. Return to Play and try again.',
                statusIsError: true,
            });
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
            socket.off('connect', this.joinMatchmaking);
            socket.off('disconnect', this.handleDisconnect);
            socket.off('connect_error', this.handleConnectError);
            socket.off('queueError', this.handleQueueError);
            socket.off('authError', this.handleQueueError);
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

    renderPendingState = (isLobbyMode: boolean) => (
        <div className="queue-info lobby-mode">
            <div className="queue-spinner-centered" aria-hidden="true">
                <div className="queue-spinner-loader"></div>
            </div>
            <div
                className={`queue-text${this.state.statusIsError ? ' queue-text-error' : ''}`}
                role="status"
                aria-live="polite"
            >
                {this.state.statusMessage}
            </div>
            <Link href="/play" className="cancel-game-link">
                <div className="queue-detail-footer centered">
                    <div className="queue-footer-exit">
                        <img src={exitIcon} alt="Exit" />
                    </div>
                    <div className="queue-footer-text">
                        {isLobbyMode ? 'CANCEL GAME' : 'BACK TO PLAY'}
                    </div>
                </div>
            </Link>
        </div>
    )

    render() {
        const { progress, queueData, news, newsLoaded } = this.state;
        const isLobbyMode = this.props.matches.id !== undefined;

        return (
            <div className="queue-container">
                <div className="queue-body">
                    {this.state.queueDataLoaded || isLobbyMode ? (
                        isLobbyMode ? this.renderPendingState(isLobbyMode) : (
                        // Render queue mode UI
                        <div className="queue-info">
                            <div className="queue-spinner" aria-hidden="true">
                                <div className="queue-spinner-loader"></div>
                            </div>
                            <div className="queue-count">
                                <div
                                    role="progressbar"
                                    aria-label="Estimated matchmaking wait progress"
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                    aria-valuenow={progress}
                                    style={`--value: ${progress}`}
                                >
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
                                            <button type="button" data-game-control
                                                className={this.state.findState === 'quick' ? 'queue-detail-btn active' : 'queue-detail-btn'}
                                                onClickCapture={this.handleQuickFind}
                                            >
                                                Quick find
                                            </button>
                                            <button type="button" data-game-control
                                                className={this.state.findState === 'accurate' ? 'queue-detail-btn active' : 'queue-detail-btn'}
                                                onClick={this.handleAccurateFind}
                                            >
                                                Accurate find
                                            </button>
                                        </div>
                                    )}
                                    <div className="queue-detail-body">
                                        <div>
                                            <div>EARNINGS</div>
                                            <div>
                                                <div><img src={goldIcon} alt="" /></div>
                                                <div>
                                                    <span style={{ color: 'coral' }}>{queueData.goldReward}</span>/
                                                    <span style={{ color: 'deepskyblue' }}>{queueData.goldRewardInterval}</span>&nbsp;Sec
                                                </div>
                                            </div>
                                        </div>
                                        <div>
                                            <div>EARNED</div>
                                            <div>
                                                <div><img src={goldIcon} alt="" /></div>
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
                                                <img src={exitIcon} alt="" />
                                            </div>
                                            <div className="queue-footer-text">
                                                LEAVE QUEUE
                                            </div>
                                        </div>
                                    </Link>
                                    <div className="queue-detail-arrow">
                                        <img src={blueTriangle} alt="" />
                                    </div>
                                </div>
                            </div>
                            <div className="queue-number"></div>
                            <div className="queue-text" role="status">
                                Looking for a worthy opponent in {PlayModeLabels[this.props.matches.mode]} mode…
                            </div>
                        </div>
                        )
                    ) : this.renderPendingState(isLobbyMode)}
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
                                    <button type="button" data-game-control
                                        className="queue-news-readmore"
                                        onClick={() => window.open(newsItem.link, '_blank')}
                                    >
                                        READ MORE &nbsp;&nbsp; <span style={{ color: 'coral' }}>▶</span>
                                    </button>
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
                            <img src={xIcon} alt="X" />
                        </div>
                    </Link>
                    <Link href={DISCORD_LINK} target="_blank">
                        <div className="btn-discord">
                            <img src={discordIcon} alt="Discord" />
                        </div>
                    </Link>
                </div>
            </div>
        );
    }

}

export default QueuePage;
