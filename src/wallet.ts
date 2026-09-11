/**
 * Browser wallet layer.
 *
 * genlayer-js only routes signing methods through an injected wallet when the
 * client is built with an *address* instead of an account object, so every
 * helper here hands back a plain address plus the provider that announced it.
 *
 * Discovery is EIP-6963 first. A browser with two injected wallets has to let
 * the operator pick the one holding the registering key; reading whichever
 * extension won the `window.ethereum` race picks for them, silently and wrong.
 * The legacy injected provider is still surfaced, but only as a last resort.
 */

import { gavelChains, type Network } from './client.ts';

export type WalletEventListener = (...payload: readonly unknown[]) => void;

/** Structural EIP-1193 surface. The SDK builds without DOM lib, so nothing here
 * may reference `window`, `Event`, or any other browser global type. */
export type Eip1193Provider = {
  request(args: { method: string; params?: readonly unknown[] }): Promise<unknown>;
  on?(event: string, listener: WalletEventListener): void;
  removeListener?(event: string, listener: WalletEventListener): void;
};

/** EIP-6963 `EIP6963ProviderInfo`. */
export type WalletInfo = { uuid: string; name: string; icon: string; rdns: string };
export type DiscoveredWallet = { info: WalletInfo; provider: Eip1193Provider };

/** The part of `window` discovery touches, so tests can pass an `EventTarget`. */
export type WalletScope = {
  addEventListener(type: string, listener: (event: unknown) => void): void;
  removeEventListener(type: string, listener: (event: unknown) => void): void;
  dispatchEvent(event: unknown): boolean;
  ethereum?: Eip1193Provider;
};

export const ANNOUNCE_EVENT = 'eip6963:announceProvider';
export const REQUEST_EVENT = 'eip6963:requestProvider';

/** Identifies the synthetic entry built from a legacy `window.ethereum`. */
export const INJECTED_RDNS = 'org.gavel.injected';

function browserScope(): WalletScope | null {
  return typeof globalThis === 'object' && 'addEventListener' in globalThis
    ? (globalThis as unknown as WalletScope)
    : null;
}

function isProvider(value: unknown): value is Eip1193Provider {
  return Boolean(value) && typeof (value as Eip1193Provider).request === 'function';
}

/** Announcements come from page scripts, so treat every field as untrusted and
 * drop the record rather than rendering a wallet with a half-valid identity. */
function readAnnouncement(event: unknown): DiscoveredWallet | null {
  const detail = (event as { detail?: unknown } | null)?.detail as
    | { info?: Partial<WalletInfo>; provider?: unknown }
    | undefined;
  if (!detail || !isProvider(detail.provider)) return null;
  const { icon, name, rdns, uuid } = detail.info ?? {};
  if (typeof name !== 'string' || typeof rdns !== 'string' || typeof uuid !== 'string') return null;
  if (!name.trim() || !rdns.trim() || !uuid.trim()) return null;
  return {
    info: { icon: typeof icon === 'string' ? icon : '', name: name.trim(), rdns: rdns.trim(), uuid: uuid.trim() },
    provider: detail.provider,
  };
}

/**
 * Subscribes to EIP-6963 announcements and asks wallets to re-announce.
 *
 * Wallets announce whenever they load, so `onWallet` can fire well after the
 * initial request. Returns an unsubscribe function; callers must call it on
 * unmount or the listener outlives the page it was rendered for.
 */
export function discoverWallets(onWallet: (wallet: DiscoveredWallet) => void, scope?: WalletScope): () => void {
  const target = scope ?? browserScope();
  if (!target) return () => undefined;

  const seen = new Set<string>();
  const listener = (event: unknown) => {
    const wallet = readAnnouncement(event);
    // Wallets re-announce on every request event; dedupe by rdns so a second
    // pass does not push a duplicate row into the picker.
    if (!wallet || seen.has(wallet.info.rdns)) return;
    seen.add(wallet.info.rdns);
    onWallet(wallet);
  };

  target.addEventListener(ANNOUNCE_EVENT, listener);
  target.dispatchEvent(new Event(REQUEST_EVENT));
  return () => target.removeEventListener(ANNOUNCE_EVENT, listener);
}

/** A legacy `window.ethereum` wrapped as a discovery result, or null. Offer this
 * only when EIP-6963 announced nothing: it cannot say which wallet it is. */
export function injectedWallet(scope?: WalletScope): DiscoveredWallet | null {
  const target = scope ?? browserScope();
  const provider = target?.ethereum;
  if (!isProvider(provider)) return null;
  return { info: { icon: '', name: 'Injected wallet', rdns: INJECTED_RDNS, uuid: INJECTED_RDNS }, provider };
}

export function isWalletAddress(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value);
}

