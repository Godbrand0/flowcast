"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import type { Address } from "viem";
import { erc20Abi } from "@/lib/abi/erc20";
import { USDC_ADDRESS } from "@/lib/contracts";
import { useRecipientSession } from "@/lib/hooks-recipient-session";
import { formatUsdc } from "@/lib/stream-math";
import {
  BankDetails,
  CashoutResponse,
  CORRIDORS,
  Corridor,
  estimateReceipt,
  FX_ESTIMATES,
  loadSavedBank,
  PayoutStatus,
  saveBank,
  TRANSFER_FEE_USDC,
} from "@/lib/offramp";

const inputCls =
  "w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none";

export default function CashoutPage() {
  const { address: wagmiAddress, isConnected } = useAccount();
  const session = useRecipientSession();
  const address = (wagmiAddress ?? session.recipient?.wallet_address) as
    | Address
    | undefined;

  const walletUsdc = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const [amount, setAmount] = useState("");
  const [corridor, setCorridor] = useState<Corridor>(CORRIDORS[0]);
  const [bank, setBank] = useState<BankDetails>({
    country: CORRIDORS[0].country,
    currency: CORRIDORS[0].currency,
    bankName: "",
    accountHolderName: "",
    accountNumber: "",
    routingNumber: "",
    iban: "",
    city: "",
    addressLine1: "",
    postalCode: "",
  });
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payout, setPayout] = useState<CashoutResponse | null>(null);
  const [status, setStatus] = useState<PayoutStatus | null>(null);

  // Prefill from a previously saved bank (localStorage — demo convenience)
  useEffect(() => {
    const saved = loadSavedBank();
    if (saved) {
      setBank(saved);
      const c = CORRIDORS.find((c) => c.country === saved.country);
      if (c) setCorridor(c);
    }
  }, []);

  // Poll payout status until it settles
  useEffect(() => {
    if (!payout) return;
    setStatus(payout.status);
    const id = setInterval(async () => {
      const res = await fetch(`/api/cashout/${payout.payoutId}`);
      if (!res.ok) return;
      const data = await res.json();
      setStatus(data.status);
      if (data.status === "complete" || data.status === "failed") {
        clearInterval(id);
      }
    }, 3000);
    return () => clearInterval(id);
  }, [payout]);

  function pickCorridor(country: string) {
    const c = CORRIDORS.find((c) => c.country === country) ?? CORRIDORS[0];
    setCorridor(c);
    setBank((b) => ({ ...b, country: c.country, currency: c.currency }));
  }

  const amountNum = Number(amount);
  const validAmount = Number.isFinite(amountNum) && amountNum > TRANSFER_FEE_USDC;
  const hasAccount =
    corridor.fields === "iban" ? !!bank.iban : !!bank.accountNumber;
  const valid =
    validAmount &&
    hasAccount &&
    !!bank.bankName &&
    !!bank.accountHolderName &&
    !!bank.city &&
    !!bank.addressLine1;

  async function submit() {
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      if (remember) saveBank(bank);
      const res = await fetch("/api/cashout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountUsdc: amountNum.toFixed(2), bank }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Cashout failed");
      setPayout(data as CashoutResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cashout failed");
    } finally {
      setBusy(false);
    }
  }

  if (!isConnected && !address && !session.loading) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center text-muted">
        Connect your wallet to cash out.
      </div>
    );
  }
  if (!address) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center text-muted">
        Loading your account…
      </div>
    );
  }

  // ─── Confirmation view ────────────────────────────────────────────────
  if (payout) {
    const steps: PayoutStatus[] = ["pending", "processing", "complete"];
    const stepIdx = status === "failed" ? -1 : steps.indexOf(status ?? "pending");
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <div className="mb-2 text-4xl">
            {status === "complete" ? "✅" : status === "failed" ? "⚠️" : "🏦"}
          </div>
          <h1 className="text-xl font-bold">
            {status === "complete"
              ? "Transfer complete"
              : status === "failed"
                ? "Transfer failed"
                : "Transfer on its way"}
          </h1>
          <p className="mt-2 text-sm text-muted">
            ${amountNum.toFixed(2)} USDC → {estimateReceipt(amountNum, bank.currency)}{" "}
            to {bank.bankName}
          </p>

          <div className="mx-auto mt-6 flex max-w-xs items-center">
            {steps.map((s, i) => (
              <div key={s} className="flex flex-1 items-center last:flex-none">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                    i <= stepIdx ? "bg-accent text-white" : "bg-border text-muted"
                  }`}
                >
                  {i + 1}
                </div>
                {i < steps.length - 1 && (
                  <div
                    className={`h-1 flex-1 ${i < stepIdx ? "bg-accent" : "bg-border"}`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="mx-auto mt-2 flex max-w-xs justify-between text-xs text-muted">
            <span>Pending</span>
            <span>Processing</span>
            <span>Complete</span>
          </div>

          <div className="amount mt-6 rounded-lg bg-background p-3 text-sm">
            Tracking ref: <span className="font-bold">{payout.trackingRef}</span>
          </div>

          {payout.mode === "demo" && (
            <p className="mt-4 rounded-lg bg-warning/10 p-3 text-xs text-warning">
              Demo mode — no real transfer. Set CIRCLE_API_KEY to enable live
              wires via Circle Payouts.
            </p>
          )}

          <Link
            href="/recipient"
            className="mt-6 inline-block rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-dark"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  // ─── Form view ────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <Link href="/recipient" className="text-sm text-muted hover:text-primary">
        ← Back
      </Link>
      <h1 className="mb-1 mt-2 text-2xl font-bold">Cash Out to Bank</h1>
      <p className="mb-6 text-sm text-muted">
        USDC in your wallet: $
        {walletUsdc.data !== undefined ? formatUsdc(walletUsdc.data) : "—"}
      </p>

      <div className="space-y-4 rounded-xl border border-border bg-surface p-6">
        <div>
          <label className="mb-1 block text-sm font-medium">
            Amount to cash out (USDC)
          </label>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="500.00"
            className={`amount ${inputCls}`}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Bank country</label>
          <select
            value={corridor.country}
            onChange={(e) => pickCorridor(e.target.value)}
            className={inputCls}
          >
            {CORRIDORS.map((c) => (
              <option key={c.country} value={c.country}>
                {c.label} ({c.currency})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Bank name</label>
          <input
            value={bank.bankName}
            onChange={(e) => setBank({ ...bank, bankName: e.target.value })}
            placeholder={corridor.country === "NG" ? "First Bank Nigeria" : "Bank name"}
            className={inputCls}
          />
        </div>

        {corridor.fields === "iban" ? (
          <div>
            <label className="mb-1 block text-sm font-medium">IBAN</label>
            <input
              value={bank.iban}
              onChange={(e) => setBank({ ...bank, iban: e.target.value })}
              placeholder="GB29 NWBK 6016 1331 9268 19"
              className={`amount ${inputCls}`}
            />
          </div>
        ) : (
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium">Account number</label>
              <input
                value={bank.accountNumber}
                onChange={(e) => setBank({ ...bank, accountNumber: e.target.value })}
                className={`amount ${inputCls}`}
              />
            </div>
            {corridor.fields === "us" && (
              <div className="w-40">
                <label className="mb-1 block text-sm font-medium">Routing</label>
                <input
                  value={bank.routingNumber}
                  onChange={(e) => setBank({ ...bank, routingNumber: e.target.value })}
                  className={`amount ${inputCls}`}
                />
              </div>
            )}
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium">Account holder name</label>
          <input
            value={bank.accountHolderName}
            onChange={(e) => setBank({ ...bank, accountHolderName: e.target.value })}
            className={inputCls}
          />
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium">City</label>
            <input
              value={bank.city}
              onChange={(e) => setBank({ ...bank, city: e.target.value })}
              className={inputCls}
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium">Address</label>
            <input
              value={bank.addressLine1}
              onChange={(e) => setBank({ ...bank, addressLine1: e.target.value })}
              className={inputCls}
            />
          </div>
        </div>

        {validAmount && FX_ESTIMATES[bank.currency] && (
          <div className="rounded-lg bg-background p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">You send</span>
              <span className="amount">${amountNum.toFixed(2)} USDC</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Transfer fee</span>
              <span className="amount">${TRANSFER_FEE_USDC.toFixed(2)} USDC</span>
            </div>
            <div className="mt-1 flex justify-between border-t border-border pt-1 font-medium">
              <span>Estimated receipt</span>
              <span className="amount text-accent">
                {estimateReceipt(amountNum, bank.currency)}
              </span>
            </div>
            <p className="mt-2 text-xs text-muted">
              Rate: 1 USDC ≈ {FX_ESTIMATES[bank.currency].symbol}
              {FX_ESTIMATES[bank.currency].rate.toLocaleString()} · Arrives in 1–3
              business days
            </p>
          </div>
        )}

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="accent-[#0F4C81]"
          />
          Save this bank account for next time
        </label>

        <button
          onClick={submit}
          disabled={!valid || busy}
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
        >
          {busy ? "Submitting…" : "Cash Out →"}
        </button>
        {error && <p className="text-sm text-error">{error}</p>}
      </div>
    </div>
  );
}
