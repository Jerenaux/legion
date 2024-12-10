import { h, Component, Fragment } from 'preact';
import { avatarContext, getLeagueIcon, successToast } from '../utils';
import { LeaguesNames } from '@legion/shared/enums';
import { PlayerContext } from '../../contexts/PlayerContext';
import './profile.style.css';
import SearchPlayers from './SearchPlayers';
import { route } from 'preact-router';

interface Props {
    id: string;
}

interface State {
    profileData: any;
    isLoading: boolean;
    error: string | null;
    avatarUrl: string | null;
    isAddingFriend: boolean;
    playerStatus: {
        status: string;
        gameId?: string;
    };
    friendStatuses: {
        [key: string]: {
            status: string;
            gameId?: string;
        };
    };
    socketReady: boolean;
}

class Profile extends Component<Props, State> {
    static contextType = PlayerContext;

    private statusInterval: NodeJS.Timeout | null = null;

    state: State = {
        profileData: null,
        isLoading: true,
        error: null,
        avatarUrl: null,
        isAddingFriend: false,
        playerStatus: { status: 'offline' },
        friendStatuses: {},
        socketReady: false,
    };

    async componentDidMount() {
        await this.loadProfileData();
        this.setupStatusTracking();
    }

    async componentDidUpdate(prevProps: Props, prevState: State) {
        if (prevProps.id !== this.props.id) {
            await this.loadProfileData();
            this.setupStatusTracking();
        }

        const { socket } = this.context;
        if (!prevState.socketReady && socket) {
            this.setState({ socketReady: true }, () => {
                console.log('Socket ready, setting up status tracking');
                this.setupStatusTracking();
            });
        }
    }

    componentWillUnmount() {
        if (this.statusInterval) {
            clearInterval(this.statusInterval);
        }
    }

    loadProfileData = async () => {
        this.setState({ isLoading: true, error: null });
        try {
            const response = await fetch(`${process.env.API_URL}/getProfileData?playerId=${this.props.id}`);
            if (!response.ok) {
                throw new Error('Failed to fetch profile data');
            }
            const profileData = await response.json();
            
            // Load avatar
            if (profileData.avatar !== '0') {
                try {
                    const avatarUrl = avatarContext(`./${profileData.avatar}.png`);
                    this.setState({ avatarUrl });
                } catch (error) {
                    console.error(`Failed to load avatar: ${profileData.avatar}.png`, error);
                }
            }

            this.setState({ profileData, isLoading: false });
        } catch (error) {
            console.error('Error loading profile:', error);
            this.setState({ 
                error: 'Failed to load profile data', 
                isLoading: false 
            });
        }
    };

    formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    formatNumber = (number: number) => {
        return new Intl.NumberFormat('en-US', {
            maximumFractionDigits: 1
        }).format(number);
    };

    isOwnProfile = () => {
        return this.props.id === this.context.player.uid;
    };

    handleAddFriend = async () => {
        this.setState({ isAddingFriend: true });
        try {
            await this.context.addFriend(this.props.id);
            successToast('Friend added successfully!');
        } catch (error) {
            console.error('Error adding friend:', error);
        } finally {
            this.setState({ isAddingFriend: false });
        }
    };

    isAlreadyFriend = () => {
        return this.context.friends.some(friend => friend.id === this.props.id);
    };

    setupStatusTracking = () => {
        const { socket } = this.context;
        if (!socket) {
            console.log('Socket not ready, skipping status tracking setup');
            return;
        };

        // Clear existing interval if any
        if (this.statusInterval) {
            clearInterval(this.statusInterval);
        }

        const fetchStatuses = () => {
            if (this.isOwnProfile()) {
                // Get all friends' statuses
                const friendIds = this.context.friends.map(friend => friend.id);
                if (friendIds.length > 0) {
                    socket.emit('getFriendsStatuses', { friendIds });
                }
            } else {
                console.log('Getting player status for', this.props.id);
                // Get single player status
                socket.emit('getPlayerStatus', { playerId: this.props.id });
            }
        };

        // Set up socket listeners
        socket.off('playerStatus').on('playerStatus', (statusInfo) => {
            console.log('Received status update:', statusInfo);
            this.setState({ playerStatus: statusInfo });
        });

        socket.off('friendsStatuses').on('friendsStatuses', (statuses) => {
            console.log('Received friends statuses:', statuses);
            this.setState({ friendStatuses: statuses });
        });

        // Initial fetch
        fetchStatuses();

        // Set up interval for periodic updates
        this.statusInterval = setInterval(fetchStatuses, 5000);
    }

