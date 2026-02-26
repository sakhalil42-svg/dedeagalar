"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { CarrierTransaction } from "@/lib/types/database.types";

export interface CarrierTransactionWithName extends CarrierTransaction {
  carrier_name: string | null;
}

export function useRecentCarrierTransactions(limit = 20) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["carrier_transactions", "recent", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("carrier_transactions")
        .select("*, carrier:carriers(name)")
        .is("deleted_at", null)
        .order("transaction_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data || []).map((tx: any) => ({
        ...tx,
        carrier_name: tx.carrier?.name ?? null,
        carrier: undefined,
      })) as CarrierTransactionWithName[];
    },
  });
}
