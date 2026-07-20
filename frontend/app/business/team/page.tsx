"use client";

import { useState } from "react";
import { DotMenu } from "@/components/DotMenu";
import { InviteRecipientModal } from "@/components/business/InviteRecipientModal";
import { RecipientDetailDrawer } from "@/components/business/RecipientDetailDrawer";
import { useBusinessContext } from "@/lib/business-context";
import { useRecipients } from "@/lib/hooks-recipients";
import type { Recipient } from "@/lib/types";
import { shortAddress } from "@/lib/stream-math";

const statusStyle: Record<Recipient["status"], string> = {
  pending: "bg-warning/10 text-warning",
  active: "bg-accent/10 text-accent",
  suspended: "bg-error/10 text-error",
};

export default function TeamPage() {
  const { business } = useBusinessContext();
  const { recipients, loading, invite, refetch } = useRecipients(business?.id);
  const [showInvite, setShowInvite] = useState(false);
  const [selected, setSelected] = useState<Recipient | null>(null);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Team</h1>
        <button
          onClick={() => setShowInvite(true)}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
        >
          + Invite Recipient
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-background text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Wallet</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted">
                  Loading team…
                </td>
              </tr>
            ) : recipients.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted">
                  No one invited yet — click &quot;Invite Recipient&quot; to add your
                  first team member.
                </td>
              </tr>
            ) : (
              recipients.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => setSelected(r)}
                  className="cursor-pointer border-b border-border last:border-b-0 hover:bg-background"
                >
                  <td className="px-4 py-3 font-medium">{r.full_name || "—"}</td>
                  <td className="px-4 py-3 text-muted">{r.email}</td>
                  <td className="amount px-4 py-3 text-muted">
                    {r.wallet_address ? shortAddress(r.wallet_address) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle[r.status]}`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <DotMenu
                      items={[
                        { label: "View details", onClick: () => setSelected(r) },
                        ...(r.wallet_address
                          ? [
                              {
                                label: "Create stream",
                                onClick: () => {
                                  window.location.href = `/business?recipient=${r.wallet_address}`;
                                },
                              },
                            ]
                          : []),
                      ]}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showInvite && (
        <InviteRecipientModal
          onClose={() => {
            setShowInvite(false);
            refetch();
          }}
          onInvite={invite}
        />
      )}
      {selected && (
        <RecipientDetailDrawer recipient={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
