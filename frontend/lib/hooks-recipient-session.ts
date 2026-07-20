"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase, supabaseConfigured } from "./supabase/client";
import type { Recipient } from "./types";

export interface RecipientSession extends Recipient {
  businesses?: { name: string };
}

/** Auth session for recipients who signed in via Google + a Circle wallet,
 *  as an alternative to connecting a wallet directly. */
export function useRecipientSession() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [recipient, setRecipient] = useState<RecipientSession | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRecipient = useCallback(async (token: string) => {
    const res = await fetch("/api/recipients/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    setRecipient(res.ok ? (await res.json()).recipient : null);
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setAccessToken(data.session.access_token);
        fetchRecipient(data.session.access_token).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAccessToken(session?.access_token ?? null);
      if (session) fetchRecipient(session.access_token);
      else setRecipient(null);
    });
    return () => sub.subscription.unsubscribe();
  }, [fetchRecipient]);

  async function signOut() {
    await supabase?.auth.signOut();
    setRecipient(null);
    setAccessToken(null);
  }

  return {
    accessToken,
    recipient,
    loading,
    signOut,
    configured: supabaseConfigured(),
  };
}
