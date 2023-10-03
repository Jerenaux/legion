// NotificationBar.tsx
import { h, Component } from 'preact';
import firebase from './firebaseConfig';

interface State {
    showNotifications: boolean;
    unreadNotifications: number;
    notifications: string[];
}

interface Props {
    initFirebaseUI: () => void;
    logout: () => void;
    user: firebase.User | null;
}

class NotificationBar extends Component<Props, State> {

    state: State = {
        showNotifications: false,
        unreadNotifications: 3,
        notifications: ['Notification 1', 'Notification 2', 'Notification 3']
    };

    handleNotificationClick = () => {
        this.setState(prevState => ({
            showNotifications: !prevState.showNotifications,
            unreadNotifications: 0
        }));
    };

    render() {
        const { unreadNotifications, showNotifications, notifications } = this.state;
        return (
            <div className="notificationBar">
                <div className="socials-bar">
                    <a href="https://twitter.com/iolegion" title="X/Twitter" target="_blank" rel="noopener noreferrer">
                        <div className="twitterIconContainer">
                            <i className="fa-brands fa-x-twitter"></i>
                        </div>
                    </a>
                </div>
                <div>
                    {this.props.user === null && <button onClick={this.props.initFirebaseUI}>Log in</button>}
                    {this.props.user !== null && <button onClick={this.props.logout}>Log out</button>}
      
                    {/* <div className="notificationBarButton" onClick={this.handleNotificationClick}>
                        <i className="fa-solid fa-bell">
                            {unreadNotifications > 0 && (
                                <span className="notificationBadge">{unreadNotifications}</span>
                            )}
                        </i>
                        {showNotifications && (
                            <div className="notificationList">
                                {notifications.map((notification, index) => (
                                    <div key={index} className="notificationItem">
                                        {notification}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="notificationBarButton">
                        <i className="fas fa-sign-out-alt"></i>
                    </div> */}
                </div>
            </div>
        );
    }
}

export default NotificationBar;