"use client";

import { useState } from "react";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { RefreshButton } from "@/components/RefreshButton";
import { erc20Abi } from "@/lib/abi/erc20";
import { streamVaultAbi } from "@/lib/abi/streamVault";
import { STREAM_VAULT_ADDRESS, USDC_ADDRESS } from "@/lib/contracts";
import { useVaultBalance } from "@/lib/hooks";
import { formatUsdc, parseUsdc } from "@/lib/stream-math";

export function VaultPanel({ monthlyBurn }: { monthlyBurn: number }) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const vault = useVaultBalance(address);
  const walletUsdc = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 5_000 },
  });

  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState<"deposit" | "withdraw" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parsed = parseUsdc(amount);

  async function run(action: "deposit" | "withdraw") {
    if (!address || !publicClient || parsed === null || parsed === 0n) return;
    setBusy(action);
    setError(null);
    try {
      if (action === "deposit") {
        const allowance = await publicClient.readContract({
          address: USDC_ADDRESS,
          abi: erc20Abi,
          functionName: "allowance",
          args: [address, STREAM_VAULT_ADDRESS],
        });
        if (allowance < parsed) {
          const approveHash = await writeContractAsync({
            address: USDC_ADDRESS,
            abi: erc20Abi,
            functionName: "approve",
            args: [STREAM_VAULT_ADDRESS, parsed],
          });
          await publicClient.waitForTransactionReceipt({ hash: approveHash });
        }
        const hash = await writeContractAsync({
          address: STREAM_VAULT_ADDRESS,
          abi: streamVaultAbi,
          functionName: "deposit",
          args: [parsed],
        });
        await publicClient.waitForTransactionReceipt({ hash });
      } else {
        const hash = await writeContractAsync({
          address: STREAM_VAULT_ADDRESS,
          abi: streamVaultAbi,
          functionName: "withdrawVault",
          args: [parsed],
        });
        await publicClient.waitForTransactionReceipt({ hash });
      }
      setAmount("");
      vault.refetch();
      walletUsdc.refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message.split("\n")[0] : "Transaction failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <div className="mb-1 flex items-center gap-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
          Vault Balance
        </h2>
        <RefreshButton
          onRefresh={() => {
            vault.refetch();
            walletUsdc.refetch();
          }}
        />
      </div>
      <div className="amount text-4xl font-bold">
        ${vault.data !== undefined ? formatUsdc(vault.data) : "—"}
        <span className="ml-2 text-base font-medium text-muted">USDC</span>
      </div>
      <p className="mt-1 text-sm text-muted">
        Streaming ≈ ${monthlyBurn.toLocaleString("en-US", { maximumFractionDigits: 0 })}
        /month · Wallet: $
        {walletUsdc.data !== undefined ? formatUsdc(walletUsdc.data) : "—"}
      </p>

      <div className="mt-5 flex gap-2">
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount (USDC)"
          className="amount w-40 rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
        <button
          onClick={() => run("deposit")}
          disabled={busy !== null || parsed === null || parsed === 0n}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
        >
          {busy === "deposit" ? "Depositing…" : "Deposit"}
        </button>
        <button
          onClick={() => run("withdraw")}
          disabled={busy !== null || parsed === null || parsed === 0n}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:border-primary disabled:opacity-50"
        >
          {busy === "withdraw" ? "Withdrawing…" : "Withdraw Unused"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-error">{error}</p>}
    </div>
  );
}
