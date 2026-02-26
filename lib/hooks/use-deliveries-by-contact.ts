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
      // Get sales for this contact (customer)
      const { data: sales } = await supabase
        .from("sales")
        .select("id, unit_price")
        .eq("contact_id", contactId);

      // Get purchases for this contact (supplier)
      const { data: purchases } = await supabase
        .from("purchases")
        .select("id, unit_price")
        .eq("contact_id", contactId);

      const saleMap = new Map((sales || []).map((s) => [s.id, s.unit_price]));
      const purchaseMap = new Map((purchases || []).map((p) => [p.id, p.unit_price]));

      const saleIds = (sales || []).map((s) => s.id);
      const purchaseIds = (purchases || []).map((p) => p.id);

      if (saleIds.length === 0 && purchaseIds.length === 0) return [];

      let query = supabase.from("deliveries").select("*");

      if (saleIds.length > 0 && purchaseIds.length > 0) {
        query = query.or(
          `sale_id.in.(${saleIds.join(",")}),purchase_id.in.(${purchaseIds.join(",")})`
        );
      } else if (saleIds.length > 0) {
        query = query.in("sale_id", saleIds);
      } else {
        query = query.in("purchase_id", purchaseIds);
      }

      const { data, error } = await query.order("delivery_date", {
        ascending: false,
      });
      if (error) throw error;

      // Attach unit_price from sale or purchase
      return (data as Delivery[]).map((d) => {
        const unitPrice =
          (d.sale_id ? saleMap.get(d.sale_id) : null) ||
          (d.purchase_id ? purchaseMap.get(d.purchase_id) : null) ||
          0;
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
