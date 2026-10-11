import {t, i18n, userError} from '../../i18n/core';
import {Trans} from '../../i18n/Trans';

import { Fragment } from 'preact';
import { h } from 'preact';
import { Component, } from 'preact';
import { avatarContext, successToast, errorToast } from '../utils';
import { LeaguesNames } from '@legion/shared/enums';
import { PlayerContext } from '../../contexts/PlayerContext';
import './profile.style.css';
import SearchPlayers from './SearchPlayers';
import { route } from 'preact-router';
import { apiFetch } from '../../services/apiService';
import { MAX_AVATAR_ID, MAX_NICKNAME_LENGTH } from '@legion/shared/config';
import type { CommunitySummary } from '@legion/shared/communities';
import ProfileCommunity from '../community/ProfileCommunity';
import Sigil from '../sigil/Sigil';

interface Props {
    id?: string;
}

interface ProfileStats {
    gamesPlayed?: number;
    nbGames?: number;
    wins: number;
    losses?: number;
    winStreak?: number;
    lossStreak?: number;
    rank?: number;
    league?: number;
}

interface ProfileData {
    name: string;
    avatar: string;
    elo: number;
    joinDate: string;
    allTimeStats: ProfileStats;
    casualStats: ProfileStats;
    leagueStats: ProfileStats;
    community?: CommunitySummary | null;
    communityJoinedAt?: number | null;
}

