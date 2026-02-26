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

      // ── Build delivery query ──
      const conditions: string[] = [];
      if (saleIds.length > 0)
        conditions.push(`sale_id.in.(${saleIds.join(",")})`);
      if (purchaseIds.length > 0)
        conditions.push(`purchase_id.in.(${purchaseIds.join(",")})`);

      if (conditions.length === 0) return [];

      const { data, error } = await supabase
        .from("deliveries")
        .select("*")
        .or(conditions.join(","))
        .order("delivery_date", { ascending: false });
      if (error) throw error;

      // ── Attach unit_price ──
      return (data as Delivery[]).map((d) => {
        const salePrice = d.sale_id ? saleMap.get(d.sale_id) : null;
        const purchasePrice = d.purchase_id
          ? purchaseMap.get(d.purchase_id)
          : null;
        const unitPrice = salePrice || purchasePrice || 0;
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
