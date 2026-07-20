"use client";

import Link from "next/link";
import { useAccount, useReadContract } from "wagmi";
import type { Address } from "viem";
import { RefreshButton } from "@/components/RefreshButton";
import { RecipientStreamCard } from "@/components/recipient/RecipientStreamCard";
import { SendToWalletButton } from "@/components/recipient/SendToWalletButton";
import { erc20Abi } from "@/lib/abi/erc20";
import { USDC_ADDRESS } from "@/lib/contracts";
import { useNow, useStreams } from "@/lib/hooks";
import { useRecipientSession } from "@/lib/hooks-recipient-session";
import { supabase, supabaseConfigured } from "@/lib/supabase/client";
import { accruedBalance, formatUsdc, formatUsdcLive, shortAddress } from "@/lib/stream-math";

export default function RecipientDashboard() {
  const { address: wagmiAddress, isConnected } = useAccount();
  const session = useRecipientSession();
  const now = useNow();

  // Prefer a directly connected wallet; otherwise fall back to the Circle
  // wallet from a Google-authenticated session.
  const address = (wagmiAddress ?? session.recipient?.wallet_address) as
    | Address
    | undefined;
  const circleAccessToken = !wagmiAddress ? session.accessToken ?? undefined : undefined;

  const { streams, isLoading, refetch } = useStreams("recipient", address);

  const walletUsdc = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 5_000 },
  });

  if (!isConnected && !session.loading && !session.recipient) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <p className="mb-6 text-muted">
          Connect your wallet, or sign in if a business invited you.
        </p>
        {supabaseConfigured() && (
          <button
            onClick={() =>
              supabase?.auth.signInWithOAuth({
                provider: "google",
                options: { redirectTo: window.location.href },
              })
            }
            className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium hover:border-primary hover:text-primary"
          >
            Sign in with Google
          </button>
        )}
      </div>
    );
  }

  if (!address) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center text-muted">
        Loading your account…
      </div>
    );
  }

  const totalAccrued = streams.reduce(
    (sum, s) => sum + accruedBalance(s, now),
    0n
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">Your Earnings</h1>
          <RefreshButton
            onRefresh={() => {
              refetch();
              walletUsdc.refetch();
            }}
          />
        </div>
        {session.recipient && (
          <button
            onClick={session.signOut}
            className="text-sm text-muted hover:text-primary"
          >
            Sign out
          </button>
        )}
      </div>

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
        {session.recipient?.businesses?.name && (
          <div className="mt-1 text-sm text-white/70">
            Streaming from {session.recipient.businesses.name} ·{" "}
            <span className="amount">{shortAddress(address)}</span>
          </div>
        )}
      </div>

      {circleAccessToken && (
        <div className="mb-6">
          <SendToWalletButton accessToken={circleAccessToken} onSent={() => walletUsdc.refetch()} />
        </div>
      )}

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
                circleAccessToken={circleAccessToken}
                onChanged={() => {
                  refetch();
                  walletUsdc.refetch();
                }}
              />
            ))}
        </div>
      )}

      {!supabaseConfigured() && !isConnected && (
        <p className="mt-8 text-center text-xs text-muted">
          <Link href="/" className="hover:text-primary">
            ← Back home
          </Link>
        </p>
      )}
    </div>
  );
}