interface State {
    profileData: ProfileData | null;
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
    showChallengeModal: boolean;
    isCreatingChallenge: boolean;
    isEditingName: boolean;
    newName: string;
    isUpdatingName: boolean;
    showAvatarGallery: boolean;
    isUpdatingAvatar: boolean;
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
        showChallengeModal: false,
        isCreatingChallenge: false,
        isEditingName: false,
        newName: '',
        isUpdatingName: false,
        showAvatarGallery: false,
        isUpdatingAvatar: false,
    };

    getEffectiveId = () => {
        return this.props.id || this.context.player.uid;
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
            const response = await fetch(`${process.env.API_URL}/getProfileData?playerId=${this.getEffectiveId()}`);
            if (!response.ok) {
                throw new Error('Failed to fetch profile data');
            }
            const profileData = await response.json() as ProfileData;

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
                error: "Failed to load profile data",
                isLoading: false
            });
        }
    };

    formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString(i18n.resolvedLanguage, {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    formatNumber = (number: number) => {
        return new Intl.NumberFormat(i18n.resolvedLanguage, {
            maximumFractionDigits: 1
        }).format(number);
    };

    getMaxStats = (allTime: number, season: number) => {
        return Math.max(allTime, season);
    };

    isOwnProfile = () => {
        return this.getEffectiveId() === this.context.player.uid;
    };

    handleAddFriend = async () => {
        this.setState({ isAddingFriend: true });
        try {
            await this.context.addFriend(this.getEffectiveId());
            successToast(t("Friend added successfully!"));
        } catch (error) {
            console.error('Error adding friend:', error);
        } finally {
            this.setState({ isAddingFriend: false });
        }
    };

    isAlreadyFriend = () => {
        return this.context.friends.some(friend => friend.id === this.getEffectiveId());
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
                // console.log('Getting player status for', this.props.id);
                // Get single player status
                socket.emit('getPlayerStatus', { playerId: this.getEffectiveId() });
            }
        };

        // Set up socket listeners
        socket.off('playerStatus').on('playerStatus', (statusInfo) => {
            // console.log('Received status update:', statusInfo);
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

    // The dot's colour is backed by a tooltip and screen-reader text naming the status.
    renderPlayerStatus = (status: string, name?: string) => {
        const label = this.statusLabel(status, name);
        return (
            <>
                <div className={`status-dot ${status}`} title={label} />
                <span className="visually-hidden">{label}</span>
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

    UIDready = () => {
        return !!this.context.player.uid;
    }

    statusLabel = (status: string, value0 = this.state.profileData?.name) => ({
        online: t("{{value0}} is ready to play!", {value0}),
        queuing: t("{{value0}} is already queuing!", {value0}),
        ingame: t("{{value0}} is currently in a game", {value0}),
    }[status] ?? t("{{value0}} is currently offline", {value0}));

    renderStatusBox = () => {
        if (!this.UIDready() || this.isOwnProfile()) return null;

        const status = this.state.playerStatus.status;
        let statusMessage = '';
        let showChallengeButton = false;

        switch(status) {
            case 'online':
                statusMessage = t("{{value0}} is ready to play!", {value0: this.state.profileData.name});
                showChallengeButton = true;
                break;
            case 'queuing':
                statusMessage = t("{{value0}} is already queuing!", {value0: this.state.profileData.name});
                break;
            case 'offline':
                statusMessage = t("{{value0}} is currently offline", {value0: this.state.profileData.name});
                break;
            case 'ingame':
                statusMessage = t("{{value0}} is currently in a game", {value0: this.state.profileData.name});
                break;
        }

        return (
            <div className={`player-status-box ${status}`}>
                <div className="status-text">
                    <div className={`status-dot ${status}`} />
                    <span className="status-message">{statusMessage}</span>
                </div>
                {showChallengeButton && (
                    <button type="button"
                        className="challenge-button"
                        onClick={this.handleChallenge}
                    >{t("Challenge to a Duel")}</button>
                )}
            </div>
        );
    }

    handleChallenge = () => {
        this.setState({ showChallengeModal: true });
    };

    handleChallengeConfirm = async () => {
        this.setState({ isCreatingChallenge: true });
        try {
            const { socket } = this.context;
            if (!socket) {
                throw new Error("No socket connection available");
            }

            // Create a Promise that will resolve when we get a response
            const challengeResponse = await new Promise((resolve, reject) => {
                // Set up one-time listener for the response
                socket.once('challengeResponse', (response) => {
                    if (response.error) {
                        reject(new Error(response.error));
                    } else {
                        resolve(response);
                    }
                });

                // Emit the challenge request
                socket.emit('sendChallenge', {
                    opponentUID: this.getEffectiveId()
                });

                // Set up timeout
                setTimeout(() => {
                    reject(new Error('Challenge request timed out'));
                }, 10000);
            });

            // Handle the response
            const { lobbyId } = challengeResponse as { lobbyId: string };
            route(`/lobby/${lobbyId}`);
        } catch (error) {
            console.error('Error creating challenge:', error);
            errorToast(userError(error));
        } finally {
            this.setState({
                isCreatingChallenge: false,
                showChallengeModal: false
            });
        }
    };

    handleEditNameClick = () => {
        this.setState({
            isEditingName: true,
            newName: this.state.profileData.name
        });
    };

    handleNameChange = (e: Event) => {
        const target = e.target as HTMLInputElement;
        this.setState({ newName: target.value });
    };

    handleNameSubmit = async (e: Event) => {
        e.preventDefault();

        this.setState({ isUpdatingName: true });
        try {
            const response = await apiFetch('updatePlayerName', {
                method: 'POST',
                body: {
                    name: this.state.newName
                }
            });

            if (response.success) {
                // Update local state
                this.setState(prevState => ({
                    profileData: {
                        ...prevState.profileData,
                        name: this.state.newName
                    }
                }));

                // Update PlayerContext
                this.context.setPlayerInfo({ name: this.state.newName });

                successToast(t("Name updated successfully!"));
            }
        } catch (error) {
            console.error('Error updating name:', error);
            let message = userError(error);
            // Check if 'profane' is in the error message
            if (String(error.message).includes('profane')) {
                message = t("Name contains profane words");
            }
            errorToast(message);
        } finally {
            this.setState({
                isEditingName: false,
                isUpdatingName: false
            });
        }
    };

    handleEditAvatarClick = () => {
        this.setState({ showAvatarGallery: true });
    };

    handleAvatarSelect = async (avatarId: string) => {
        // Don't do anything if selecting the same avatar
        if (avatarId === this.state.profileData.avatar) {
            this.setState({ showAvatarGallery: false });
            return;
        }

        this.setState({ isUpdatingAvatar: true });
        try {
            const response = await apiFetch('updatePlayerAvatar', {
                method: 'POST',
                body: {
                    avatarId
                }
            });

            if (response.success) {
                // Update local state
                this.setState(prevState => ({
                    avatarUrl: avatarContext(`./${avatarId}.png`),
                    profileData: {
                        ...prevState.profileData,
                        avatar: avatarId
                    }
                }));

                // Update PlayerContext
                this.context.setPlayerInfo({ avatar: avatarId });

                successToast(t("Avatar updated successfully!"));
            }
        } catch (error) {
            console.error('Error updating avatar:', error);
            errorToast(t("Failed to update avatar"));
        } finally {
            this.setState({
                isUpdatingAvatar: false,
                showAvatarGallery: false
            });
        }
    };

    renderAvatarGallery = () => {
        if (!this.state.showAvatarGallery) return null;

        const avatarOptions = [];
        for (let i = 1; i <= MAX_AVATAR_ID; i++) {
            const avatarId = i.toString();
            avatarOptions.push(
                <button type="button" data-game-control
                    key={avatarId}
                    className={`avatar-option ${this.state.profileData.avatar === avatarId ? 'selected' : ''}`}
                    style={{ backgroundImage: `url(${avatarContext(`./${avatarId}.png`)})` }}
                    onClick={() => this.handleAvatarSelect(avatarId)}
                ></button>
            );
        }

        return (
            <div className="avatar-gallery-modal">
                <div className="avatar-gallery">
                    <div className="avatar-gallery-header">
                        <h3>{t("Choose your Avatar")}</h3>
                        <button type="button"
                            className="avatar-gallery-close"
                            onClick={() => this.setState({ showAvatarGallery: false })}
                        >
                            ×
                        </button>
                    </div>
                    <div className="avatar-grid">
                        {this.state.isUpdatingAvatar ? (
                            <div className="loading">
                                <div className="loading-spinner" />
                            </div>
                        ) : (
                            avatarOptions
                        )}
                    </div>
                </div>
            </div>
        );
    };

    render() {
        const { profileData, isLoading, error, avatarUrl } = this.state;
        const isOwnProfile = this.isOwnProfile();

        if (isLoading) {
            return <div className="profile-container loading">{t("Loading profile...")}</div>;
        }

        if (error) {
            return <div className="profile-container error">{t(error)}</div>;
        }

        if (!profileData) {
            return <div className="profile-container error">{t("No profile data found")}</div>;
        }

        return (
            <div className="profile-container">
                <div className="profile-header">
                    <div className="profile-avatar" style={{ backgroundImage: avatarUrl ? `url(${avatarUrl})` : 'none' }}>
                        {this.UIDready() && !isOwnProfile && this.renderPlayerStatus(this.state.playerStatus.status)}
                        {isOwnProfile && (
                            <button type="button" data-game-control
                                className="edit-avatar-icon"
                                onClick={this.handleEditAvatarClick}
                            >
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <title>{t("Edit avatar")}</title>
                                    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                                </svg>
                            </button>
                        )}
                    </div>
                    <div className="profile-info">
                        <div className="profile-name-container">
                            {this.state.isEditingName ? (
                                <form className="name-edit-form" onSubmit={this.handleNameSubmit}>
                                    <input
                                        type="text"
                                        className="name-edit-input"
                                        value={this.state.newName}
                                        onChange={this.handleNameChange}
                                        maxLength={MAX_NICKNAME_LENGTH}
                                    />
                                    {this.state.isUpdatingName ? (
                                        <div className="name-edit-spinner" />
                                    ) : (
                                        <>
                                            <button type="submit">{t("Save")}</button>
                                            <button
                                                type="button"
                                                onClick={() => this.setState({ isEditingName: false })}
                                            >{t("Cancel")}</button>
                                        </>
                                    )}
                                </form>
                            ) : (
                                <>
                                    <h1>{profileData.name}</h1>
                                    {isOwnProfile && (
                                        <button type="button" data-game-control
                                            className="edit-name-icon"
                                            onClick={this.handleEditNameClick}
                                            aria-label={t("Edit name")}
                                        >
                                            <svg
                                                width="24"
                                                height="24"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <title>{t("Edit name")}</title>
                                                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                                            </svg>
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                        <div className="profile-details">
                            <div className="player-stats">
                                <span className="elo-rating">{t("ELO Rating: {{value0}}", {value0: profileData.elo})}</span>
                                <span className="rank-divider">•</span>
                                <span className="all-time-rank">{t("All-time Rank: #{{value0}}", {value0: profileData.allTimeStats.rank})}</span>
                            </div>
                            <div className="profile-join-date">{t("Member since {{value0}}", {value0: this.formatDate(profileData.joinDate)})}</div>
                            <ProfileCommunity
                                community={isOwnProfile ? this.context.player.community : profileData.community}
                                joinedAt={isOwnProfile ? this.context.player.community?.joinedAt : profileData.communityJoinedAt}
                                isOwn={isOwnProfile}
                            />
                            {this.UIDready() && !isOwnProfile && (
                                this.isAlreadyFriend() ? (
                                    <button type="button" className="profile-add-friend is-friend">{t("Friend")}</button>
                                ) : (
                                    <button type="button"
                                        className="profile-add-friend"
                                        onClick={this.handleAddFriend}
                                        disabled={this.state.isAddingFriend}
                                    >
                                        {this.state.isAddingFriend ? (
                                            <div className="button-spinner"></div>
                                        ) : (
                                            t("Add Friend")
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
                        <h2>{t("All Time Ranked Stats")}</h2>
                        <div className="stat-row">
                            <span>{t("Games Played")}</span>
                            <span className="value">
                                {this.getMaxStats(
                                    profileData.allTimeStats.nbGames,
                                    profileData.leagueStats.gamesPlayed
                                )}
                            </span>
                        </div>
                        <div className="stat-row">
                            <span>{t("Total Wins")}</span>
                            <span className="value">
                                {this.getMaxStats(
                                    profileData.allTimeStats.wins,
                                    profileData.leagueStats.wins
                                )}
                            </span>
                        </div>
                        <div className="stat-row">
                            <span>{t("Win Rate")}</span>
                            <span className="value">
                                {this.formatNumber(
                                    this.getMaxStats(
                                        (profileData.allTimeStats.wins /
                                        (profileData.allTimeStats.wins + profileData.allTimeStats.losses)) * 100 || 0,
                                        (profileData.leagueStats.wins / profileData.leagueStats.gamesPlayed) * 100 || 0
                                    )
                                )}%
                            </span>
                        </div>
                        <div className="stat-row">
                            <span>{t("Best Win Streak")}</span>
                            <span className="value">
                                {this.getMaxStats(
                                    profileData.allTimeStats.winStreak,
                                    profileData.leagueStats.winStreak
                                )}
                            </span>
                        </div>
                        <div className="stat-row">
                            <span>{t("Worst Loss Streak")}</span>
                            <span className="value">
                                {this.getMaxStats(
                                    profileData.allTimeStats.lossStreak,
                                    profileData.leagueStats.lossStreak
                                )}
                            </span>
                        </div>
                    </div>

                    <div className="stats-card season">
                        {/* <div className="league-icon">
                            <img src={getLeagueIcon(profileData.leagueStats.league)} alt="" />
                        </div> */}
                        <h2>{t("{{value0}} League Stats", {value0: t(LeaguesNames[profileData.leagueStats.league])})}</h2>
                        <div className="stat-row">
                            <span>{t("Games Played")}</span>
                            <span className="value">{profileData.leagueStats.gamesPlayed}</span>
                        </div>
                        <div className="stat-row">
                            <span>{t("Wins")}</span>
                            <span className="value">{profileData.leagueStats.wins}</span>
                        </div>
                        <div className="stat-row">
                            <span>{t("Win Rate")}</span>
                            <span className="value">{this.formatNumber((profileData.leagueStats.wins / profileData.leagueStats.gamesPlayed * 100) || 0)}%</span>
                        </div>
                        <div className="stat-row">
                            <span>{t("Best Win Streak")}</span>
                            <span className="value">{profileData.leagueStats.winStreak}</span>
                        </div>
                        <div className="stat-row">
                            <span>{t("Worst Loss Streak")}</span>
                            <span className="value">{profileData.leagueStats.lossStreak}</span>
                        </div>
                    </div>

                    <div className="stats-card casual">
                        <h2>{t("Casual Mode Stats")}</h2>
                        <div className="stat-row">
                            <span>{t("Games Played")}</span>
                            <span className="value">{profileData.casualStats.gamesPlayed}</span>
                        </div>
                        <div className="stat-row">
                            <span>{t("Wins")}</span>
                            <span className="value">{profileData.casualStats.wins}</span>
                        </div>
                        <div className="stat-row">
                            <span>{t("Win Rate")}</span>
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
                        <h2>{t("Friends")}</h2>
                        <SearchPlayers
                            onAddFriend={async (playerId) => {
                                try {
                                    await this.context.addFriend(playerId);
                                    successToast(t("Friend added successfully!"));
                                } catch (error) {
                                    console.error('Error adding friend:', error);
                                }
                            }}
                        />

                        <div className="friends-mosaic">
                            {this.context.friends.length > 0 ? (
                                this.context.friends.map(friend => (
                                    <button type="button" data-game-control
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
                                            {this.renderPlayerStatus(this.state.friendStatuses[friend.id]?.status || 'offline', friend.name)}
                                            {friend.community && <Sigil sigil={friend.community.sigil} size={26} label={friend.community.name} className="friend-sigil" />}
                                        </div>
                                        <span className="friend-name">{friend.name}</span>
                                    </button>
                                ))
                            ) : (
                                <div className="no-friends">{t("No friends yet")}</div>
                            )}
                        </div>
                    </div>
                )}

                {/* Challenge Modal */}
                {this.state.showChallengeModal && (
                    <div className="modal-overlay">
                        <div className="modal challenge-modal">
                            <div
                                className="challenger-avatar"
                                style={{ backgroundImage: avatarUrl ? `url(${avatarUrl})` : 'none' }}
                            />
                            <h3>{t("Duel")}</h3>
                            <div className="challenge-description">
                                <p><Trans i18n={i18n} i18nKey={"Do you want to play against <0>{{value0}}</0> ?"} components={[<span className="highlight-name" />]} values={{value0: profileData.name}} /></p>
                            </div>
                            <div className="modal-footer">
                                {this.state.isCreatingChallenge ? (
                                    <div className="lobby-spinner"></div>
                                ) : (
                                    <>
                                        <button type="button"
                                            onClick={() => this.setState({ showChallengeModal: false })}
                                            className="cancel-btn"
                                        >{t("Cancel")}</button>
                                        <button type="button"
                                            onClick={this.handleChallengeConfirm}
                                            className="confirm-btn"
                                        >{t("Send Challenge")}</button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {this.renderAvatarGallery()}
            </div>
        );
    }
}

export default Profile;
