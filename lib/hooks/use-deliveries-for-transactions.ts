"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Delivery, AccountTransaction } from "@/lib/types/database.types";

/**
 * Given sevkiyat transactions, fetch matching deliveries from the deliveries table.
 * Returns Map<tx.id, Delivery> — each transaction is matched to its specific delivery.
 *
 * - Supplier txs (reference_type=purchase): reference_id = delivery.id (direct match)
 * - Customer txs (reference_type=sale): reference_id = sale_id → match by amount + date
 * - "both" type contacts: handles mixed sale + purchase txs
 */
export function useDeliveriesForTransactions(
  sevkiyatTxs: AccountTransaction[],
  isCustomer: boolean
) {
  const supabase = createClient();

  // Stable key from tx ids
  const txKey = sevkiyatTxs.map((t) => t.id).join(",");

  return useQuery({
    queryKey: ["deliveries_for_txs", txKey, isCustomer],
    queryFn: async () => {
      if (sevkiyatTxs.length === 0) return new Map<string, Delivery>();

      const map = new Map<string, Delivery>();

      // Split txs by type
      const purchaseTxs = sevkiyatTxs.filter((t) => t.reference_type === "purchase");
      const saleTxs = sevkiyatTxs.filter((t) => t.reference_type === "sale");

      // 1. Supplier txs: reference_id = delivery.id (direct 1:1)
      if (purchaseTxs.length > 0) {
        const deliveryIds = purchaseTxs
          .map((t) => t.reference_id)
          .filter((id): id is string => !!id);

        if (deliveryIds.length > 0) {
          const { data } = await supabase
            .from("deliveries")
            .select("*")
            .in("id", deliveryIds)
            .is("deleted_at", null);

          const byId = new Map<string, Delivery>();
          for (const d of (data || []) as Delivery[]) {
            byId.set(d.id, d);
          }

          for (const tx of purchaseTxs) {
            if (tx.reference_id) {
              const del = byId.get(tx.reference_id);
              if (del) map.set(tx.id, del);
            }
          }
        }
      }

      // 2. Customer txs: reference_id = sale_id → match to specific delivery
      if (saleTxs.length > 0) {
        const saleIds = [...new Set(
          saleTxs.map((t) => t.reference_id).filter((id): id is string => !!id)
        )];

        if (saleIds.length > 0) {
          // Fetch all deliveries for these sales
          const { data: deliveryData } = await supabase
            .from("deliveries")
            .select("*")
            .in("sale_id", saleIds)
            .is("deleted_at", null)
            .order("created_at", { ascending: true });

          // Fetch sale prices for amount matching
          const { data: salesData } = await supabase
            .from("sales")
            .select("id, unit_price")
            .in("id", saleIds);

          const salePriceMap = new Map<string, number>();
          for (const s of salesData || []) {
            salePriceMap.set(s.id, s.unit_price);
          }

          // Group deliveries by sale_id
          const bySale = new Map<string, Delivery[]>();
          for (const d of (deliveryData || []) as Delivery[]) {
            if (!d.sale_id) continue;
            const arr = bySale.get(d.sale_id) || [];
            arr.push(d);
            bySale.set(d.sale_id, arr);
          }

          // Match each customer tx to a delivery by amount
          for (const saleId of saleIds) {
            const candidates = bySale.get(saleId) || [];
            const txsForSale = saleTxs.filter((t) => t.reference_id === saleId);
            const unitPrice = salePriceMap.get(saleId) || 0;

            // Track which deliveries have been claimed
            const usedDeliveryIds = new Set<string>();

            for (const tx of txsForSale) {
              const txAmount = Number(tx.amount) || 0;
              let bestMatch: Delivery | null = null;
              let bestDiff = Infinity;

              for (const d of candidates) {
                if (usedDeliveryIds.has(d.id)) continue;

                // Calculate possible amounts for this delivery
                const fullAmount = d.net_weight * unitPrice;
                const freightDeducted = fullAmount - (d.freight_cost || 0);

                const diff1 = Math.abs(txAmount - fullAmount);
                const diff2 = Math.abs(txAmount - freightDeducted);
                const minDiff = Math.min(diff1, diff2);

                if (minDiff < bestDiff) {
                  bestDiff = minDiff;
                  bestMatch = d;
                }
              }

              if (bestMatch) {
                map.set(tx.id, bestMatch);
                usedDeliveryIds.add(bestMatch.id);
              } else if (candidates.length > 0) {
                // Fallback: assign first unclaimed delivery
                const fallback = candidates.find((d) => !usedDeliveryIds.has(d.id));
                if (fallback) {
                  map.set(tx.id, fallback);
                  usedDeliveryIds.add(fallback.id);
                }
              }
            }
          }
        }
      }

      return map;
    },
    enabled: sevkiyatTxs.length > 0,
  });
}