    renderPlayerStatus = (status: string, gameId?: string) => {
        return (
            <>
                <div className={`status-dot ${status}`} />
                {/* {status === 'ingame' && gameId && (
                    <div 
                        className="spectate-badge"
                        onClick={(e) => {
                            e.stopPropagation();
                            route(`/game/${gameId}`);
                        }}
                    >
                        Spectate
                    </div>
                )} */}
            </>
        );
    }

    renderStatusBox = () => {
        if (this.isOwnProfile()) return null;

        const status = this.state.playerStatus.status;
        const gameId = this.state.playerStatus.gameId;
        
        let statusMessage = '';
        let showChallengeButton = false;

        switch(status) {
            case 'online':
                statusMessage = `${this.state.profileData.name} is ready to play!`;
                showChallengeButton = true;
                break;
            case 'offline':
                statusMessage = `${this.state.profileData.name} is currently offline`;
                break;
            case 'queuing':
                statusMessage = `${this.state.profileData.name} is currently queuing`;
                break;
            case 'ingame':
                statusMessage = `${this.state.profileData.name} is currently in a game`;
                break;
        }

        return (
            <div className={`player-status-box ${status}`}>
                <div className="status-text">
                    <div className={`status-dot ${status}`} />
                    <span className="status-message">{statusMessage}</span>
                </div>
                {showChallengeButton && (
                    <button 
                        className="challenge-button"
                        onClick={() => {
                            // TODO: Implement challenge functionality
                            console.log('Challenge clicked');
                        }}
                    >
                        Challenge to a Duel
                    </button>
                )}
            </div>
        );
    }

