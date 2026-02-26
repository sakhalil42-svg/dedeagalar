"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { AccountTransaction, AccountSummary } from "@/lib/types/database.types";

const ACCOUNT_SUMMARY_KEY = ["account_summary"];
const ACCOUNT_TX_KEY = ["account_transactions"];

export function useAccountSummaries() {
  const supabase = createClient();

  return useQuery({
    queryKey: ACCOUNT_SUMMARY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_account_summary")
        .select("*")
        .order("contact_name");
      if (error) {
        // View might not exist yet, fallback to accounts + contacts join
        const { data: fallback, error: fbErr } = await supabase
          .from("accounts")
          .select("*, contact:contacts(name, type)");
        if (fbErr) throw fbErr;
        return (fallback || []).map((a: Record<string, unknown>) => {
          const contact = a.contact as { name: string; type: string } | null;
          return {
            account_id: a.id as string,
            contact_id: a.contact_id as string,
            contact_name: contact?.name || "—",
            contact_type: (contact?.type || "supplier") as AccountSummary["contact_type"],
            balance: a.balance as number,
            total_debit: a.total_debit as number,
            total_credit: a.total_credit as number,
          };
        }) as AccountSummary[];
      }
      return data as AccountSummary[];
    },
  });
}

export function useAccountTransactions(accountId: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: [...ACCOUNT_TX_KEY, accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("account_transactions")
        .select("*")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as AccountTransaction[];
    },
    enabled: !!accountId,
  });
}

export function useAccountByContact(contactId: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["account_by_contact", contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .eq("contact_id", contactId)
        .single();
      if (error) throw error;
      return data as { id: string; contact_id: string; balance: number; total_debit: number; total_credit: number };
    },
    enabled: !!contactId,
  });
}
