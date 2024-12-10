import { h, Component } from 'preact';
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
}

class Profile extends Component<Props, State> {
    static contextType = PlayerContext;

    state: State = {
        profileData: null,
        isLoading: true,
        error: null,
        avatarUrl: null
    };

    async componentDidMount() {
        await this.loadProfileData();
    }

    async componentDidUpdate(prevProps: Props) {
        if (prevProps.id !== this.props.id) {
            await this.loadProfileData();
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
        try {
            await this.context.addFriend(this.props.id);
            successToast('Friend added successfully!');
        } catch (error) {
            console.error('Error adding friend:', error);
            // Error toast is handled by the API service
        }
    };

    isAlreadyFriend = () => {
        return this.context.friends.some(friend => friend.id === this.props.id);
    };

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
                    <div className="profile-avatar" style={{ backgroundImage: avatarUrl ? `url(${avatarUrl})` : 'none' }} />
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
                                    >
                                        Add Friend
                                    </button>
                                )
                            )}
                        </div>
                    </div>
                </div>

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
                                        />
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