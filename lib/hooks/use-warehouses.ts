"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Warehouse, WarehouseInsert, WarehouseUpdate } from "@/lib/types/database.types";

const WAREHOUSES_KEY = ["warehouses"];

export function useWarehouses(activeOnly = false) {
  const supabase = createClient();

  return useQuery({
    queryKey: activeOnly ? [...WAREHOUSES_KEY, "active"] : WAREHOUSES_KEY,
    queryFn: async () => {
      let query = supabase
        .from("warehouses")
        .select("*")
        .order("name");

      if (activeOnly) {
        query = query.eq("is_active", true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Warehouse[];
    },
  });
}

export function useCreateWarehouse() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: WarehouseInsert) => {
      const { data, error } = await supabase
        .from("warehouses")
        .insert(values)
        .select()
        .single();
      if (error) throw error;
      return data as Warehouse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WAREHOUSES_KEY });
    },
  });
}

export function useUpdateWarehouse() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...values }: WarehouseUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("warehouses")
        .update(values)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Warehouse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WAREHOUSES_KEY });
    },
  });
}

export function useDeleteWarehouse() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("warehouses")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WAREHOUSES_KEY });
    },
  });
}
