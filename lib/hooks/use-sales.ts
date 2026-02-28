"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Sale, SaleInsert, SaleUpdate } from "@/lib/types/database.types";

const SALES_KEY = ["sales"];
const SELECT_WITH_JOINS = "*, contact:contacts(*), feed_type:feed_types(*), warehouse:warehouses(*)";

export function useSales(seasonId?: string | null) {
  const supabase = createClient();

  return useQuery({
    queryKey: [...SALES_KEY, seasonId],
    queryFn: async () => {
      let query = supabase
        .from("sales")
        .select(SELECT_WITH_JOINS)
        .is("deleted_at", null)
        .order("sale_date", { ascending: false });
      if (seasonId) {
        query = query.eq("season_id", seasonId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as Sale[];
    },
  });
}

export function useSale(id: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: [...SALES_KEY, id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select(SELECT_WITH_JOINS)
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as Sale;
    },
    enabled: !!id,
  });
}

export function useCreateSale() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: SaleInsert) => {
      // Generate sale_no if not provided (trigger may not exist)
      const saleNo = values.sale_no || `ST-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`;
      // total_amount is GENERATED ALWAYS AS (quantity * unit_price) — never send it
      const { total_amount: _unused, ...rest } = values;

      const { data, error } = await supabase
        .from("sales")
        .insert({
          ...rest,
          sale_no: saleNo,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Sale;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SALES_KEY });
    },
  });
}

export function useUpdateSale() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...values }: SaleUpdate & { id: string }) => {
      const { total_amount: _unused, ...updateValues } = values;
      const { data, error } = await supabase
        .from("sales")
        .update(updateValues)
        .eq("id", id)
        .select(SELECT_WITH_JOINS)
        .single();
      if (error) throw error;
      return data as Sale;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SALES_KEY });
    },
  });
}

export function useDeleteSale() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("sales")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SALES_KEY });
    },
  });
}
