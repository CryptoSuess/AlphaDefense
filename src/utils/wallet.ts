/**
 * Minimal injected-wallet (EIP-1193) integration targeting Base mainnet.
 *
 * Works with any injected provider (Coinbase Wallet, MetaMask, Rabby...).
 * Deliberately dependency-free: when deeper on-chain features land (NFT skin
 * reads, tournament entries), this is the file to replace with wagmi/viem —
 * the `WalletProvider` interface in integrations.ts stays the same.
 */

/** Base mainnet chain id (8453). */
const BASE_CHAIN_ID_HEX = '0x2105';

const BASE_CHAIN_PARAMS = {
  chainId: BASE_CHAIN_ID_HEX,
  chainName: 'Base',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: ['https://mainnet.base.org'],
  blockExplorerUrls: ['https://basescan.org'],
};

interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, handler: (...args: unknown[]) => void): void;
  removeListener?(event: string, handler: (...args: unknown[]) => void): void;
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

export type WalletListener = (address: string | null) => void;

let address: string | null = null;
const listeners = new Set<WalletListener>();
let accountsHandlerBound = false;

function notify(): void {
  for (const l of listeners) l(address);
}

function handleAccountsChanged(...args: unknown[]): void {
  const accounts = (args[0] as string[] | undefined) ?? [];
  address = accounts[0] ?? null;
  notify();
}

/** True when an injected wallet extension is present. */
export function hasInjectedWallet(): boolean {
  return typeof window !== 'undefined' && Boolean(window.ethereum);
}

export function getAddress(): string | null {
  return address;
}

/** Subscribe to address changes; returns an unsubscribe function. */
export function onWalletChange(listener: WalletListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Requests accounts and switches the wallet to Base (adding the chain if the
 * wallet doesn't know it). Returns the connected address, or null when no
 * injected wallet exists / the user rejected.
 */
export async function connectWallet(): Promise<string | null> {
  const eth = typeof window !== 'undefined' ? window.ethereum : undefined;
  if (!eth) return null;
  try {
    const accounts = (await eth.request({ method: 'eth_requestAccounts' })) as string[];
    address = accounts[0] ?? null;
    if (!address) return null;

    try {
      await eth.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: BASE_CHAIN_ID_HEX }],
      });
    } catch (err) {
      // 4902 = chain not added to the wallet yet.
      if ((err as { code?: number }).code === 4902) {
        await eth.request({ method: 'wallet_addEthereumChain', params: [BASE_CHAIN_PARAMS] });
      }
      // Other switch errors (user rejected the switch) are non-fatal:
      // the address is still connected, just possibly on another chain.
    }

    if (eth.on && !accountsHandlerBound) {
      eth.on('accountsChanged', handleAccountsChanged);
      accountsHandlerBound = true;
    }
    notify();
    return address;
  } catch {
    return null; // user rejected the connect prompt
  }
}

/**
 * "Disconnects" by forgetting the address locally. Injected wallets have no
 * programmatic disconnect; the user revokes access from the extension.
 */
export async function disconnectWallet(): Promise<void> {
  address = null;
  notify();
}

/**
 * Requests an EIP-191 `personal_sign` of `message` from the connected wallet.
 * Returns the 65-byte hex signature (0x…), or null when there's no wallet or
 * the user rejects the prompt. Used to prove wallet ownership of a score.
 */
export async function signMessage(message: string): Promise<string | null> {
  const eth = typeof window !== 'undefined' ? window.ethereum : undefined;
  if (!eth || !address) return null;
  try {
    const sig = await eth.request({ method: 'personal_sign', params: [message, address] });
    return typeof sig === 'string' ? sig : null;
  } catch {
    return null; // user rejected the signature prompt
  }
}

/** 0x1234…abcd display form. */
export function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
