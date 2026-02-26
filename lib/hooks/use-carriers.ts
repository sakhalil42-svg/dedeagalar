"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Carrier, CarrierInsert, CarrierUpdate } from "@/lib/types/database.types";

const CARRIERS_KEY = ["carriers"];

export function useCarriers() {
  const supabase = createClient();

  return useQuery({
    queryKey: CARRIERS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("carriers")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Carrier[];
    },
  });
}

export function useCreateCarrier() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: CarrierInsert) => {
      const { data, error } = await supabase
        .from("carriers")
        .insert(values)
        .select()
        .single();
      if (error) throw error;
      return data as Carrier;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CARRIERS_KEY });
    },
  });
}

export function useUpdateCarrier() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...values }: CarrierUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("carriers")
        .update(values)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Carrier;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CARRIERS_KEY });
    },
  });
}

export function useDeleteCarrier() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Soft delete — just deactivate
      const { error } = await supabase
        .from("carriers")
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CARRIERS_KEY });
    },
  });
}
