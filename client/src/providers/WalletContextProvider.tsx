import { h, FunctionComponent } from 'preact';
import { useMemo } from 'preact/hooks';
import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import '@solana/wallet-adapter-react-ui/styles.css';
import { RPC } from '@legion/shared/config';

const WalletContextProvider: FunctionComponent = ({ children }) => {
    console.log(`Provider: ${RPC}`);
  const endpoint = RPC;
  
  const wallets = useMemo(
    () => [], []
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
