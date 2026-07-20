"use client";

import { useSearchParams } from "next/navigation";
import { useAccount } from "wagmi";
import { CreateStreamForm } from "@/components/business/CreateStreamForm";
import { RefreshButton } from "@/components/RefreshButton";
import { StreamRow } from "@/components/business/StreamRow";
import { VaultPanel } from "@/components/business/VaultPanel";
import { useBusinessContext } from "@/lib/business-context";
import { StreamStatus } from "@/lib/contracts";
import { useStreams } from "@/lib/hooks";
import { useRecipients } from "@/lib/hooks-recipients";
import { usdcToNumber } from "@/lib/stream-math";

export default function BusinessDashboard() {
  const { address } = useAccount();
  const { streams, isLoading, refetch } = useStreams("business", address);
  const { business } = useBusinessContext();
  const { recipients } = useRecipients(business?.id);
  const prefillRecipient = useSearchParams().get("recipient") ?? undefined;

  const active = streams.filter((s) => s.status === StreamStatus.Active);
  const monthlyBurn = active.reduce(
    (sum, s) => sum + usdcToNumber(s.ratePerSecond * 2_592_000n),
    0
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center gap-2">
        <h1 className="text-2xl font-bold">Business Dashboard</h1>
        <RefreshButton onRefresh={refetch} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <VaultPanel monthlyBurn={monthlyBurn} />

          <div className="rounded-xl border border-border bg-surface">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="font-semibold">
                Streams{" "}
                <span className="ml-1 text-sm font-normal text-muted">
                  {active.length} active
                </span>
              </h2>
            </div>
            {isLoading ? (
              <p className="p-6 text-sm text-muted">Loading streams…</p>
            ) : streams.length === 0 ? (
              <p className="p-6 text-sm text-muted">
                No streams yet — deposit USDC and create your first one.
              </p>
            ) : (
              [...streams]
                .sort((a, b) => Number(b.id - a.id))
                .map((s) => (
                  <StreamRow key={s.id.toString()} stream={s} onChanged={refetch} />
                ))
            )}
          </div>
        </div>

        <CreateStreamForm
          onCreated={refetch}
          recipients={recipients}
          initialRecipient={prefillRecipient}
        />
      </div>
    </div>
  );
}
