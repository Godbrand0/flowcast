"use client";

import { useCallback, useEffect, useState } from "react";
import type { Recipient } from "./types";

export function useRecipients(businessId?: string) {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!businessId) {
      setRecipients([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/recipients?businessId=${businessId}`);
      const data = await res.json();
      setRecipients(res.ok ? data.recipients : []);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  async function invite(email: string, fullName: string) {
    if (!businessId) return;
    const res = await fetch("/api/recipients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId, email, fullName }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Failed to send invite");
    await refetch();
    return data;
  }

  return { recipients, loading, refetch, invite };
}
