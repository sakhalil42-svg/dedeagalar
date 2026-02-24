"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Sale, SaleInsert, SaleUpdate } from "@/lib/types/database.types";

const SALES_KEY = ["sales"];
const SELECT_WITH_JOINS = "*, contact:contacts(*), feed_type:feed_types(*), warehouse:warehouses(*)";

export function useSales() {
  const supabase = createClient();

  return useQuery({
    queryKey: SALES_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select(SELECT_WITH_JOINS)
        .order("sale_date", { ascending: false });
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
      const { data, error } = await supabase
        .from("sales")
        .insert(values)
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

export function useUpdateSale() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...values }: SaleUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("sales")
        .update(values)
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
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SALES_KEY });
    },
  });
}
