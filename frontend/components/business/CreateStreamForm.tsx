"use client";

import { useState } from "react";
import { usePublicClient, useWriteContract } from "wagmi";
import { isAddress } from "viem";
import { streamVaultAbi } from "@/lib/abi/streamVault";
import { STREAM_VAULT_ADDRESS } from "@/lib/contracts";
import { formatUsdc, parseUsdc } from "@/lib/stream-math";

export function CreateStreamForm({ onCreated }: { onCreated: () => void }) {
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [days, setDays] = useState("30");
  const [cancelable, setCancelable] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedAmount = parseUsdc(amount);
  const parsedDays = Number(days);
  const valid =
    isAddress(recipient) &&
    parsedAmount !== null &&
    parsedAmount > 0n &&
    Number.isFinite(parsedDays) &&
    parsedDays > 0;

  const ratePerSecond =
    valid && parsedAmount ? parsedAmount / BigInt(Math.floor(parsedDays * 86_400)) : 0n;

  async function submit() {
    if (!valid || !publicClient || parsedAmount === null) return;
    setBusy(true);
    setError(null);
    try {
      const endTime =
        Math.floor(Date.now() / 1000) + Math.floor(parsedDays * 86_400);
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

      <label className="mb-1 block text-sm font-medium">Recipient wallet</label>
      <input
        value={recipient}
        onChange={(e) => setRecipient(e.target.value)}
        placeholder="0x…"
        className="amount mb-3 w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none"
      />

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
        <div className="w-28">
          <label className="mb-1 block text-sm font-medium">Days</label>
          <input
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className="amount w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
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
