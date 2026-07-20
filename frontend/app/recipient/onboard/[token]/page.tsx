"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { supabase, supabaseConfigured } from "@/lib/supabase/client";
import { executeCircleChallenge } from "@/lib/circle-wallets-client";

type Step =
  | "loading"
  | "not-found"
  | "already-active"
  | "sign-in"
  | "provisioning"
  | "pin-setup"
  | "finalizing"
  | "done"
  | "error";

interface InviteInfo {
  email: string;
  fullName: string | null;
  businessName: string;
  status: "pending" | "active" | "suspended";
}

export default function RecipientOnboardPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [step, setStep] = useState<Step>("loading");
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  // 1. Validate the invite token.
  useEffect(() => {
    fetch(`/api/recipients/invite/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          setStep("not-found");
          return;
        }
        const data = (await res.json()) as InviteInfo;
        setInvite(data);
        setStep(data.status === "active" ? "already-active" : "sign-in");
      })
      .catch(() => setStep("not-found"));
  }, [token]);

  // 2. Once signed in with Google, provision the Circle wallet automatically.
  useEffect(() => {
    if (!supabase || step !== "sign-in") return;

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) return;
      await provisionWallet(session.access_token);
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) provisionWallet(data.session.access_token);
    });

    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  async function provisionWallet(accessToken: string) {
    setStep("provisioning");
    setError(null);
    try {
      const initRes = await fetch("/api/recipients/onboard/init", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ token }),
      });
      const initData = await initRes.json();
      if (!initRes.ok) throw new Error(initData.error ?? "Setup failed");

      if (!initData.alreadyInitialized) {
        setStep("pin-setup");
        await executeCircleChallenge(
          initData.challengeId,
          initData.userToken,
          initData.encryptionKey
        );
      }

      setStep("finalizing");
      const completeRes = await fetch("/api/recipients/onboard/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ token, userToken: initData.userToken }),
      });
      const completeData = await completeRes.json();
      if (!completeRes.ok) throw new Error(completeData.error ?? "Setup failed");

      setWalletAddress(completeData.recipient.wallet_address);
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Setup failed");
      setStep("error");
    }
  }

  async function signIn() {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.href },
    });
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-xl border border-border bg-surface p-8 text-center">
        {!supabaseConfigured() && (
          <>
            <div className="mb-2 text-3xl">⚠️</div>
            <h1 className="mb-2 text-lg font-semibold">Not configured yet</h1>
            <p className="text-sm text-muted">
              Onboarding isn&apos;t live yet — Supabase credentials haven&apos;t
              been set up. Check back soon.
            </p>
          </>
        )}

        {supabaseConfigured() && step === "loading" && (
          <p className="text-sm text-muted">Checking your invite…</p>
        )}

        {step === "not-found" && (
          <>
            <div className="mb-2 text-3xl">🔗</div>
            <h1 className="mb-2 text-lg font-semibold">Invite not found</h1>
            <p className="text-sm text-muted">
              This invite link is invalid or has expired. Ask your employer to
              resend it.
            </p>
          </>
        )}

        {step === "already-active" && (
          <>
            <div className="mb-2 text-3xl">✅</div>
            <h1 className="mb-2 text-lg font-semibold">Already set up</h1>
            <p className="mb-4 text-sm text-muted">
              This invite has already been used. Sign in from the dashboard
              instead.
            </p>
            <Link
              href="/recipient"
              className="inline-block rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-dark"
            >
              Go to dashboard
            </Link>
          </>
        )}

        {step === "sign-in" && invite && (
          <>
            <div className="mb-2 text-3xl">👋</div>
            <h1 className="mb-1 text-lg font-semibold">
              {invite.businessName} invited you to FlowCast
            </h1>
            <p className="mb-6 text-sm text-muted">
              Sign in with the Google account for <strong>{invite.email}</strong> to
              set up your wallet — no crypto experience needed.
            </p>
            <button
              onClick={signIn}
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark"
            >
              Continue with Google →
            </button>
          </>
        )}

        {step === "provisioning" && (
          <p className="text-sm text-muted">Setting up your account…</p>
        )}
        {step === "pin-setup" && (
          <p className="text-sm text-muted">
            Set up a PIN to secure your wallet in the window that just opened…
          </p>
        )}
        {step === "finalizing" && (
          <p className="text-sm text-muted">Almost done…</p>
        )}

        {step === "done" && (
          <>
            <div className="mb-2 text-3xl">🎉</div>
            <h1 className="mb-2 text-lg font-semibold">You&apos;re all set</h1>
            <p className="mb-1 text-sm text-muted">
              Your wallet has been created — no seed phrase required.
            </p>
            {walletAddress && (
              <p className="amount mb-4 text-xs text-muted">{walletAddress}</p>
            )}
            <Link
              href="/recipient"
              className="inline-block rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-dark"
            >
              View your earnings →
            </Link>
          </>
        )}

        {step === "error" && (
          <>
            <div className="mb-2 text-3xl">⚠️</div>
            <h1 className="mb-2 text-lg font-semibold">Something went wrong</h1>
            <p className="text-sm text-error">{error}</p>
          </>
        )}
      </div>
    </div>
  );
}
