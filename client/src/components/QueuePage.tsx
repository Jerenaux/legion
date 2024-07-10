import { h, Component } from 'preact';
import { io } from 'socket.io-client';
import { route } from 'preact-router';

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
  }


/* eslint-disable react/prefer-stateless-function */
class QueuePage extends Component<QPageProps, QpageState> { 
    constructor(props: QPageProps) {
        super(props); 
        this.state = {
            tipCount: 0, 
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

        this.socket.on('matchFound', ({gameId}) => {
            console.log(`Found game ${gameId}!`);
            route(`/game/${gameId}`);
        });

        this.socket.on('updateGold', ({gold}) => {
            console.log(`Received gold update: ${gold}`);
        });

        this.socket.on('queueData' , (data) => {
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
            console.log(data);
        });

        this.socket.emit('joinQueue', {mode: this.props.matches.mode || 0});
        console.log('Joining queue');
    }

    componentDidMount() {
        this.joinQueue();
    }    

    render() {

        return (
            <div className="queue-container">
                <div className="queue-body">
                    <div className="queue-info">
                        <div class="queue-spinner">
                            <div className="queue-spinner-loader"></div>
                        </div>
                        <div className="queue-count">
                            <div className="queue-count-box"> 
                                <div className="queue-count-number">
                                    107
                                </div>
                                <div className="queue-count-text">
                                    Queueing
                                </div>
                            </div>
                        </div>
                        <div className="queue-detail">
                            <div>
                                <div className="queue-detail-header">
                                    <div className="queue-detail-btn">
                                        Button 
                                    </div>
                                    <div className="queue-detail-btn active">
                                        Button
                                    </div>
                                </div>
                                <div className="queue-detail-body">
                                    <div>
                                        <div>FIRSTVALUE</div>
                                        <div>
                                            <div><img src="/gold_icon.png" /></div>
                                            <div><span style={{color: 'coral'}}>10</span>6/<span style={{color: 'deepskyblue'}}>30</span>&nbsp;Sec</div>
                                        </div>
                                    </div>
                                    <div>
                                        <div>SECOND</div>
                                        <div>
                                            <div><img src="/gold_icon.png" /></div>
                                            <div><span style={{color: 'coral'}}>30</span></div>
                                        </div>
                                    </div>
                                    <div>
                                        <div>THIRD</div>
                                        <div>
                                            <span style={{color: 'deepskyblue'}}>98</span>&nbsp;Secs
                                        </div>
                                    </div>
                                    <div>
                                        <div>FOURTH RATING</div>
                                        <div>
                                            <span style={{color: 'deepskyblue'}}>123</span>&nbsp;Secs
                                        </div>
                                    </div>
                                </div>
                                <div className="queue-detail-footer">
                                    <div className="queue-footer-exit">
                                        <img src="/queue/exit_icon.png" />
                                    </div>
                                    <div className="queue-footer-text">
                                        CANCEL QUEUE
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="queue-number">

                        </div>
                    </div>
                </div>
                
                <div className="queue-news">
                    <div className="queue-news-container">
                        <div class="queue-news-title">
                            <div><span style={{color: 'cyan'}}>News Title DELL</span></div>
                            <div><span style={{color: 'coral'}}>29 Apr 2024</span></div>
                        </div>
                        <div className="queue-news-content">
                            New versio of legion game will be launched soon! 
                            Expect great interface and wonderful game experience, excellent, fantastic, great!
                        </div>
                        <div className="queue-news-readmore">
                            READ MORE &nbsp;&nbsp; <span style={{color: 'coral'}}>▶</span>
                        </div>
                    </div>
                    <div className="queue-news-container">
                        <div class="queue-news-title">
                            <div><span style={{color: 'cyan'}}>News Title DELL</span></div>
                            <div><span style={{color: 'coral'}}>29 Apr 2024</span></div>
                        </div>
                        <div className="queue-news-content">
                            New versio of legion game will be launched soon! 
                            Expect great interface and wonderful game experience, excellent, fantastic, great!
                        </div>
                        <div className="queue-news-readmore">
                            READ MORE &nbsp;&nbsp; <span style={{color: 'coral'}}>▶</span>
                        </div>
                    </div>
                    <div className="queue-news-container">
                        <div class="queue-news-title">
                            <div><span style={{color: 'cyan'}}>News Title DELL</span></div>
                            <div><span style={{color: 'coral'}}>29 Apr 2024</span></div>
                        </div>
                        <div className="queue-news-content">
                            New versio of legion game will be launched soon! 
                            Expect great interface and wonderful game experience, excellent, fantastic, great!
                        </div>
                        <div className="queue-news-readmore">
                            READ MORE &nbsp;&nbsp; <span style={{color: 'coral'}}>▶</span>
                        </div>
                    </div>
                </div>

                <div className="queue-tips">
                    <div className="queue-tips-container">
                        <div>Tips</div>
                        <div>
                            <span style={{color: 'cyan'}}>
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
                    <div className="btn-x">
                        <img src="/queue/x_btn.png" />
                    </div>
                    <div className="btn-discord">
                        <img src="/queue/discord_btn.png" />
                    </div>
                </div>
            </div>
        );
    }
}

export default QueuePage;