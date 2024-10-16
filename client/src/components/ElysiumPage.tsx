import '../style/ElysiumPage.style.css';
import { h, Fragment } from 'preact';
import { route } from 'preact-router';
import { useState, useEffect, useContext } from 'preact/hooks';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { PlayerContext } from '../contexts/PlayerContext';
import { apiFetch } from '../services/apiService';
import { Token } from '@legion/shared/enums';
import { avatarContext, errorToast, successToast, getLeagueIcon } from './utils';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import {
    LAMPORTS_PER_SOL,
    PublicKey,
    Transaction,
    SystemProgram,
} from '@solana/web3.js';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { GAME_WALLET, MIN_WITHDRAW } from '@legion/shared/config';
import { League } from "@legion/shared/enums";

const leagueMap = new Map([
    [League.BRONZE, 'Bronze'],
    [League.SILVER, 'Silver'],
    [League.GOLD, 'Gold'],
    [League.ZENITH, 'Zenith'],
    [League.APEX, 'Apex'],
]);

interface Lobby {
    id: string;
    avatar: string;
    nickname: string;
    elo: number;
    league: string;
    rank: string;
    stake: number;
}

const ElysiumPage = () => {
    const [lobbies, setLobbies] = useState<Lobby[] | null>(null);
    const [isLoadingLobbies, setIsLoadingLobbies] = useState(false);
    const [isCreatingLobby, setIsCreatingLobby] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [showConfirmationModal, setShowConfirmationModal] = useState(false);
    const [stakeAmount, setStakeAmount] = useState('0.01');
    const [onchainBalance, setOnchainBalance] = useState(0);
    const [registeredAddress, setRegisteredAddress] = useState<string | null>(null);
    const [amountNeededFromOnchain, setAmountNeededFromOnchain] = useState(0);

    const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
    const [withdrawAmount, setWithdrawAmount] = useState('0.01');
    const [isWithdrawing, setIsWithdrawing] = useState(false);

    const [selectedLobby, setSelectedLobby] = useState<Lobby | null>(null);
    const [showJoinConfirmationModal, setShowJoinConfirmationModal] = useState(false);
    const [isJoiningLobby, setIsJoiningLobby] = useState(false);

    const [lobbyAvatars, setLobbyAvatars] = useState<{ [key: string]: string | null }>({});
    const [isLoadingAvatars, setIsLoadingAvatars] = useState<{ [key: string]: boolean }>({});

    const { connected, publicKey, wallets, sendTransaction } = useWallet();
    const { connection } = useConnection();
    const playerContext = useContext(PlayerContext);

    const ingameBalance = playerContext.player.tokens?.[Token.SOL] || 0;

    const loadAvatar = (lobbyId: string, avatar: string) => {
        setIsLoadingAvatars(prev => ({ ...prev, [lobbyId]: true }));
        if (avatar !== '0') {
            try {
                const avatarUrl = avatarContext(`./${avatar}.png`);
                setLobbyAvatars(prev => ({ ...prev, [lobbyId]: avatarUrl }));
            } catch (error) {
                console.error(`Failed to load avatar: ${avatar}.png`, error);
                setLobbyAvatars(prev => ({ ...prev, [lobbyId]: null }));
            }
        } else {
            setLobbyAvatars(prev => ({ ...prev, [lobbyId]: null }));
        }
        setIsLoadingAvatars(prev => ({ ...prev, [lobbyId]: false }));
    };

    useEffect(() => {
        if (lobbies) {
            lobbies.forEach(lobby => {
                if (!lobbyAvatars[lobby.id]) {
                    loadAvatar(lobby.id, lobby.avatar);
                }
            });
        }
    }, [lobbies]);

    useEffect(() => {
        if (connected && publicKey) {
            // Fetch lobbies
            fetchLobbies();

            // Fetch on-chain balance
            connection
                .getBalance(publicKey)
                .then((balance) => {
                    setOnchainBalance(balance / LAMPORTS_PER_SOL);
                })
                .catch((error) => {
                    console.error('Failed to get balance:', error);
                });

            // Register address if it has changed
            const newAddress = publicKey.toBase58();
            if (registeredAddress !== newAddress) {
                apiFetch('registerAddress', {
                    method: 'POST',
                    body: {
                        address: newAddress,
                    },
                })
                    .then(() => {
                        console.log('Address registered successfully.');
                        setRegisteredAddress(newAddress);
                    })
                    .catch((error) => {
                        console.error('Error registering address:', error);
                    });
            }
        }
    }, [connected, publicKey]);

    const fetchLobbies = async () => {
        setIsLoadingLobbies(true);
        try {
            // await new Promise(resolve => setTimeout(resolve, 10000));
            const data = await apiFetch('listLobbies');
            setLobbies(data);
            setIsLoadingLobbies(false);
        } catch (error) {
            console.error('Error fetching lobbies:', error);
            setIsLoadingLobbies(false);
        }
    };

    const renderLobbySkeletons = () => {
        return Array(5)
            .fill(null)
            .map((_, index) => (
                <div key={index} className="lobby-skeleton">
                    <Skeleton circle={true} height={50} width={50} />
                    <div className="lobby-info">
                        <Skeleton width={100} />
                        <Skeleton width={80} />
                        <Skeleton width={60} />
                    </div>
                </div>
            ));
    };

    const renderLobbies = () => {
        if (!lobbies || lobbies.length === 0) {
            return (
                <div className="no-lobbies-message">
                    No opponents are currently waiting, create a game to start!
                </div>
            );
        }
    
        const totalBalance = ingameBalance + onchainBalance;
    
        return lobbies.map((lobby) => {
            const leagueName = leagueMap.get(lobby.league as unknown as League);
            const leagueIcon = getLeagueIcon(leagueName);
            const insufficientBalance = totalBalance < lobby.stake;
    
            return (
                <div 
                    key={lobby.id} 
                    className={`lobby-item ${insufficientBalance ? 'insufficient-balance' : ''}`} 
                    onClick={() => insufficientBalance ? null : handleLobbyClick(lobby)}
                >
                    {isLoadingAvatars[lobby.id] ? (
                        <div className="avatar-spinner">
                            <div className="loading-spinner"></div>
                        </div>
                    ) : (
                        <div 
                            className="lobby-avatar" 
                            style={{ backgroundImage: lobbyAvatars[lobby.id] ? `url(${lobbyAvatars[lobby.id]})` : 'none' }}
                        ></div>
                    )}
                    <div className="lobby-info">
                        <h3>{lobby.nickname}</h3>
                        <p>ELO: {lobby.elo}</p>
                        <div className="lobby-league">
                            <img src={leagueIcon} alt={leagueName} className="league-icon" />
                            <span>#{lobby.rank}</span>
                        </div>
                    </div>
                    <div className="lobby-stake">
                        <span className="stake-label">Stake</span>
                        <span className="stake-amount">{lobby.stake} SOL</span>
                    </div>
                    {insufficientBalance && (
                        <div className="insufficient-balance-text">Insufficient balances</div>
                    )}
                </div>
            );
        });
    };

    const handleLobbyClick = (lobby: Lobby) => {
        setSelectedLobby(lobby);
        setShowJoinConfirmationModal(true);
    };

    const handleJoinLobbyConfirmation = () => {
        // setShowJoinConfirmationModal(false);
        joinLobbyTransaction();
    };

    const joinLobbyTransaction = async () => {
        setIsJoiningLobby(true);
    
        try {
            let transactionSignature = null;
    
            if (selectedLobby.stake > ingameBalance) {
                const amountNeeded = selectedLobby.stake - ingameBalance;
                const gamePublicKey = new PublicKey(GAME_WALLET);
    
                const transaction = new Transaction().add(
                    SystemProgram.transfer({
                        fromPubkey: publicKey!,
                        toPubkey: gamePublicKey,
                        lamports: Math.round(amountNeeded * LAMPORTS_PER_SOL),
                    })
                );
    
                transactionSignature = await sendTransaction(transaction, connection);
                console.log(`Transaction signature: ${transactionSignature}`);
    
                setOnchainBalance((prevBalance) => prevBalance - amountNeeded);
                playerContext.refreshPlayerData();
            }
    
            console.log(`Calling joinLobby with lobbyId: ${selectedLobby.id} ...`);
            await apiFetch('joinLobby', {
                method: 'POST',
                body: {
                    lobbyId: selectedLobby.id,
                    transactionSignature,
                    playerAddress: publicKey.toBase58(),
                },
            });
    
            route(`/lobby/${selectedLobby.id}`);
        } catch (error) {
            errorToast('Error joining lobby: ' + (error.message || error));
        } finally {
            setIsJoiningLobby(false);
            setShowJoinConfirmationModal(false);
            setSelectedLobby(null);
        }
    };
    
    const handleOpenModal = () => {
        setIsModalOpen(true);
        setStakeAmount('0.01');
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
    };

    const handleStakeChange = (e: Event) => {
        const input = e.target as HTMLInputElement;
        setStakeAmount(input.value);
    };

    const handleCreateLobby = async () => {
        const stake = parseFloat(stakeAmount);
        const amountNeeded = stake - ingameBalance;

        if (amountNeeded > 0) {
            if (onchainBalance >= amountNeeded) {
                setAmountNeededFromOnchain(amountNeeded);
                setShowConfirmationModal(true);
            } else {
                errorToast('Not enough balance in your wallet to cover the stake difference.');
            }
        } else {
            // Proceed with creating the lobby if no additional funds are needed
            await createLobbyTransaction();
        }
    };

    const createLobbyTransaction = async () => {
        setShowConfirmationModal(false);
        setIsCreatingLobby(true);

        try {
            let transactionSignature = null;

            if (amountNeededFromOnchain > 0) {
                const gamePublicKey = new PublicKey(GAME_WALLET);

                const transaction = new Transaction().add(
                    SystemProgram.transfer({
                        fromPubkey: publicKey!,
                        toPubkey: gamePublicKey,
                        lamports: Math.round(amountNeededFromOnchain * LAMPORTS_PER_SOL),
                    })
                );

                transactionSignature = await sendTransaction(transaction, connection);
                console.log(`Transaction signature: ${transactionSignature}`);

                setOnchainBalance((prevBalance) => prevBalance - amountNeededFromOnchain);
                playerContext.refreshPlayerData();
            }

            const { lobbyId } = await apiFetch('createLobby', {
                method: 'POST',
                body: {
                    stake: parseFloat(stakeAmount),
                    transactionSignature,
                    playerAddress: publicKey.toBase58(),
                },
            });
            playerContext.refreshPlayerData();
            route(`/lobby/${lobbyId}`);
        } catch (error) {
            errorToast('Error creating lobby: ' + (error.message || error));
            setIsCreatingLobby(false);
            setShowConfirmationModal(false);
        }
    };

    // New functions for withdrawal
    const handleOpenWithdrawModal = () => {
        setWithdrawAmount('0.01');
        setIsWithdrawModalOpen(true);
    };

    const handleCloseWithdrawModal = () => {
        setIsWithdrawModalOpen(false);
    };

    const handleWithdrawAmountChange = (e: Event) => {
        const input = e.target as HTMLInputElement;
        setWithdrawAmount(input.value);
    };

    const handleWithdraw = async () => {
        const amount = parseFloat(withdrawAmount);
        const maxWithdraw = ingameBalance;

        if (isNaN(amount) || amount < MIN_WITHDRAW || amount > maxWithdraw) {
            errorToast(`Invalid amount. Please enter an amount between ${minWithdraw} and ${maxWithdraw} SOL.`);
            return;
        }

        setIsWithdrawing(true);

        try {
            const response = await apiFetch('withdrawSOL', {
                method: 'POST',
                body: {
                    amount,
                },
            });

            if (response.success) {
                successToast(`Withdrawal successful. Transaction signature: ${response.signature}`);
                setIsWithdrawModalOpen(false);
                playerContext.refreshPlayerData();
            } else {
                errorToast(`Withdrawal failed: ${response.error}`);
            }
        } catch (error) {
            errorToast('Error during withdrawal: ' + (error.message || error));
        } finally {
            setIsWithdrawing(false);
        }
    };

    const minStake = 0.01;
    const maxStake = ingameBalance + onchainBalance;
    const currentStake = parseFloat(stakeAmount);
    const isStakeValid =
        currentStake >= minStake &&
        currentStake <= maxStake &&
        !isNaN(currentStake);

    // For withdrawal
    const minWithdraw = MIN_WITHDRAW;
    const maxWithdraw = ingameBalance;
    const currentWithdrawAmount = parseFloat(withdrawAmount);
    const isWithdrawAmountValid =
        currentWithdrawAmount >= minWithdraw &&
        currentWithdrawAmount <= maxWithdraw &&
        !isNaN(currentWithdrawAmount);

    if (!wallets || wallets.length === 0) {
        return (
            <div>
                No wallets available. Please install a Solana wallet extension
                like Phantom.
            </div>
        );
    }

    return (
        <div className="elysium-page">
            <div className="top-bar">
                <div className="wallet-info">
                    <div className="balance-info">
                        <div className="balance-item">
                            <span className="balance-label">In-game balance</span>
                            <span className="balance-value">{Number(ingameBalance.toFixed(4))} SOL</span>
                        </div>
                        <div className="balance-item">
                            <span className="balance-label">On-chain balance</span>
                            <span className="balance-value">
                                {connected ? `${Number(onchainBalance.toFixed(4))} SOL` : "???"}
                            </span>
                        </div>
                    </div>
                    <div className="wallet-button-container">
                        <WalletMultiButton />
                        <button
                            onClick={handleOpenWithdrawModal}
                            className="withdraw-btn"
                            disabled={!connected || ingameBalance < minWithdraw}
                        >
                            Withdraw
                        </button>
                    </div>
                </div>
            </div>

            <h2 className="lobbies-header">Available Opponents</h2>

            <div className="create-lobby-container">
                <button
                    onClick={handleOpenModal}
                    className="create-lobby-btn"
                    disabled={!connected || (ingameBalance + onchainBalance) < minStake}
                >
                    Create Game
                </button>
                {!connected && (
                    <p className="create-lobby-info">
                        Please connect your wallet to create a game.
                    </p>
                )}
                {connected && (ingameBalance + onchainBalance) < minStake && (
                    <p className="create-lobby-info">
                        Insufficient funds to create a game. Minimum stake required: {minStake} SOL
                    </p>
                )}
            </div>

            <div className="lobbies-container">
                {isLoadingLobbies ? renderLobbySkeletons() : renderLobbies()}
            </div>

            {/* Create Lobby Modal */}
            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="modal">
                        <h3>Create a New Game</h3>
                        <p>Set the stake amount for your new game.</p>
                        <div className="modal-content">
                            <label htmlFor="stake">Stake (SOL)</label>
                            <input
                                id="stake"
                                type="number"
                                value={stakeAmount}
                                onChange={handleStakeChange}
                                min={minStake}
                                max={maxStake}
                                step={0.01}
                                disabled={isCreatingLobby}
                            />
                            <div className="stake-limits">
                                <p
                                    className={
                                        currentStake < minStake ? 'invalid' : ''
                                    }
                                >
                                    Min stake: {minStake} SOL
                                </p>
                                <p
                                    className={
                                        currentStake > maxStake ? 'invalid' : ''
                                    }
                                >
                                    Max stake: {maxStake.toFixed(4)} SOL
                                </p>
                                <small>
                                    (Max stake is the sum of in-game and
                                    browser wallet balances)
                                </small>
                            </div>
                        </div>
                        <div className="modal-footer">
                            {isCreatingLobby ? (
                                <div className="lobby-spinner"></div>
                            ) : (
                                <Fragment>
                                    <button
                                        onClick={handleCloseModal}
                                        className="cancel-btn"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleCreateLobby}
                                        disabled={!isStakeValid}
                                        className={`confirm-btn ${
                                            !isStakeValid ? 'disabled' : ''
                                        }`}
                                    >
                                        Create Lobby
                                    </button>
                                </Fragment>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Confirmation Modal for Lobby Creation */}
            {showConfirmationModal && (
                <div className="modal-overlay">
                    <div className="modal confirmation-modal">
                        <h3>Confirm Game Creation</h3>
                        <div className="modal-content">
                            <p>
                                Your in-game balance is insufficient to create this game. An additional{' '}
                                <span className="highlight-amount">
                                    {Number(amountNeededFromOnchain.toFixed(4))} SOL
                                </span>{' '}
                                will be transferred from your wallet to cover the stake.
                            </p>
                            <p>Do you want to proceed?</p>
                        </div>
                        <div className="modal-footer">
                            <button
                                onClick={() => setShowConfirmationModal(false)}
                                className="cancel-btn"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={createLobbyTransaction}
                                className="confirm-btn"
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isWithdrawModalOpen && (
                <div className="modal-overlay">
                    <div className="modal">
                        <h3>Withdraw SOL</h3>
                        <p>
                            Enter the amount of SOL you wish to withdraw to your
                            wallet.
                        </p>
                        <div className="modal-content">
                            <label htmlFor="withdraw-amount">Amount (SOL)</label>
                            <input
                                id="withdraw-amount"
                                type="number"
                                value={withdrawAmount}
                                onChange={handleWithdrawAmountChange}
                                min={minWithdraw}
                                max={maxWithdraw}
                                step={0.01}
                                disabled={isWithdrawing}
                            />
                            <div className="withdraw-limits">
                                <p
                                    className={
                                        currentWithdrawAmount < minWithdraw
                                            ? 'invalid'
                                            : ''
                                    }
                                >
                                    Min withdraw: {minWithdraw} SOL
                                </p>
                                <p
                                    className={
                                        currentWithdrawAmount > maxWithdraw
                                            ? 'invalid'
                                            : ''
                                    }
                                >
                                    Max withdraw: {maxWithdraw} SOL
                                </p>
                            </div>
                            <p>
                                Funds will be sent to your wallet address:{' '}
                                <strong>
                                    {publicKey?.toBase58()}
                                </strong>
                            </p>
                        </div>
                        <div className="modal-footer">
                            {isWithdrawing ? (
                                <div className="lobby-spinner"></div>
                            ) : (
                                <Fragment>
                                    <button
                                        onClick={handleCloseWithdrawModal}
                                        className="cancel-btn"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleWithdraw}
                                        disabled={!isWithdrawAmountValid}
                                        className={`confirm-btn ${
                                            !isWithdrawAmountValid
                                                ? 'disabled'
                                                : ''
                                        }`}
                                    >
                                        Withdraw
                                    </button>
                                </Fragment>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {showJoinConfirmationModal && selectedLobby && (
                <div className="modal-overlay">
                    <div className="modal">
                        <h3>Confirm Joining Game</h3>
                        <div className="modal-content">
                            <p>
                                You are about to join {selectedLobby.nickname}'s game with a stake of {' '}
                                <span className="highlight-amount">
                                    {selectedLobby.stake} SOL
                                </span>
                                .
                            </p>
                            <p>
                                {selectedLobby.stake <= ingameBalance
                                    ? 'The stake will be deducted from your in-game balance.'
                                    : (
                                        <>
                                            Your in-game balance is insufficient. An additional{' '}
                                            <span className="highlight-amount">
                                                {Number((selectedLobby.stake - ingameBalance).toFixed(4))}
                                            </span>{' '}
                                            SOL will be transferred from your wallet.
                                        </>
                                    )
                                }
                            </p>
                            {!isJoiningLobby && <p>Do you want to proceed?</p>}
                        </div>
                        <div className="modal-footer">
                            {isJoiningLobby ? (
                                <div className="lobby-spinner"></div>
                            ) : (
                                <>
                                    <button
                                        onClick={() => setShowJoinConfirmationModal(false)}
                                        className="cancel-btn"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleJoinLobbyConfirmation}
                                        className="confirm-btn"
                                    >
                                        Confirm
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ElysiumPage;