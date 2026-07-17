"use client";

import { useAccount, useReadContract } from "wagmi";
import { RecipientStreamCard } from "@/components/recipient/RecipientStreamCard";
import { erc20Abi } from "@/lib/abi/erc20";
import { USDC_ADDRESS } from "@/lib/contracts";
import { useNow, useStreams } from "@/lib/hooks";
import { accruedBalance, formatUsdc, formatUsdcLive } from "@/lib/stream-math";

export default function RecipientDashboard() {
  const { address, isConnected } = useAccount();
  const now = useNow();
  const { streams, isLoading, refetch } = useStreams("recipient", address);

  const walletUsdc = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 15_000 },
  });

  if (!isConnected) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center text-muted">
        Connect your wallet to see your incoming streams.
      </div>
    );
  }

  const totalAccrued = streams.reduce(
    (sum, s) => sum + accruedBalance(s, now),
    0n
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Your Earnings</h1>

      <div className="mb-6 rounded-xl bg-primary p-6 text-white">
        <div className="text-sm font-medium uppercase tracking-wide text-white/60">
          Total streaming to you now
        </div>
        <div className="amount mt-1 text-4xl font-bold">
          ${formatUsdcLive(totalAccrued)}
        </div>
        <div className="mt-2 text-sm text-white/70">
          Wallet balance:{" "}
          <span className="amount">
            ${walletUsdc.data !== undefined ? formatUsdc(walletUsdc.data) : "—"} USDC
          </span>{" "}
          — on Arc your USDC also pays your gas.
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted">Loading streams…</p>
      ) : streams.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-10 text-center text-muted">
          No streams yet. Ask your employer to start one to{" "}
          <span className="amount">{address}</span>
        </div>
      ) : (
        <div className="space-y-4">
          {[...streams]
            .sort((a, b) => Number(b.id - a.id))
            .map((s) => (
              <RecipientStreamCard
                key={s.id.toString()}
                stream={s}
                onChanged={() => {
                  refetch();
                  walletUsdc.refetch();
                }}
              />
            ))}
        </div>
      )}
    </div>
  );
}
