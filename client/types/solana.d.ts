import * as solanaWeb3 from '@solana/web3.js';

declare global {
  interface Window {
    solana?: {
      isPhantom?: boolean;
      connect: () => Promise<{ publicKey: solanaWeb3.PublicKey }>;
      disconnect: () => Promise<void>;
      on: (event: string, callback: () => void) => void;
      off: (event: string, callback: () => void) => void;
      isConnected: boolean;
      publicKey: solanaWeb3.PublicKey;
    };
  }
}