"use client";

import type { Recipient } from "@/lib/types";
import { shortAddress } from "@/lib/stream-math";
import { EXPLORER_URL } from "@/lib/contracts";

const statusStyle: Record<Recipient["status"], string> = {
  pending: "bg-warning/10 text-warning",
  active: "bg-accent/10 text-accent",
  suspended: "bg-error/10 text-error",
};

const tierLabel = ["Unverified", "Tier 1 · OTP", "Tier 2 · Selfie", "Tier 3 · ID"];

export function RecipientDetailDrawer({
  recipient,
  onClose,
}: {
  recipient: Recipient;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-20 flex justify-end bg-black/40">
      <div className="h-full w-full max-w-sm overflow-y-auto bg-surface p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">
              {recipient.full_name || recipient.email}
            </h2>
            <p className="text-sm text-muted">{recipient.email}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted hover:text-foreground"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <span
          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle[recipient.status]}`}
        >
          {recipient.status === "pending"
            ? "Invite pending"
            : recipient.status === "active"
              ? "Active"
              : "Suspended"}
        </span>

        <dl className="mt-6 space-y-4 text-sm">
          <div>
            <dt className="text-muted">Wallet address</dt>
            <dd className="amount mt-0.5">
              {recipient.wallet_address ? (
                <a
                  href={`${EXPLORER_URL}/address/${recipient.wallet_address}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  {shortAddress(recipient.wallet_address)} ↗
                </a>
              ) : (
                "Not set up yet"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Verification</dt>
            <dd className="mt-0.5">{tierLabel[recipient.verification_tier]}</dd>
          </div>
          <div>
            <dt className="text-muted">Invited</dt>
            <dd className="mt-0.5">
              {new Date(recipient.invited_at).toLocaleDateString()}
            </dd>
          </div>
          {recipient.onboarded_at && (
            <div>
              <dt className="text-muted">Onboarded</dt>
              <dd className="mt-0.5">
                {new Date(recipient.onboarded_at).toLocaleDateString()}
              </dd>
            </div>
          )}
        </dl>

        {recipient.wallet_address && (
          <a
            href={`/business?recipient=${recipient.wallet_address}`}
            className="mt-6 block w-full rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-primary-dark"
          >
            Create Stream →
          </a>
        )}
      </div>
    </div>
  );
}
