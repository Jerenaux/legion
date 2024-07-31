import { h, Component, ErrorInfo } from 'preact';
import { io } from 'socket.io-client';
import { route } from 'preact-router';
import { Link, useRouter } from 'preact-router';

import { getFirebaseIdToken } from '../services/apiService';

interface QPageProps {
    matches: {
        mode?: number;
    };
}


const tips = [
    "To have data to use in the UI, use the Log In button and create an account, which will create a user in the Firestore database.",
    "New version of legion game will be launched soon! Expect great interface and wonderful game experience, excellent, fantastic, great! New versio of legion game will be launched soon! Expect great interface and wonderful game experience, excellent, fantastic, great!",
    "Event handlers have access to the event that triggered the function.",
]

const playModes = ['practice', 'casual', 'ranked'];

interface QueueData {
    goldRewardInterval: number;
    goldReward: number;
    estimatedWaitingTime: number;
    nbInQueue: number;
    tips: string[];
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
    queueData: QueueData;
    earnedGold: number;
    queueDataLoaded: boolean;
}


/* eslint-disable react/prefer-stateless-function */
class QueuePage extends Component<QPageProps, QpageState> {
    interval = null;
    intervalWaited = null;
    constructor(props: QPageProps) {
        super(props);
        this.state = {
            tipCount: 0,
            progress: 0,
            findState: 'quick',
            waited: 0,
            queueData: {
                goldRewardInterval: 0,
                goldReward: 0,
                estimatedWaitingTime: -1,
                nbInQueue: 0, // countQueuingPlayers(player.mode, player.league),
                tips: [
                    "o have data to use in the UI, use the Log In button and create an account, which will create a user in the Firestore database.",
                    "New version of legion game will be launched soon! Expect great interface and wonderful game experience, excellent, fantastic, great! New versio of legion game will be launched soon! Expect great interface and wonderful game experience, excellent, fantastic, great!",
                    "Event handlers have access to the event that triggered the function."
                ],
                news: [
                    {
                        title: "Title",
                        date: "2022-12-01",
                        text: "New versio of legion game will be launched soon! Expect great interface and wonderful game experience, excellent, wonderful!",
                        link: "https://www.google.com"
                    },
                    {
                        title: "Title",
                        date: "2022-12-01",
                        text: "New versio of legion game will be launched soon! Expect great interface and wonderful game experience, excellent, wonderful!",
                        link: "https://www.google.com"
                    },
                    {
                        title: "Title",
                        date: "2022-12-01",
                        text: "New versio of legion game will be launched soon! Expect great interface and wonderful game experience, excellent, wonderful!",
                        link: "https://www.google.com"
                    }
                ]
            },
            earnedGold: 0,
            queueDataLoaded: false,
        };
    }

    prevTip = () => {
        let len = this.state.queueData.tips.length;
        this.setState((prevState) => ({
            tipCount: (prevState.tipCount - 1 + len) % len
        }));
    }

    nextTip = () => {
        let len = this.state.queueData.tips.length;
        this.setState((prevState) => ({
            tipCount: (prevState.tipCount + 1 + len) % len
        }));
    }

    socket;

