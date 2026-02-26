"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Purchase, PurchaseInsert, PurchaseUpdate } from "@/lib/types/database.types";

const PURCHASES_KEY = ["purchases"];
const SELECT_WITH_JOINS = "*, contact:contacts(*), feed_type:feed_types(*), warehouse:warehouses(*)";

export function usePurchases() {
  const supabase = createClient();

  return useQuery({
    queryKey: PURCHASES_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchases")
        .select(SELECT_WITH_JOINS)
        .order("purchase_date", { ascending: false });
      if (error) throw error;
      return data as Purchase[];
    },
  });
}

export function usePurchase(id: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: [...PURCHASES_KEY, id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchases")
        .select(SELECT_WITH_JOINS)
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as Purchase;
    },
    enabled: !!id,
  });
}

export function useCreatePurchase() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: PurchaseInsert) => {
      // Generate purchase_no if not provided (trigger may not exist)
      const purchaseNo = values.purchase_no || `AL-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`;
      // total_amount is GENERATED ALWAYS AS (quantity * unit_price) — never send it
      const { total_amount: _unused, ...rest } = values;

      const { data, error } = await supabase
        .from("purchases")
        .insert({
          ...rest,
          purchase_no: purchaseNo,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Purchase;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PURCHASES_KEY });
    },
  });
}

export function useUpdatePurchase() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...values }: PurchaseUpdate & { id: string }) => {
      const { total_amount: _unused, ...updateValues } = values;
      const { data, error } = await supabase
        .from("purchases")
        .update(updateValues)
        .eq("id", id)
        .select(SELECT_WITH_JOINS)
        .single();
      if (error) throw error;
      return data as Purchase;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PURCHASES_KEY });
    },
  });
}

export function useDeletePurchase() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("purchases")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PURCHASES_KEY });
    },
  });
}
