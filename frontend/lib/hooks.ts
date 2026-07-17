"use client";

import { useEffect, useMemo, useState } from "react";
import { useReadContract, useReadContracts } from "wagmi";
import type { Address } from "viem";
import { streamVaultAbi } from "./abi/streamVault";
import { STREAM_VAULT_ADDRESS, Stream } from "./contracts";

/** Ticks every second — drives the live accrual counters client-side. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

const REFETCH_MS = 15_000;

/** All streams where `address` is the business (or the recipient). */
export function useStreams(role: "business" | "recipient", address?: Address) {
  const idsQuery = useReadContract({
    address: STREAM_VAULT_ADDRESS,
    abi: streamVaultAbi,
    functionName:
      role === "business" ? "getBusinessStreams" : "getRecipientStreams",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: REFETCH_MS },
  });

  const ids = useMemo(() => (idsQuery.data ?? []) as readonly bigint[], [idsQuery.data]);

  const streamsQuery = useReadContracts({
    contracts: ids.map((id) => ({
      address: STREAM_VAULT_ADDRESS,
      abi: streamVaultAbi,
      functionName: "getStream",
      args: [id],
    })),
    query: { enabled: ids.length > 0, refetchInterval: REFETCH_MS },
  });

  const streams = useMemo(() => {
    if (!streamsQuery.data) return [];
    return streamsQuery.data
      .map((r, i) =>
        r.status === "success"
          ? { id: ids[i], ...(r.result as unknown as Stream) }
          : null
      )
      .filter((s): s is Stream & { id: bigint } => s !== null);
  }, [streamsQuery.data, ids]);

  return {
    streams,
    isLoading: idsQuery.isLoading || streamsQuery.isLoading,
    refetch: () => {
      idsQuery.refetch();
      streamsQuery.refetch();
    },
  };
}

export function useVaultBalance(address?: Address) {
  return useReadContract({
    address: STREAM_VAULT_ADDRESS,
    abi: streamVaultAbi,
    functionName: "vaultBalance",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: REFETCH_MS },
  });
}
