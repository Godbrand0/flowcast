"use client";

import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { arcTestnet } from "@/lib/wagmi";
import { shortAddress } from "@/lib/stream-math";

export function ConnectButton() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  if (!isConnected) {
    return (
      <button
        onClick={() => connect({ connector: connectors[0] })}
        disabled={isPending}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
      >
        {isPending ? "Connecting…" : "Connect Wallet"}
      </button>
    );
  }

  if (chainId !== arcTestnet.id) {
    return (
      <button
        onClick={() => switchChain({ chainId: arcTestnet.id })}
        className="rounded-lg bg-warning px-4 py-2 text-sm font-medium text-white hover:opacity-90"
      >
        Switch to Arc Testnet
      </button>
    );
  }

  return (
    <button
      onClick={() => disconnect()}
      title="Disconnect"
      className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium hover:border-primary"
    >
      <span className="mr-2 inline-block h-2 w-2 rounded-full bg-accent" />
      {shortAddress(address!)}
    </button>
  );
}
