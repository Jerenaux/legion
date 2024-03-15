import { h, Component } from 'preact';
import { io } from 'socket.io-client';
import { route } from 'preact-router';

import { getFirebaseIdToken } from '../services/apiService';

interface QPageProps {
    matches: {
      mode?: number;
    };
  }

/* eslint-disable react/prefer-stateless-function */
class QueuePage extends Component<QPageProps, {}> {
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

        this.socket.emit('joinQueue', {mode: this.props.matches.mode || 0});
        console.log('Joining queue');
    }

    componentDidMount() {
        this.joinQueue();
    }    

    render() {

        return (
            <div>
                Queuing...
            </div>
        );
    }
}

export default QueuePage;