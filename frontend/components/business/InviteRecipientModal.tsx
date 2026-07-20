"use client";

import { useState } from "react";

export function InviteRecipientModal({
  onClose,
  onInvite,
}: {
  onClose: () => void;
  onInvite: (email: string, fullName: string) => Promise<unknown>;
}) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<"smtp" | "demo" | null>(null);

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  async function submit() {
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      const result = await onInvite(email.trim(), fullName.trim());
      setSent((result as { email?: { mode: "smtp" | "demo" } })?.email?.mode ?? "demo");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send invite");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-surface p-6 shadow-xl">
        {sent ? (
          <div className="text-center">
            <div className="mb-2 text-3xl">✉️</div>
            <h2 className="mb-1 text-lg font-semibold">Invite sent</h2>
            <p className="mb-4 text-sm text-muted">
              {email} can now set up their wallet and start receiving streams.
            </p>
            {sent === "demo" && (
              <p className="mb-4 rounded-lg bg-warning/10 p-2 text-xs text-warning">
                Demo mode — no SMTP configured, the invite link was logged to the
                server console instead of emailed.
              </p>
            )}
            <button
              onClick={onClose}
              className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <h2 className="mb-4 text-lg font-semibold">Invite a recipient</h2>
            <label className="mb-1 block text-sm font-medium">Full name</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Alice Chen"
              className="mb-3 w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
            <label className="mb-1 block text-sm font-medium">Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alice@email.com"
              className="mb-4 w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:border-primary"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={!valid || busy}
                className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
              >
                {busy ? "Sending…" : "Send Invite"}
              </button>
            </div>
            {error && <p className="mt-2 text-sm text-error">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}
