"use client";

import { useEffect, useState } from "react";
import { usePublicClient, useWriteContract } from "wagmi";
import { isAddress } from "viem";
import { streamVaultAbi } from "@/lib/abi/streamVault";
import { STREAM_VAULT_ADDRESS } from "@/lib/contracts";
import { formatUsdc, parseUsdc } from "@/lib/stream-math";
import type { Recipient } from "@/lib/types";

type DurationUnit = "minutes" | "hours" | "days";

const UNIT_SECONDS: Record<DurationUnit, number> = {
  minutes: 60,
  hours: 3_600,
  days: 86_400,
};

export function CreateStreamForm({
  onCreated,
  recipients = [],
  initialRecipient,
}: {
  onCreated: () => void;
  recipients?: Recipient[];
  initialRecipient?: string;
}) {
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [useDirectory, setUseDirectory] = useState(recipients.length > 0);
  const [recipient, setRecipient] = useState(initialRecipient ?? "");

  useEffect(() => {
    if (initialRecipient) setRecipient(initialRecipient);
  }, [initialRecipient]);
  const [amount, setAmount] = useState("");
  const [duration, setDuration] = useState("30");
  const [unit, setUnit] = useState<DurationUnit>("days");
  const [cancelable, setCancelable] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedAmount = parseUsdc(amount);
  const parsedDuration = Number(duration);
  const durationSeconds = Math.floor(parsedDuration * UNIT_SECONDS[unit]);
  const valid =
    isAddress(recipient) &&
    parsedAmount !== null &&
    parsedAmount > 0n &&
    Number.isFinite(parsedDuration) &&
    parsedDuration > 0 &&
    durationSeconds > 0;

  const ratePerSecond =
    valid && parsedAmount ? parsedAmount / BigInt(durationSeconds) : 0n;

  async function submit() {
    if (!valid || !publicClient || parsedAmount === null) return;
    setBusy(true);
    setError(null);
    try {
      const endTime = Math.floor(Date.now() / 1000) + durationSeconds;
      const hash = await writeContractAsync({
        address: STREAM_VAULT_ADDRESS,
        abi: streamVaultAbi,
        functionName: "createStream",
        args: [recipient as `0x${string}`, parsedAmount, endTime, cancelable],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      setRecipient("");
      setAmount("");
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message.split("\n")[0] : "Transaction failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <h2 className="mb-4 text-lg font-semibold">New Stream</h2>

      <div className="mb-1 flex items-center justify-between">
        <label className="block text-sm font-medium">Recipient</label>
        {recipients.length > 0 && (
          <button
            type="button"
            onClick={() => setUseDirectory((v) => !v)}
            className="text-xs text-primary hover:underline"
          >
            {useDirectory ? "paste an address instead" : "choose from team"}
          </button>
        )}
      </div>
      {useDirectory && recipients.length > 0 ? (
        <>
          <select
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            className="mb-1 w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none"
          >
            <option value="">Select from your team…</option>
            {recipients.map((r) => (
              <option
                key={r.id}
                value={r.wallet_address ?? r.id}
                disabled={!r.wallet_address}
              >
                {r.full_name || r.email}
                {!r.wallet_address ? " — invite pending, no wallet yet" : ""}
              </option>
            ))}
          </select>
          {recipients.some((r) => !r.wallet_address) && (
            <p className="mb-3 text-xs text-muted">
              Grayed-out names haven&apos;t accepted their invite yet — they
              don&apos;t have a wallet to stream to until they do.
            </p>
          )}
        </>
      ) : (
        <input
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="0x…"
          className="amount mb-3 w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
      )}

      <div className="mb-3 flex gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-sm font-medium">Total (USDC)</label>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="2000"
            className="amount w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
        </div>
        <div className="w-36">
          <label className="mb-1 block text-sm font-medium">Duration</label>
          <div className="flex gap-1">
            <input
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="amount w-full min-w-0 rounded-lg border border-border px-2 py-2 text-sm focus:border-primary focus:outline-none"
            />
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value as DurationUnit)}
              className="rounded-lg border border-border px-1 py-2 text-sm focus:border-primary focus:outline-none"
            >
              <option value="minutes">min</option>
              <option value="hours">hrs</option>
              <option value="days">days</option>
            </select>
          </div>
        </div>
      </div>

      {ratePerSecond > 0n && (
        <p className="amount mb-3 text-sm text-accent">
          ≈ ${formatUsdc(ratePerSecond * 3600n)}/hour · $
          {formatUsdc(ratePerSecond * 86_400n)}/day
        </p>
      )}

      <label className="mb-4 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={cancelable}
          onChange={(e) => setCancelable(e.target.checked)}
          className="accent-[#0F4C81]"
        />
        Cancelable — you can cancel and reclaim unstreamed funds
      </label>

      <button
        onClick={submit}
        disabled={!valid || busy}
        className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
      >
        {busy ? "Creating…" : "Create Stream →"}
      </button>
      {error && <p className="mt-2 text-sm text-error">{error}</p>}
    </div>
  );
}
