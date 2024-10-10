// ElysiumPage.tsx
import { h, Fragment } from 'preact';
import { useState, useEffect, useContext } from 'preact/hooks';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { PlayerContext } from '../contexts/PlayerContext';
import { apiFetch } from '../services/apiService';
import { Token } from '@legion/shared/enums';
import { errorToast } from './utils';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import {
    LAMPORTS_PER_SOL,
    PublicKey,
    Transaction,
    SystemProgram,
} from '@solana/web3.js';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { GAME_WALLET } from '@legion/shared/config';


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
    const [stakeAmount, setStakeAmount] = useState('0.01');
    const [onchainBalance, setOnchainBalance] = useState(0);
    const [registeredAddress, setRegisteredAddress] = useState<string | null>(null);

    const { connected, publicKey, wallets, sendTransaction } = useWallet();
    const { connection } = useConnection();
    const playerContext = useContext(PlayerContext);

    const ingameBalance = playerContext.player.tokens?.[Token.SOL] || 0;

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
                    No lobbies are currently available.
                </div>
            );
        }

        return lobbies.map((lobby) => (
            <div key={lobby.id} className="lobby-item">
                <img
                    src={lobby.avatar}
                    alt={`${lobby.nickname}'s avatar`}
                    className="lobby-avatar"
                />
                <div className="lobby-info">
                    <h3>{lobby.nickname}</h3>
                    <p>ELO: {lobby.elo}</p>
                    <p>
                        {lobby.league} - {lobby.rank}
                    </p>
                    <p>Stake: {lobby.stake} SOL</p>
                </div>
            </div>
        ));
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

        setIsCreatingLobby(true);

        try {
            const amountNeededFromOnchain = stake - ingameBalance;
            let transactionSignature = null;

            if (amountNeededFromOnchain > 0) {
                if (onchainBalance >= amountNeededFromOnchain) {
                    // Initiate a transaction to transfer the difference
                    const gamePublicKey = new PublicKey(GAME_WALLET);

                    const transaction = new Transaction().add(
                        SystemProgram.transfer({
                            fromPubkey: publicKey!,
                            toPubkey: gamePublicKey,
                            lamports: Math.round(
                                amountNeededFromOnchain * LAMPORTS_PER_SOL
                            ),
                        })
                    );

                    // Send the transaction
                    transactionSignature = await sendTransaction(
                        transaction,
                        connection
                    );
                    console.log(`Transaction signature: ${transactionSignature}`);

                    // Update onchainBalance
                    setOnchainBalance(
                        (prevBalance) => prevBalance - amountNeededFromOnchain
                    );

                    playerContext.refreshPlayerData();
                } else {
                    // Not enough balance on-chain
                    errorToast(
                        'Not enough balance in your wallet to cover the stake difference.'
                    );
                    setIsCreatingLobby(false);
                    return;
                }
            }

            // Proceed to create the lobby
            await apiFetch('createLobby', {
                method: 'POST',
                body: {
                    stake,
                    transactionSignature,
                    playerAddress: publicKey.toBase58(),
                },
            });
            setIsModalOpen(false);
            setIsCreatingLobby(false);
            playerContext.refreshPlayerData();
            fetchLobbies();
        } catch (error) {
            errorToast('Error creating lobby: ' + (error.message || error));
            setIsCreatingLobby(false);
        }
    };

    const minStake = 0.01;
    const maxStake = ingameBalance + onchainBalance;
    const currentStake = parseFloat(stakeAmount);
    const isStakeValid =
        currentStake >= minStake &&
        currentStake <= maxStake &&
        !isNaN(currentStake);

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
            {/* Always display the WalletMultiButton */}
            <div className="wallet-button-container">
                <WalletMultiButton />
            </div>

            {/* Rest of your page content */}
            <h2 className="lobbies-header">Available Lobbies</h2>
            {/* Disable the "Create Lobby" button if not connected */}
            <button
                onClick={handleOpenModal}
                className="create-lobby-btn"
                disabled={!connected}
            >
                Create Lobby
            </button>
            <div className="lobbies-container">
                {isLoadingLobbies ? renderLobbySkeletons() : renderLobbies()}
            </div>

            {connected && (
                <div className="wallet-info">
                    <p>Address: {publicKey?.toBase58()}</p>
                    <p>In-game balance: {ingameBalance} SOL</p>
                    <p>On-chain balance: {onchainBalance.toFixed(4)} SOL</p>
                </div>
            )}

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
                                    Max stake: {maxStake} SOL
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
        </div>
    );
};

export default ElysiumPage;
