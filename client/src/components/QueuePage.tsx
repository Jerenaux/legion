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

interface QpageState {
    tipCount: number;
    progress: number;
    findState: string;
    waited: number;
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
        };
    }

    prevTip = () => {
        this.setState((prevState) => ({
            tipCount: (prevState.tipCount - 1 + tips.length) % tips.length
        }));
    }

    nextTip = () => {
        this.setState((prevState) => ({
            tipCount: (prevState.tipCount + 1 + tips.length) % tips.length
        }));
    }

    socket;

    joinQueue = async () => {
        console.log(`Connecting to ${process.env.MATCHMAKER_URL}`);
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
            route(`/game/${gameId}`);
        });

        this.socket.on('updateGold', ({ gold }) => {
            console.log(`Received gold update: ${gold}`);
        });

        this.socket.on('queueData', (data) => {
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
            //             text: "New versio of legion game will be launched soon! Expect great interface and wonderful game experience, excellent, ",
            //             link: "https://www.google.com"
            //         },
            //         {
            //             title: "Title",
            //             date: "2022-12-01",
            //             text: "New versio of legion game will be launched soon! Expect great interface and wonderful game experience, excellent, ",
            //             link: "https://www.google.com"
            //         },
            //         {
            //             title: "Title",
            //             date: "2022-12-01",
            //             text: "New versio of legion game will be launched soon! Expect great interface and wonderful game experience, excellent, ",
            //             link: "https://www.google.com"
            //         }
            //     ]
            // }
            console.log('data -> ', data);
        });

        // this.socket.emit('joinQueue', { mode: this.props.matches.mode || 0 });
        console.log('Joining queue');
    }

    handleQuickFind = () => {
        this.setState({ findState: 'quick' });
    }
    handleAccurateFind = () => {
        this.setState({ findState: 'accurate' });
    }

    componentDidMount() {
        this.joinQueue();
        this.interval = setInterval(() => {
            // console.log('state -> ', this.state.progress);
            this.setState((prevState) => ({
                progress: prevState.progress + 1,
            }));
            if (this.state.progress == 100) {
                clearInterval(this.interval);
            }
        }, 50);
        this.intervalWaited = setInterval(() => {
            this.setState((prevState) => ({
                waited: prevState.waited + 1,
            }))
        }, 1000);
    }

    componentWillMount() {
        clearInterval(this.interval);
        clearInterval(this.intervalWaited);
    }

    render() {
        const { progress } = this.state;
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
                                        107
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
                                            <div><span style={{ color: 'coral' }}>10</span>/<span style={{ color: 'deepskyblue' }}>30</span>&nbsp;Sec</div>
                                        </div>
                                    </div>
                                    <div>
                                        <div>EARNED</div>
                                        <div>
                                            <div><img src="/gold_icon.png" /></div>
                                            <div><span style={{ color: 'coral' }}>30</span></div>
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
                                            <span style={{ color: 'deepskyblue' }}>123</span>&nbsp;Secs
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
                            Waiting for players in casual mode…
                        </div>
                    </div>
                </div>

                <div className="queue-news">
                    <div className="queue-news-container">
                        <div class="queue-news-title">
                            <div><span style={{ color: 'cyan' }}>News Title</span></div>
                            <div><span style={{ color: 'coral' }}>29 Apr 2024</span></div>
                        </div>
                        <div className="queue-news-content">
                            New version of legion game will be launched soon!
                            Expect great interface and wonderful game experience, excellent, fantastic, great!
                        </div>
                        <div className="queue-news-readmore">
                            READ MORE &nbsp;&nbsp; <span style={{ color: 'coral' }}>▶</span>
                        </div>
                    </div>
                    <div className="queue-news-container">
                        <div class="queue-news-title">
                            <div><span style={{ color: 'cyan' }}>News Title</span></div>
                            <div><span style={{ color: 'coral' }}>29 Apr 2024</span></div>
                        </div>
                        <div className="queue-news-content">
                            New version of legion game will be launched soon!
                            Expect great interface and wonderful game experience, excellent, fantastic, great!
                        </div>
                        <div className="queue-news-readmore">
                            READ MORE &nbsp;&nbsp; <span style={{ color: 'coral' }}>▶</span>
                        </div>
                    </div>
                    <div className="queue-news-container">
                        <div class="queue-news-title">
                            <div><span style={{ color: 'cyan' }}>News Title</span></div>
                            <div><span style={{ color: 'coral' }}>29 Apr 2024</span></div>
                        </div>
                        <div className="queue-news-content">
                            New version of legion game will be launched soon!
                            Expect great interface and wonderful game experience, excellent, fantastic, great!
                        </div>
                        <div className="queue-news-readmore">
                            READ MORE &nbsp;&nbsp; <span style={{ color: 'coral' }}>▶</span>
                        </div>
                    </div>
                </div>

                <div className="queue-tips">
                    <div className="queue-tips-container">
                        <div>Tips</div>
                        <div>
                            <span style={{ color: 'cyan' }}>
                                {tips[this.state.tipCount]}
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

export default QueuePage;