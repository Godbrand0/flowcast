"use client";

import { useState } from "react";
import { usePublicClient, useWriteContract } from "wagmi";
import { streamVaultAbi } from "@/lib/abi/streamVault";
import { STREAM_VAULT_ADDRESS, Stream, StreamStatus } from "@/lib/contracts";
import {
  formatDuration,
  formatUsdc,
  ratePerDay,
  secondsRemaining,
  shortAddress,
  streamProgress,
  vestedAmount,
} from "@/lib/stream-math";
import { useNow } from "@/lib/hooks";

const statusStyle: Record<StreamStatus, string> = {
  [StreamStatus.Active]: "bg-accent/10 text-accent",
  [StreamStatus.Paused]: "bg-warning/10 text-warning",
  [StreamStatus.Cancelled]: "bg-error/10 text-error",
  [StreamStatus.Completed]: "bg-primary/10 text-primary",
};

const statusLabel: Record<StreamStatus, string> = {
  [StreamStatus.Active]: "Active",
  [StreamStatus.Paused]: "Paused",
  [StreamStatus.Cancelled]: "Cancelled",
  [StreamStatus.Completed]: "Completed",
};

export function StreamRow({
  stream,
  onChanged,
}: {
  stream: Stream & { id: bigint };
  onChanged: () => void;
}) {
  const now = useNow();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [busy, setBusy] = useState<string | null>(null);

  const progress = streamProgress(stream, now);
  const vested = vestedAmount(stream, now);

  async function call(fn: "pauseStream" | "resumeStream" | "cancelStream") {
    if (!publicClient) return;
    setBusy(fn);
    try {
      const hash = await writeContractAsync({
        address: STREAM_VAULT_ADDRESS,
        abi: streamVaultAbi,
        functionName: fn,
        args: [stream.id],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      onChanged();
    } catch {
      // user rejected or tx reverted — leave state as-is
    } finally {
      setBusy(null);
    }
  }

  const isLive =
    stream.status === StreamStatus.Active || stream.status === StreamStatus.Paused;

  return (
    <div className="border-b border-border p-4 last:border-b-0">
      <div className="flex items-center justify-between">
        <div className="amount text-sm font-medium">
          {shortAddress(stream.recipient)}
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle[stream.status]}`}
        >
          {statusLabel[stream.status]}
        </span>
      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-border">
        <div
          className={stream.status === StreamStatus.Active ? "stream-fill h-full" : "h-full bg-primary/40"}
          style={{ width: `${Math.min(100, progress)}%` }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-sm text-muted">
        <span className="amount">
          ${formatUsdc(vested)} / ${formatUsdc(stream.deposit)} · $
          {ratePerDay(stream).toFixed(2)}/day
        </span>
        <span>
          {stream.status === StreamStatus.Active
            ? formatDuration(secondsRemaining(stream, now))
            : ""}
        </span>
      </div>

      {isLive && (
        <div className="mt-3 flex gap-2">
          {stream.status === StreamStatus.Active ? (
            <button
              onClick={() => call("pauseStream")}
              disabled={busy !== null}
              className="rounded-md border border-border px-3 py-1 text-xs font-medium hover:border-warning hover:text-warning disabled:opacity-50"
            >
              {busy === "pauseStream" ? "…" : "Pause"}
            </button>
          ) : (
            <button
              onClick={() => call("resumeStream")}
              disabled={busy !== null}
              className="rounded-md border border-border px-3 py-1 text-xs font-medium hover:border-accent hover:text-accent disabled:opacity-50"
            >
              {busy === "resumeStream" ? "…" : "Resume"}
            </button>
          )}
          {stream.cancelable && (
            <button
              onClick={() => call("cancelStream")}
              disabled={busy !== null}
              className="rounded-md border border-border px-3 py-1 text-xs font-medium hover:border-error hover:text-error disabled:opacity-50"
            >
              {busy === "cancelStream" ? "…" : "Cancel"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
