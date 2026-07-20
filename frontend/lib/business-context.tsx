"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAccount } from "wagmi";
import type { Business } from "./types";

interface BusinessContextValue {
  business: Business | null;
  loading: boolean;
  refetch: () => void;
  createBusiness: (name: string) => Promise<void>;
}

const BusinessContext = createContext<BusinessContextValue | null>(null);

export function BusinessProvider({ children }: { children: React.ReactNode }) {
  const { address } = useAccount();
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBusiness = useCallback(async () => {
    if (!address) {
      setBusiness(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/business?wallet=${address}`);
      const data = await res.json();
      setBusiness(res.ok ? data.business : null);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchBusiness();
  }, [fetchBusiness]);

  async function createBusiness(name: string) {
    if (!address) return;
    const res = await fetch("/api/business", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress: address, name }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Failed to create workspace");
    setBusiness(data.business);
  }

  return (
    <BusinessContext.Provider
      value={{ business, loading, refetch: fetchBusiness, createBusiness }}
    >
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusinessContext() {
  const ctx = useContext(BusinessContext);
  if (!ctx) throw new Error("useBusinessContext must be used within BusinessProvider");
  return ctx;
}