    joinQueue = async () => {
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
            this.socket.disconnect();
            route(`/game/${gameId}`);
        });

        this.socket.on('updateGold', ({ gold }) => {
            this.setState({ earnedGold: gold });
            console.log(`Received gold update: ${gold}`);
        });

        this.socket.on('queueData', (data) => {

            // console.log('data ', data);

            this.setState({ queueDataLoaded: true });
            this.setState({ queueData: { ...data } });

            // {
            //     goldRewardInterval,
            //     goldReward,
            //     estimatedWaitingTime: -1,
            //     nbInQueue: countQueuingPlayers(player.mode, player.league),
            //     tips: [
            //         "o have data to use in the UI, use the Log In button and create an account, which will create a user in the Firestore database.",
            //         "New version of legion game will be launched soon! Expect great interface and wonderful game experience, excellent, fantastic, great! New versio of legion game will be launched soon! Expect great interface and wonderful game experience, excellent, fantastic, great!",
            //         "Event handlers have access to the event that triggered the function."
            //     ],
            //     news: [
            //         {
            //             title: "Title",
            //             date: "2022-12-01",
            //             text: "New version of legion game will be launched soon! Expect great interface and wonderful game experience, excellent, ",
            //             link: "https://www.google.com"
            //         },
            //         {
            //             title: "Title",
            //             date: "2022-12-01",
            //             text: "New version of legion game will be launched soon! Expect great interface and wonderful game experience, excellent, ",
            //             link: "https://www.google.com"
            //         },
            //         {
            //             title: "Title",
            //             date: "2022-12-01",
            //             text: "New version of legion game will be launched soon! Expect great interface and wonderful game experience, excellent, ",
            //             link: "https://www.google.com"
            //         }
            //     ]
            // }
        });

        this.socket.emit('joinQueue', { mode: this.props.matches.mode || 0 });
        console.log('Joining queue');
    }

    handleQuickFind = () => {
        this.setState({ findState: 'quick' });
    }
    handleAccurateFind = () => {
        this.setState({ findState: 'accurate' });
    }

    componentDidMount() {
        // this.joinQueue(); 
        // if(!this.state.queueDataLoaded) {

        // }
        let timeInterval = this.state.queueData.estimatedWaitingTime * 10;
        if (this.state.queueData.estimatedWaitingTime != -1) {
            this.interval = setInterval(() => {
                // console.log('state ', this.state.progress);
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

    componentWillMount() {
        this.joinQueue();
        clearInterval(this.interval);
        clearInterval(this.intervalWaited);
    }

    componentWillUnmount() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }

    render() {
        const { progress, queueData } = this.state;
        if (!this.state.queueDataLoaded) {
            return (
                <div></div>
            );
        } else {
            return (
                <div className="queue-container">
                    <div className="queue-body">
                        <div className="queue-info">
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
                                    <div className="queue-detail-header">
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
                                    </div>
                                    <div className="queue-detail-body">
                                        <div>
                                            <div>EARNINGS</div>
                                            <div>
                                                <div><img src="/gold_icon.png" /></div>
                                                <div><span style={{ color: 'coral' }}>{queueData.goldReward}</span>/<span style={{ color: 'deepskyblue' }}>{queueData.goldRewardInterval}</span>&nbsp;Sec</div>
                                            </div>
                                        </div>
                                        <div>
                                            <div>EARNED</div>
                                            <div>
                                                <div><img src="/gold_icon.png" /></div>
                                                <div><span style={{ color: 'coral' }}>{this.state.earnedGold}</span></div>
                                            </div>
                                        </div>
                                        <div>
                                            <div>WAITED</div>
                                            <div>
                                                <span style={{ color: 'deepskyblue' }}>{this.state.waited}</span>&nbsp;Secs
                                            </div>
                                        </div>
                                        <div>
                                            <div>APPROX WAITING TIME</div>
                                            <div>
                                                <span style={{ color: 'deepskyblue' }}>{this.state.queueData.estimatedWaitingTime == -1 ? '?' : this.state.queueData.estimatedWaitingTime}</span>&nbsp;
                                                {this.state.queueData.estimatedWaitingTime == -1 ? '' : 'Secs'}
                                            </div>
                                        </div>
                                    </div>

                                    <Link href="/play">
                                        <div className="queue-detail-footer">
                                            <div className="queue-footer-exit">
                                                <img src="/queue/exit_icon.png" />
                                            </div>
                                            <div className="queue-footer-text">
                                                CANCEL QUEUE
                                            </div>
                                        </div>
                                    </Link>
                                    <div className="queue-detail-arrow">
                                        <img src="/queue/blue_triangle.png" />
                                    </div>
                                </div>
                            </div>
                            <div className="queue-number">

                            </div>
                            <div className="queue-text">
                                Waiting for players in {playModes[this.props.matches.mode]} mode…
                            </div>
                        </div>
                    </div>

                    <div className="queue-news">
                        {queueData.news.map(newsItem => (
                            <div className="queue-news-container">
                                <div class="queue-news-title">
                                    <div><span style={{ color: 'cyan' }}>{newsItem.title}</span></div>
                                    <div><span style={{ color: 'coral' }}>{newsItem.date}</span></div>
                                </div>
                                <div className="queue-news-content">
                                    {newsItem.text}
                                </div>
                                <div className="queue-news-readmore">
                                    READ MORE &nbsp;&nbsp; <span style={{ color: 'coral' }}>▶</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="queue-tips">
                        <div className="queue-tips-container">
                            <div>Tips</div>
                            <div>
                                <span style={{ color: 'cyan' }}>
                                    {queueData.tips[this.state.tipCount]}
                                </span>
                            </div>
                        </div>
                        <div onClick={this.prevTip} className="queue-tips-arrow prev">
                            ◀
                        </div>
                        <div onClick={this.nextTip} className="queue-tips-arrow next">
                            ▶
                        </div>
                    </div>
                    <div className="queue-btns">
                        <Link href="https://x.com/iolegion" target="_blank">
                            <div className="btn-x">
                                <img src="/queue/x_btn.png" />
                            </div>
                        </Link>
                        <Link href="">
                            <div className="btn-discord">
                                <img src="/queue/discord_btn.png" />
                            </div>
                        </Link>
                    </div>
                </div >
            );
        }
    }
}

export default QueuePage;