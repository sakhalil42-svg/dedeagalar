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
      // Fetch accounts and contacts separately — no FK joins needed
      const { data: accounts, error: accErr } = await supabase
        .from("accounts")
        .select("*");
      if (accErr) throw accErr;

      const contactIds = [...new Set((accounts || []).map((a) => a.contact_id).filter(Boolean))];
      let contactMap = new Map<string, { name: string; type: string }>();
      if (contactIds.length > 0) {
        const { data: contacts } = await supabase
          .from("contacts")
          .select("id, name, type")
          .in("id", contactIds);
        if (contacts) {
          contactMap = new Map(
            contacts.map((c) => [c.id, { name: c.name, type: c.type }])
          );
        }
      }

      const result: AccountSummary[] = (accounts || []).map((a) => {
        const contact = contactMap.get(a.contact_id);
        return {
          account_id: a.id,
          contact_id: a.contact_id,
          contact_name: contact?.name || "—",
          contact_type: (contact?.type || "supplier") as AccountSummary["contact_type"],
          balance: a.balance ?? 0,
          total_debit: a.total_debit ?? 0,
          total_credit: a.total_credit ?? 0,
        };
      });

      return result.sort((a, b) =>
        a.contact_name.localeCompare(b.contact_name, "tr")
      );
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
        .is("deleted_at", null)
        .order("transaction_date", { ascending: false });
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
