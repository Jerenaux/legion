import { h, Component, Fragment } from 'preact';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css'
import { PlayerContext } from '../contexts/PlayerContext';
import SolanaWalletService from '../services/SolanaWalletService';
import { apiFetch } from '../services/apiService';
import { Token } from "@legion/shared/enums";
import { errorToast } from './utils';


interface Lobby {
    id: string;
    avatar: string;
    nickname: string;
    elo: number;
    league: string;
    rank: string;
    stake: number;
}

interface State {
    isWalletDetected: boolean;
    isWalletConnected: boolean;
    lobbies: Lobby[] | null;
    isLoadingLobbies: boolean;
    isCreatingLobby: boolean;
    isModalOpen: boolean;
    stakeAmount: string;
}

class ElysiumPage extends Component<{}, State> {
    static contextType = PlayerContext;
    private walletService: SolanaWalletService;

    state: State = {
        isWalletDetected: false,
        isWalletConnected: false,
        lobbies: null,
        isLoadingLobbies: false,
        isCreatingLobby: false,
        isModalOpen: false,
        stakeAmount: '0.01',
    }

    constructor(props: {}) {
        super(props);
        this.walletService = SolanaWalletService.getInstance();
    }

    async componentDidMount() {
        const isWalletDetected = this.walletService.isWalletDetected();
        const isWalletConnected = await this.walletService.checkWalletConnection();
        this.setState({ isWalletDetected, isWalletConnected });
        this.walletService.addWalletStateListener(this.handleWalletStateChange);

        if (isWalletConnected) {
            this.fetchLobbies();
        }
    }

    componentWillUnmount() {
        this.walletService.removeWalletStateListener(this.handleWalletStateChange);
    }

    handleWalletStateChange = () => {
        const isWalletConnected = this.walletService.isWalletConnected();
        this.setState({ isWalletConnected });
        if (isWalletConnected) {
            this.fetchLobbies();
        }
    };


    handleConnectWallet = async () => {
        const connected = await this.walletService.connectWallet();
        if (connected) {
            this.setState({ isWalletConnected: true });
            this.fetchLobbies();
        }
    }

    fetchLobbies = async () => {
        this.setState({ isLoadingLobbies: true });
        try {
            const data = await apiFetch('listLobbies');
            this.setState({ lobbies: data, isLoadingLobbies: false });
        } catch (error) {
            console.error('Error fetching lobbies:', error);
            this.setState({ isLoadingLobbies: false });
        }
    }

    renderLobbySkeletons() {
        return Array(5).fill(null).map((_, index) => (
            <div key={index} className="lobby-skeleton">
                <Skeleton circle={true} height={50} width={50} />
                <div className="lobby-info">
                    <Skeleton width={100} />
                    <Skeleton width={80} />
                    <Skeleton width={60} />
                </div>
            </div>
        ));
    }

    renderLobbies() {
        const { lobbies } = this.state;
        if (!lobbies || lobbies.length === 0) {
            return <div className="no-lobbies-message">No lobbies are currently available.</div>;
        }

        return lobbies.map(lobby => (
            <div key={lobby.id} className="lobby-item">
                <img src={lobby.avatar} alt={`${lobby.nickname}'s avatar`} className="lobby-avatar" />
                <div className="lobby-info">
                    <h3>{lobby.nickname}</h3>
                    <p>ELO: {lobby.elo}</p>
                    <p>{lobby.league} - {lobby.rank}</p>
                    <p>Stake: {lobby.stake} SOL</p>
                </div>
            </div>
        ));
    }

    handleOpenModal = () => {
        this.setState({ isModalOpen: true, stakeAmount: '0.01' });
      }
    
      handleCloseModal = () => {
        this.setState({ isModalOpen: false });
      }
    
      handleStakeChange = (e: Event) => {
        const input = e.target as HTMLInputElement;
        this.setState({ stakeAmount: input.value });
      }
    
      handleCreateLobby = async () => {
        const { stakeAmount } = this.state;
        const stake = parseFloat(stakeAmount);

        this.setState({ isCreatingLobby: true });
    
        try {
          await apiFetch('createLobby', 
            { 
                method: 'POST', 
                body: {
                    stake
                }
            });
          this.setState({ isModalOpen: false, isCreatingLobby: false });
          this.context.refreshPlayerData(); 
          this.fetchLobbies(); // Refresh the lobby list
        } catch (error) {
          errorToast('Error creating lobby:', error);
          this.setState({ isCreatingLobby: false })
        }
      }

    render() {
        const { isWalletDetected, isWalletConnected, isLoadingLobbies, isModalOpen, stakeAmount, isCreatingLobby } = this.state;
        const tokens = this.context.player.tokens || {};
        const ingameBalance = tokens[Token.SOL] || 0;
        const onchainBalance = this.walletService.getBalance();
        const maxStake = ingameBalance + onchainBalance;
        const minStake = 0.01;
        const currentStake = parseFloat(stakeAmount);
        const isStakeValid = currentStake >= minStake && currentStake <= maxStake;

        if (!isWalletDetected) {
            return <div>No wallet detected</div>;
        }

        if (!isWalletConnected) {
            return (
                <div>
                    <button onClick={this.handleConnectWallet}>Connect Wallet</button>
                </div>
            );
        }

        return (
            <div className="elysium-page">
                <h2 className="lobbies-header">Available Lobbies</h2>
                <button onClick={this.handleOpenModal} className="create-lobby-btn">Create Lobby</button>
                <div className="lobbies-container">
                    {isLoadingLobbies ? this.renderLobbySkeletons() : this.renderLobbies()}
                </div>
                <div className="wallet-info">
                    <p>Address: {this.walletService.getWalletAddress()}</p>
                    <p>In-game balance: {ingameBalance} SOL</p>
                    <p>On-chain balance: {onchainBalance} SOL</p>
                </div>

                {isModalOpen && (
                    <div className="modal-overlay">
                        <div className="modal">
                        <h3>Create a New Lobby</h3>
                        <p>Set the stake amount for your new lobby.</p>
                        <div className="modal-content">
                            <label htmlFor="stake">Stake (SOL)</label>
                            <input
                            id="stake"
                            type="number"
                            value={stakeAmount}
                            onChange={this.handleStakeChange}
                            min={minStake}
                            max={maxStake}
                            step={0.01}
                            disabled={isCreatingLobby}  // Disable input while creating lobby
                            />
                            <div className="stake-limits">
                            <p className={currentStake < minStake ? 'invalid' : ''}>
                                Min stake: {minStake} SOL
                            </p>
                            <p className={currentStake > maxStake ? 'invalid' : ''}>
                                Max stake: {maxStake} SOL
                            </p>
                            <small>(Max stake is the sum of in-game and browser wallet balances)</small>
                            </div>
                        </div>
                        <div className="modal-footer">
                            {isCreatingLobby ? (
                            <div className="lobby-spinner"></div>
                            ) : (
                            <Fragment>
                                <button onClick={this.handleCloseModal} className="cancel-btn">Cancel</button>
                                <button 
                                onClick={this.handleCreateLobby} 
                                disabled={!isStakeValid}
                                className={`confirm-btn ${!isStakeValid ? 'disabled' : ''}`}
                                >
                                Create Lobby
                                </button>
                            </Fragment>
                            )}
                        </div>
                        </div>
                    </div>
                    )}
            </div>
        );
    }
}

export default ElysiumPage;