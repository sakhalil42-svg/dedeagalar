"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Delivery, AccountTransaction } from "@/lib/types/database.types";

/**
 * Given sevkiyat transactions, fetch matching deliveries from the deliveries table.
 *
 * - Supplier txs (reference_type=purchase): reference_id = delivery.id
 * - Customer txs (reference_type=sale): reference_id = sale_id → fetch deliveries WHERE sale_id IN (...)
 */
export function useDeliveriesForTransactions(
  sevkiyatTxs: AccountTransaction[],
  isCustomer: boolean
) {
  const supabase = createClient();

  const referenceIds = sevkiyatTxs
    .map((t) => t.reference_id)
    .filter((id): id is string => !!id);

  return useQuery({
    queryKey: ["deliveries_for_txs", referenceIds.join(","), isCustomer],
    queryFn: async () => {
      if (referenceIds.length === 0) return new Map<string, Delivery>();

      let deliveries: Delivery[] = [];

      if (isCustomer) {
        // reference_id = sale_id, fetch deliveries by sale_id
        const { data, error } = await supabase
          .from("deliveries")
          .select("*")
          .in("sale_id", referenceIds)
          .order("delivery_date", { ascending: false });
        if (!error && data) deliveries = data as Delivery[];
      } else {
        // reference_id = delivery.id directly
        const { data, error } = await supabase
          .from("deliveries")
          .select("*")
          .in("id", referenceIds)
          .order("delivery_date", { ascending: false });
        if (!error && data) deliveries = data as Delivery[];
      }

      // Build a map: for supplier, key = delivery.id; for customer, key = sale_id
      const map = new Map<string, Delivery>();
      for (const d of deliveries) {
        if (isCustomer) {
          // Multiple deliveries can share same sale_id, but each tx maps to one
          // We'll key by sale_id — if multiple deliveries per sale, we pick the one
          // matching by date/amount or just the first
          if (d.sale_id) map.set(d.sale_id, d);
        } else {
          map.set(d.id, d);
        }
      }

      return map;
    },
    enabled: referenceIds.length > 0,
  });
}
