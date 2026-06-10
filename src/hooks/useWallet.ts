import { useEffect, useState } from 'react';
import {
  connectWallet,
  disconnectWallet,
  getAddress,
  hasInjectedWallet,
  onWalletChange,
} from '../utils/wallet';

/** React view over the injected-wallet connection state. */
export function useWallet() {
  const [address, setAddress] = useState<string | null>(() => getAddress());
  const [connecting, setConnecting] = useState(false);

  useEffect(() => onWalletChange(setAddress), []);

  const connect = async () => {
    setConnecting(true);
    try {
      await connectWallet();
    } finally {
      setConnecting(false);
    }
  };

  return {
    address,
    connecting,
    available: hasInjectedWallet(),
    connect,
    disconnect: disconnectWallet,
  };
}
