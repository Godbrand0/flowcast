"use client";

import Link from "next/link";
import { useState } from "react";
import { usePublicClient, useWriteContract } from "wagmi";
import { streamVaultAbi } from "@/lib/abi/streamVault";
import { executeCircleChallenge } from "@/lib/circle-wallets-client";
import { STREAM_VAULT_ADDRESS, Stream, StreamStatus } from "@/lib/contracts";
import { useNow } from "@/lib/hooks";
import {
  accruedBalance,
  formatDuration,
  formatUsdc,
  formatUsdcLive,
  ratePerHour,
  secondsRemaining,
  shortAddress,
  streamProgress,
} from "@/lib/stream-math";

export function RecipientStreamCard({
  stream,
  onChanged,
  circleAccessToken,
}: {
  stream: Stream & { id: bigint };
  onChanged: () => void;
  /** Present when the recipient signed in via Google + Circle wallet instead
   *  of connecting a wallet directly — routes withdraw through Circle's PIN
   *  challenge instead of a wagmi signature. */
  circleAccessToken?: string;
}) {
  const now = useNow();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accrued = accruedBalance(stream, now);
  const progress = streamProgress(stream, now);
  const isPaused = stream.status === StreamStatus.Paused;
  const done =
    stream.status === StreamStatus.Completed ||
    stream.status === StreamStatus.Cancelled;

  async function withdraw() {
    setBusy(true);
    setError(null);
    try {
      if (circleAccessToken) {
        const res = await fetch("/api/recipients/withdraw-challenge", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${circleAccessToken}`,
          },
          body: JSON.stringify({ streamId: stream.id.toString() }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Withdraw failed");
        await executeCircleChallenge(data.challengeId, data.userToken, data.encryptionKey);
      } else {
        if (!publicClient) return;
        const hash = await writeContractAsync({
          address: STREAM_VAULT_ADDRESS,
          abi: streamVaultAbi,
          functionName: "withdraw",
          args: [stream.id],
        });
        await publicClient.waitForTransactionReceipt({ hash });
      }
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message.split("\n")[0] : "Transaction failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">
          Stream from{" "}
          <span className="amount font-medium text-foreground">
            {shortAddress(stream.business)}
          </span>
        </span>
        {isPaused && (
          <span className="rounded-full bg-warning/10 px-2.5 py-0.5 text-xs font-medium text-warning">
            Paused
          </span>
        )}
        {done && (
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            {stream.status === StreamStatus.Completed ? "Completed" : "Cancelled"}
          </span>
        )}
      </div>

      {!done && (
        <>
          <div className="amount mt-4 text-4xl font-bold tracking-tight">
            ${formatUsdcLive(accrued)}
            <span className="ml-2 text-base font-medium text-muted">USDC</span>
          </div>
          <p className="mt-1 text-sm text-muted">
            Available to withdraw
            {!isPaused && (
              <>
                {" "}
                · earning{" "}
                <span className="text-accent">
                  ${ratePerHour(stream).toFixed(2)}/hour
                </span>
              </>
            )}
          </p>
        </>
      )}

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-border">
        <div
          className={
            stream.status === StreamStatus.Active
              ? "stream-fill h-full"
              : "h-full bg-primary/40"
          }
          style={{ width: `${Math.min(100, progress)}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-sm text-muted">
        <span className="amount">
          ${formatUsdc(stream.withdrawn)} withdrawn of ${formatUsdc(stream.deposit)}
        </span>
        <span>
          {stream.status === StreamStatus.Active
            ? formatDuration(secondsRemaining(stream, now))
            : ""}
        </span>
      </div>

      {!done && (
        <div className="mt-5 flex gap-3">
          <button
            onClick={withdraw}
            disabled={busy || accrued === 0n}
            className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {busy ? "Withdrawing…" : "Withdraw to Wallet"}
          </button>
          <Link
            href="/recipient/cashout"
            className="flex-1 rounded-lg border border-border px-4 py-2.5 text-center text-sm font-medium hover:border-primary hover:text-primary"
          >
            Cash Out to Bank
          </Link>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-error">{error}</p>}
    </div>
  );
}
