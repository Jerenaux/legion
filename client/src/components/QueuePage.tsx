import { h, Component } from 'preact';
import { io } from 'socket.io-client';

import { getFirebaseIdToken } from '../services/apiService';

/* eslint-disable react/prefer-stateless-function */
class QueuePage extends Component {
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
        this.socket.emit('joinQueue', {mode: 'casual'});
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