"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Contact, ContactInsert, ContactUpdate, ContactType } from "@/lib/types/database.types";

const CONTACTS_KEY = ["contacts"];

export function useContacts(filter?: ContactType) {
  const supabase = createClient();

  return useQuery({
    queryKey: filter ? [...CONTACTS_KEY, filter] : CONTACTS_KEY,
    queryFn: async () => {
      let query = supabase
        .from("contacts")
        .select("*")
        .order("name");

      if (filter) {
        query = query.or(`type.eq.${filter},type.eq.both`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Contact[];
    },
  });
}

export function useContact(id: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: [...CONTACTS_KEY, id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*, accounts(*)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as (Contact & { accounts: { id: string; balance: number; total_debit: number; total_credit: number }[] }) | null;
    },
    enabled: !!id,
  });
}

export function useCreateContact() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: ContactInsert) => {
      const { data, error } = await supabase
        .from("contacts")
        .insert(values)
        .select()
        .single();
      if (error) throw error;
      return data as Contact;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTACTS_KEY });
    },
  });
}

export function useUpdateContact() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...values }: ContactUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("contacts")
        .update(values)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Contact;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTACTS_KEY });
    },
  });
}

export function useDeleteContact() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Cache'den bu kişiyi hemen kaldır — refetch 406 vermesin
      queryClient.removeQueries({ queryKey: [...CONTACTS_KEY, id] });
      queryClient.removeQueries({ queryKey: ["account_by_contact", id] });
      queryClient.removeQueries({ queryKey: ["deliveries_by_contact", id] });

      // ── 1. Account ID'leri bul ──
      const { data: accounts } = await supabase
        .from("accounts")
        .select("id")
        .eq("contact_id", id);
      const accountIds = (accounts || []).map((a) => a.id);

      // ── 2. Account transactions sil ──
      if (accountIds.length > 0) {
        await supabase
          .from("account_transactions")
          .delete()
          .in("account_id", accountIds);
      }

      // ── 3. Sale ID'leri bul (müşteri) ──
      const { data: sales } = await supabase
        .from("sales")
        .select("id")
        .eq("contact_id", id);
      const saleIds = (sales || []).map((s) => s.id);

      // ── 4. Purchase ID'leri bul (tedarikçi) ──
      const { data: purchases } = await supabase
        .from("purchases")
        .select("id")
        .eq("contact_id", id);
      const purchaseIds = (purchases || []).map((p) => p.id);

      // ── 5. Delivery ID'leri bul (sale + purchase üzerinden) ──
      let deliveryIds: string[] = [];
      if (saleIds.length > 0) {
        const { data: saleDeliveries } = await supabase
          .from("deliveries")
          .select("id")
          .in("sale_id", saleIds);
        deliveryIds.push(...(saleDeliveries || []).map((d) => d.id));
      }
      if (purchaseIds.length > 0) {
        const { data: purchaseDeliveries } = await supabase
          .from("deliveries")
          .select("id")
          .in("purchase_id", purchaseIds);
        deliveryIds.push(...(purchaseDeliveries || []).map((d) => d.id));
      }
      deliveryIds = [...new Set(deliveryIds)];

      // ── 6. Carrier transactions sil (delivery üzerinden) ──
      if (deliveryIds.length > 0) {
        await supabase
          .from("carrier_transactions")
          .delete()
          .in("reference_id", deliveryIds);
      }

      // ── 7. Checks sil ──
      await supabase.from("checks").delete().eq("contact_id", id);

      // ── 8. Payments sil ──
      await supabase.from("payments").delete().eq("contact_id", id);

      // ── 9. Deliveries sil ──
      if (saleIds.length > 0) {
        await supabase.from("deliveries").delete().in("sale_id", saleIds);
      }
      if (purchaseIds.length > 0) {
        await supabase.from("deliveries").delete().in("purchase_id", purchaseIds);
      }

      // ── 10. Inventory movements sil (sale/purchase referansları) ──
      const refIds = [...saleIds, ...purchaseIds, ...deliveryIds];
      if (refIds.length > 0) {
        await supabase
          .from("inventory_movements")
          .delete()
          .in("reference_id", refIds);
      }

      // ── 11. Sales sil ──
      if (saleIds.length > 0) {
        await supabase.from("sales").delete().in("id", saleIds);
      }

      // ── 12. Purchases sil ──
      if (purchaseIds.length > 0) {
        await supabase.from("purchases").delete().in("id", purchaseIds);
      }

      // ── 13. Accounts sil ──
      await supabase.from("accounts").delete().eq("contact_id", id);

      // ── 14. Contact sil ──
      const { error } = await supabase
        .from("contacts")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTACTS_KEY });
      queryClient.invalidateQueries({ queryKey: ["account_summary"] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["deliveries"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["checks"] });
    },
  });
}
