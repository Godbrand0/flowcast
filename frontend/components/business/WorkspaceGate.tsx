"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useBusinessContext } from "@/lib/business-context";

export function WorkspaceGate({ children }: { children: React.ReactNode }) {
  const { isConnected } = useAccount();
  const { business, loading, createBusiness } = useBusinessContext();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isConnected) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-24 text-center text-muted">
        Connect your wallet to manage your vault and streams.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-24 text-center text-muted">
        Loading workspace…
      </div>
    );
  }

  if (!business) {
    return (
      <div className="mx-auto max-w-md px-4 py-24">
        <div className="rounded-xl border border-border bg-surface p-8">
          <h1 className="mb-2 text-xl font-bold">Set up your workspace</h1>
          <p className="mb-6 text-sm text-muted">
            One-time setup — this name is shown to the people you invite.
          </p>
          <label className="mb-1 block text-sm font-medium">Company name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Acme Corp"
            className="mb-4 w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
          <button
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await createBusiness(name.trim());
              } catch (e) {
                setError(e instanceof Error ? e.message : "Failed to create workspace");
              } finally {
                setBusy(false);
              }
            }}
            disabled={busy || !name.trim()}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create Workspace →"}
          </button>
          {error && <p className="mt-2 text-sm text-error">{error}</p>}
          {!process.env.NEXT_PUBLIC_SUPABASE_URL && (
            <p className="mt-4 rounded-lg bg-warning/10 p-3 text-xs text-warning">
              Supabase isn&apos;t configured yet — set NEXT_PUBLIC_SUPABASE_URL and
              SUPABASE_SERVICE_ROLE_KEY to enable workspaces and the team directory.
            </p>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