    render() {
        const { profileData, isLoading, error, avatarUrl } = this.state;
        const isOwnProfile = this.isOwnProfile();

        if (isLoading) {
            return <div className="profile-container loading">Loading profile...</div>;
        }

        if (error) {
            return <div className="profile-container error">{error}</div>;
        }

        if (!profileData) {
            return <div className="profile-container error">No profile data found</div>;
        }

        return (
            <div className="profile-container">
                <div className="profile-header">
                    <div className="profile-avatar" style={{ backgroundImage: avatarUrl ? `url(${avatarUrl})` : 'none' }}>
                        {!isOwnProfile && this.renderPlayerStatus(
                            this.state.playerStatus.status,
                            this.state.playerStatus.gameId
                        )}
                    </div>
                    <div className="profile-info">
                        <h1>{profileData.name}</h1>
                        <div className="profile-details">
                            <div className="player-stats">
                                <span className="elo-rating">ELO Rating: {profileData.elo}</span>
                                <span className="rank-divider">•</span>
                                <span className="all-time-rank">All-time Rank: #{profileData.allTimeStats.rank}</span>
                            </div>
                            <div className="profile-join-date">
                                Member since {this.formatDate(profileData.joinDate)}
                            </div>
                            {!isOwnProfile && (
                                this.isAlreadyFriend() ? (
                                    <button className="profile-add-friend is-friend">
                                        Friend
                                    </button>
                                ) : (
                                    <button 
                                        className="profile-add-friend"
                                        onClick={this.handleAddFriend}
                                        disabled={this.state.isAddingFriend}
                                    >
                                        {this.state.isAddingFriend ? (
                                            <div className="button-spinner"></div>
                                        ) : (
                                            'Add Friend'
                                        )}
                                    </button>
                                )
                            )}
                        </div>
                    </div>
                </div>

                {this.renderStatusBox()}

                <div className="stats-grid">
                    <div className="stats-card all-time">
                        <h2>All Time Ranked Stats</h2>
                        <div className="stat-row">
                            <span>Games Played</span>
                            <span className="value">{profileData.allTimeStats.nbGames}</span>
                        </div>
                        <div className="stat-row">
                            <span>Total Wins</span>
                            <span className="value">{profileData.allTimeStats.wins}</span>
                        </div>
                        {/* <div className="stat-row">
                            <span>Total Losses</span>
                            <span className="value">{profileData.allTimeStats.losses}</span>
                        </div> */}
                        <div className="stat-row">
                            <span>Win Rate</span>
                            <span className="value">
                                {this.formatNumber(
                                    (profileData.allTimeStats.wins / 
                                    (profileData.allTimeStats.wins + profileData.allTimeStats.losses)) * 100 || 0
                                )}%
                            </span>
                        </div>
                        <div className="stat-row">
                            <span>Best Win Streak</span>
                            <span className="value">{profileData.allTimeStats.winStreak}</span>
                        </div>
                        <div className="stat-row">
                            <span>Worst Loss Streak</span>
                            <span className="value">{profileData.allTimeStats.lossStreak}</span>
                        </div>
                    </div>

                    <div className="stats-card season">
                        {/* <div className="league-icon">
                            <img src={getLeagueIcon(profileData.leagueStats.league)} alt="League" />
                        </div> */}
                        <h2>{LeaguesNames[profileData.leagueStats.league]} League Stats</h2>
                        <div className="stat-row">
                            <span>Games Played</span>
                            <span className="value">{profileData.leagueStats.gamesPlayed}</span>
                        </div>
                        <div className="stat-row">
                            <span>Wins</span>
                            <span className="value">{profileData.leagueStats.wins}</span>
                        </div>
                        <div className="stat-row">
                            <span>Win Rate</span>
                            <span className="value">{this.formatNumber((profileData.leagueStats.wins / profileData.leagueStats.gamesPlayed * 100) || 0)}%</span>
                        </div>
                        <div className="stat-row">
                            <span>Best Win Streak</span>
                            <span className="value">{profileData.leagueStats.winStreak}</span>
                        </div>
                        <div className="stat-row">
                            <span>Worst Loss Streak</span>
                            <span className="value">{profileData.leagueStats.lossStreak}</span>
                        </div>
                    </div>

                    <div className="stats-card casual">
                        <h2>Casual Mode Stats</h2>
                        <div className="stat-row">
                            <span>Games Played</span>
                            <span className="value">{profileData.casualStats.gamesPlayed}</span>
                        </div>
                        <div className="stat-row">
                            <span>Wins</span>
                            <span className="value">{profileData.casualStats.wins}</span>
                        </div>
                        <div className="stat-row">
                            <span>Win Rate</span>
                            <span className="value">
                                {this.formatNumber(
                                    (profileData.casualStats.wins / profileData.casualStats.gamesPlayed) * 100 || 0
                                )}%
                            </span>
                        </div>
                    </div>
                </div>

                {isOwnProfile && (
                    <div className="friends-section">
                        <h2>Friends</h2>
                        <SearchPlayers 
                            onAddFriend={async (playerId) => {
                                try {
                                    await this.context.addFriend(playerId);
                                    successToast('Friend added successfully!');
                                } catch (error) {
                                    console.error('Error adding friend:', error);
                                }
                            }}
                        />
                        
                        <div className="friends-mosaic">
                            {this.context.friends.length > 0 ? (
                                this.context.friends.map(friend => (
                                    <div 
                                        key={friend.id}
                                        className="friend-tile"
                                        onClick={() => route(`/profile/${friend.id}`)}
                                    >
                                        <div 
                                            className="friend-avatar" 
                                            style={{ 
                                                backgroundImage: `url(${avatarContext(`./${friend.avatar}.png`)})` 
                                            }}
                                        >
                                            {this.renderPlayerStatus(
                                                this.state.friendStatuses[friend.id]?.status || 'offline',
                                                this.state.friendStatuses[friend.id]?.gameId
                                            )}
                                        </div>
                                        <span className="friend-name">{friend.name}</span>
                                    </div>
                                ))
                            ) : (
                                <div className="no-friends">No friends yet</div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    }
}

export default Profile; 