"use client";

import sdk from "@farcaster/miniapp-sdk";

export type EthereumProvider = {
  request: (args: {
    method: string;
    params?: unknown[] | object;
  }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (
    event: string,
    listener: (...args: unknown[]) => void,
  ) => void;
};

export type WalletProvider = {
  id: string;
  name: string;
  icon?: string;
  rdns?: string;
  provider: EthereumProvider;
};

type Eip6963ProviderDetail = {
  info: {
    uuid: string;
    name: string;
    icon: string;
    rdns: string;
  };
  provider: EthereumProvider;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }

  interface WindowEventMap {
    "eip6963:announceProvider": CustomEvent<Eip6963ProviderDetail>;
  }
}

async function getFarcasterProvider(): Promise<WalletProvider | null> {
  try {
    const inMiniApp = await Promise.race([
      sdk.isInMiniApp(),
      new Promise<boolean>((resolve) =>
        setTimeout(() => resolve(false), 1200),
      ),
    ]);

    if (!inMiniApp) {
      return null;
    }

    const provider = await Promise.race([
      sdk.wallet.getEthereumProvider(),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), 1500),
      ),
    ]);

    if (!provider) {
      return null;
    }

    return {
      id: "farcaster-native-wallet",
      name: "Farcaster Wallet",
      rdns: "Farcaster Mini App",
      provider: provider as EthereumProvider,
    };
  } catch {
    return null;
  }
}

export async function discoverWallets(
  timeoutMs = 700,
): Promise<WalletProvider[]> {
  if (typeof window === "undefined") {
    return [];
  }

  const farcaster = await getFarcasterProvider();

  if (farcaster) {
    return [farcaster];
  }

  return new Promise((resolve) => {
    const wallets = new Map<string, WalletProvider>();

    const onProvider = (
      event: WindowEventMap["eip6963:announceProvider"],
    ) => {
      const { info, provider } = event.detail;

      wallets.set(info.uuid, {
        id: info.uuid,
        name: info.name,
        icon: info.icon,
        rdns: info.rdns,
        provider,
      });
    };

    window.addEventListener(
      "eip6963:announceProvider",
      onProvider,
    );

    window.dispatchEvent(
      new Event("eip6963:requestProvider"),
    );

    setTimeout(() => {
      window.removeEventListener(
        "eip6963:announceProvider",
        onProvider,
      );

      if (wallets.size === 0 && window.ethereum) {
        wallets.set("injected-wallet", {
          id: "injected-wallet",
          name: "Browser Wallet",
          provider: window.ethereum,
        });
      }

      resolve(Array.from(wallets.values()));
    }, timeoutMs);
  });
}

export async function getEthereumProvider(): Promise<EthereumProvider | null> {
  const wallets = await discoverWallets();

  return wallets[0]?.provider ?? null;
}

export async function connectWallet(
  provider: EthereumProvider,
): Promise<`0x${string}`> {
  await provider.request({
    method: "eth_requestAccounts",
  });

  const accounts = (await provider.request({
    method: "eth_accounts",
  })) as string[];

  const account = accounts[0];

  if (!account?.startsWith("0x")) {
    throw new Error("No wallet account was returned.");
  }

  return account as `0x${string}`;
}

export async function getConnectedAccount(
  provider: EthereumProvider,
): Promise<`0x${string}` | null> {
  const accounts = (await provider.request({
    method: "eth_accounts",
  })) as string[];

  const account = accounts[0];

  if (!account?.startsWith("0x")) {
    return null;
  }

  return account as `0x${string}`;
}