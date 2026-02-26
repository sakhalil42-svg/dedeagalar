"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Delivery } from "@/lib/types/database.types";

export interface DeliveryWithPrice extends Delivery {
  unit_price: number;
  total_amount: number;
}

export function useDeliveriesByContact(contactId: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["deliveries", "contact", contactId],
    queryFn: async () => {
      // ── Customer path: sales → deliveries ──
      const { data: sales } = await supabase
        .from("sales")
        .select("id, unit_price")
        .eq("contact_id", contactId);

      const saleMap = new Map(
        (sales || []).map((s) => [s.id, s.unit_price])
      );
      const saleIds = (sales || []).map((s) => s.id);

      // ── Supplier path: purchases → deliveries ──
      const { data: purchases } = await supabase
        .from("purchases")
        .select("id, unit_price")
        .eq("contact_id", contactId);

      const purchaseMap = new Map(
        (purchases || []).map((p) => [p.id, p.unit_price])
      );
      const purchaseIds = (purchases || []).map((p) => p.id);

      // ── Supplier fallback: account_transactions → reference_id → deliveries ──
      // Hızlı Sevkiyat creates delivery with sale_id only (no purchase_id).
      // Supplier transaction stores reference_type="purchase", reference_id=delivery.id
      let txDeliveryIds: string[] = [];
      if (purchaseIds.length === 0 && saleIds.length === 0) {
        const { data: account } = await supabase
          .from("accounts")
          .select("id")
          .eq("contact_id", contactId)
          .single();

        if (account) {
          const { data: txs } = await supabase
            .from("account_transactions")
            .select("reference_id")
            .eq("account_id", account.id)
            .eq("reference_type", "purchase")
            .not("reference_id", "is", null);

          txDeliveryIds = (txs || [])
            .map((t) => t.reference_id as string)
            .filter(Boolean);
        }
      }

      // ── Build delivery query ──
      const conditions: string[] = [];
      if (saleIds.length > 0)
        conditions.push(`sale_id.in.(${saleIds.join(",")})`);
      if (purchaseIds.length > 0)
        conditions.push(`purchase_id.in.(${purchaseIds.join(",")})`);
      if (txDeliveryIds.length > 0)
        conditions.push(`id.in.(${txDeliveryIds.join(",")})`);

      if (conditions.length === 0) return [];

      const { data, error } = await supabase
        .from("deliveries")
        .select("*")
        .or(conditions.join(","))
        .is("deleted_at", null)
        .order("delivery_date", { ascending: false });
      if (error) throw error;

      // ── Get supplier unit_price from transaction description ──
      let supplierPriceFromTx = 0;
      if (saleIds.length === 0 && txDeliveryIds.length > 0) {
        const { data: account } = await supabase
          .from("accounts")
          .select("id")
          .eq("contact_id", contactId)
          .single();

        if (account) {
          const { data: txs } = await supabase
            .from("account_transactions")
            .select("description")
            .eq("account_id", account.id)
            .eq("reference_type", "purchase")
            .limit(1);

          if (txs && txs.length > 0) {
            const match = txs[0].description?.match(
              /\u00d7\s*([\d.,]+)\s*\u20ba\/kg/
            );
            if (match) {
              supplierPriceFromTx = parseFloat(
                match[1].replace(/\./g, "").replace(",", ".")
              );
            }
          }
        }
      }

      // ── Attach unit_price ──
      return (data as Delivery[]).map((d) => {
        const salePrice = d.sale_id ? saleMap.get(d.sale_id) : null;
        const purchasePrice = d.purchase_id
          ? purchaseMap.get(d.purchase_id)
          : null;
        const unitPrice = salePrice || purchasePrice || supplierPriceFromTx || 0;
        return {
          ...d,
          unit_price: unitPrice,
          total_amount: d.net_weight * unitPrice,
        } as DeliveryWithPrice;
      });
    },
    enabled: !!contactId,
  });
}

export function usePaymentsByContact(contactId: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["payments", "contact", contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("contact_id", contactId)
        .order("payment_date", { ascending: false });
      if (error) throw error;
      return data as Array<{
        id: string;
        contact_id: string;
        direction: string;
        method: string;
        amount: number;
        payment_date: string;
        description: string | null;
        created_at: string;
      }>;
    },
    enabled: !!contactId,
  });
}
