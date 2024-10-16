import { h, FunctionComponent } from 'preact';
import { useMemo } from 'preact/hooks';
import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import '@solana/wallet-adapter-react-ui/styles.css';
import { RPC } from '@legion/shared/config';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';

const WalletContextProvider: FunctionComponent = ({ children }) => {
  const endpoint = RPC;
  
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter({
        appIdentity: {
          name: "Legion",
          icon: "https://www.play-legion.io/favicon.ico",
          uri: "https://www.play-legion.io"
        }
      })
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

export default WalletContextProvider;