function firstAddress(raw: unknown): `0x${string}` | null {
  const candidate = Array.isArray(raw) ? raw[0] : undefined;
  return isWalletAddress(candidate) ? (candidate.toLowerCase() as `0x${string}`) : null;
}

/** Accounts already authorized for this origin. Never prompts, so it is safe to
 * call on load to restore a previous session. */
export async function readAccount(provider: Eip1193Provider): Promise<`0x${string}` | null> {
  return firstAddress(await provider.request({ method: 'eth_accounts' }));
}

/** Prompts the wallet for access. Throws if the operator rejects or the wallet
 * returns no usable account. */
export async function requestAccount(provider: Eip1193Provider): Promise<`0x${string}`> {
  const address = firstAddress(await provider.request({ method: 'eth_requestAccounts' }));
  if (!address) throw new Error('The wallet returned no account. Unlock it and try again.');
  return address;
}

export async function readChainId(provider: Eip1193Provider): Promise<number | null> {
  const raw = await provider.request({ method: 'eth_chainId' });
  const parsed = typeof raw === 'string' ? Number.parseInt(raw, 16) : typeof raw === 'number' ? raw : Number.NaN;
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function chainForNetwork(network: Network) {
  const chain = gavelChains[network];
  if (!chain) throw new Error(`Unsupported GenLayer network: ${network}`);
  return chain;
}

/**
 * Whether the wallet has to sit on this network's chain before it can sign.
 *
 * Studio networks (localnet, studionet) proxy transactions through the Studio
 * RPC and genlayer-js skips its own chain assertion for them, so demanding a
 * chain switch there would block signing that actually works.
 */
export function requiresChainSwitch(network: Network): boolean {
  return !chainForNetwork(network).isStudio;
}

/** Wallets bury the JSON-RPC code at different depths; 4902 in particular. */
function errorCode(error: unknown): number | null {
  const seen = new Set<unknown>();
  let node: unknown = error;
  while (node && typeof node === 'object' && !seen.has(node)) {
    seen.add(node);
    const code = (node as { code?: unknown }).code;
    if (typeof code === 'number') return code;
    node = (node as { data?: unknown; cause?: unknown }).data ?? (node as { cause?: unknown }).cause;
  }
  return null;
}

/**
 * Moves the wallet onto the network's chain, registering it first when the
 * wallet has never seen it (4902). Resolves without prompting on studio
 * networks and when the wallet is already there.
 */
export async function ensureChain(provider: Eip1193Provider, network: Network): Promise<void> {
  if (!requiresChainSwitch(network)) return;
  const chain = chainForNetwork(network);
  if ((await readChainId(provider)) === chain.id) return;

  const chainId = `0x${chain.id.toString(16)}`;
  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId }] });
  } catch (error) {
    if (errorCode(error) !== 4902) throw error;
    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          blockExplorerUrls: chain.blockExplorers?.default.url ? [chain.blockExplorers.default.url] : undefined,
          chainId,
          chainName: chain.name,
          nativeCurrency: chain.nativeCurrency,
          rpcUrls: [...chain.rpcUrls.default.http],
        },
      ],
    });
  }
}

/** Subscribes to wallet account and chain changes. Returns an unsubscribe
 * function; a provider without `on` yields a no-op rather than throwing. */
export function watchWallet(
  provider: Eip1193Provider,
  handlers: { onAccount?: (address: `0x${string}` | null) => void; onChain?: (chainId: number | null) => void },
): () => void {
  if (typeof provider.on !== 'function') return () => undefined;

  const onAccounts: WalletEventListener = (...payload) => handlers.onAccount?.(firstAddress(payload[0]));
  const onChain: WalletEventListener = (...payload) => {
    const raw = payload[0];
    const parsed = typeof raw === 'string' ? Number.parseInt(raw, 16) : Number.NaN;
    handlers.onChain?.(Number.isSafeInteger(parsed) ? parsed : null);
  };

  provider.on('accountsChanged', onAccounts);
  provider.on('chainChanged', onChain);
  return () => {
    provider.removeListener?.('accountsChanged', onAccounts);
    provider.removeListener?.('chainChanged', onChain);
  };
}

/**
 * A message worth showing next to a button.
 *
 * A rejected signature is an ordinary outcome, not a failure of the protocol,
 * so it reads as one. Anything unrecognized keeps the wallet's own text: it is
 * more specific than any wording invented here.
 */
export function describeWalletError(error: unknown): string {
  const code = errorCode(error);
  if (code === 4001) return 'Request rejected in the wallet.';
  if (code === 4100) return 'The wallet has not authorized this account for signing.';
  if (code === 4900 || code === 4901) return 'The wallet is disconnected from the network.';
  if (code === -32002) return 'The wallet already has a pending request. Open it to continue.';
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return message.trim() || 'The wallet rejected the request without a reason.';
}
