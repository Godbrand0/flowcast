"use client";

import { useState } from "react";
import { isAddress } from "viem";
import { executeCircleChallenge } from "@/lib/circle-wallets-client";
import { parseUsdc } from "@/lib/stream-math";

export function SendToWalletButton({
  accessToken,
  onSent,
}: {
  accessToken: string;
  onSent: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedAmount = parseUsdc(amount);
  const valid = isAddress(destination) && parsedAmount !== null && parsedAmount > 0n;

  async function send() {
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/recipients/send-challenge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ destinationAddress: destination, amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Send failed");
      await executeCircleChallenge(data.challengeId, data.userToken, data.encryptionKey);
      setOpen(false);
      setDestination("");
      setAmount("");
      onSent();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:border-primary hover:text-primary"
      >
        Send to an external wallet
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="mb-3 text-sm font-medium">Send USDC to another wallet</p>
      <input
        value={destination}
        onChange={(e) => setDestination(e.target.value)}
        placeholder="0x… destination address"
        className="amount mb-2 w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none"
      />
      <input
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Amount (USDC)"
        className="amount mb-3 w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none"
      />
      <div className="flex gap-2">
        <button
          onClick={() => setOpen(false)}
          className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:border-primary"
        >
          Cancel
        </button>
        <button
          onClick={send}
          disabled={!valid || busy}
          className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
        >
          {busy ? "Sending…" : "Send"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-error">{error}</p>}
    </div>
  );
}
