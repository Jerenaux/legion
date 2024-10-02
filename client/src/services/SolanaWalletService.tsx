import { apiFetch } from './apiService';
import * as solanaWeb3 from '@solana/web3.js';

class SolanaWalletService {
  private static instance: SolanaWalletService;
  private connection: solanaWeb3.Connection | null = null;
  private walletAddress: string | null = null;
  private balance: number | null = null;

  private constructor() {
    this.initializeConnection();
  }

  public static getInstance(): SolanaWalletService {
    if (!SolanaWalletService.instance) {
      SolanaWalletService.instance = new SolanaWalletService();
    }
    return SolanaWalletService.instance;
  }

  private initializeConnection() {
    // TODO: handle mainnet
    this.connection = new solanaWeb3.Connection(solanaWeb3.clusterApiUrl('devnet'), 'confirmed');
  }

  public async checkWalletConnection(): Promise<boolean> {
    const isSolanaPresent = typeof window.solana !== 'undefined';
    if (isSolanaPresent && window.solana) {
      try {
        const savedWalletAddress = localStorage.getItem('walletAddress');
        if (savedWalletAddress) {
          await window.solana.connect();
          this.walletAddress = savedWalletAddress;
          await this.updateBalance();
          return true;
        }
      } catch (error) {
        console.error('Error reconnecting to saved wallet:', error);
        localStorage.removeItem('walletAddress');
      }
    }
    return false;
  }

  private registerAddress(address) {
    apiFetch('registerAddress', {
        method: 'POST',
        body: {
            address
        }
    });
  }

  public async connectWallet(): Promise<boolean> {
    if (typeof window.solana !== 'undefined' && window.solana) {
      try {
        const { publicKey } = await window.solana.connect();
        this.walletAddress = publicKey.toString();
        localStorage.setItem('walletAddress', this.walletAddress);
        this.registerAddress(publicKey.toString());
        await this.updateBalance();
        return true;
      } catch (error) {
        console.error('Error connecting to Solana wallet:', error);
        return false;
      }
    }
    return false;
  }

  public async disconnectWallet(): Promise<void> {
    if (typeof window.solana !== 'undefined' && window.solana) {
      try {
        await window.solana.disconnect();
        this.walletAddress = null;
        this.balance = null;
        localStorage.removeItem('walletAddress');
      } catch (error) {
        console.error('Error disconnecting Solana wallet:', error);
      }
    }
  }

  private async updateBalance(): Promise<void> {
    if (this.connection && this.walletAddress) {
      try {
        const publicKey = new solanaWeb3.PublicKey(this.walletAddress);
        const balance = await this.connection.getBalance(publicKey);
        this.balance = balance / solanaWeb3.LAMPORTS_PER_SOL;
      } catch (error) {
        console.error('Error fetching Solana balance:', error);
      }
    }
  }

  public getWalletAddress(): string | null {
    return this.walletAddress;
  }

  public getBalance(): number | null {
    return this.balance;
  }

  public isWalletConnected(): boolean {
    return this.walletAddress !== null;
  }

  public isWalletDetected(): boolean {
    return typeof window.solana !== 'undefined';
  }
}

export default SolanaWalletService;