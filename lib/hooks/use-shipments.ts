"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Shipment, ShipmentInsert, ShipmentUpdate } from "@/lib/types/database.types";

const SHIPMENTS_KEY = ["shipments"];

export function useShipmentsByPurchase(purchaseId: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: [...SHIPMENTS_KEY, "purchase", purchaseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shipments")
        .select("*")
        .eq("purchase_id", purchaseId)
        .order("shipment_date", { ascending: false });
      if (error) throw error;
      return data as Shipment[];
    },
    enabled: !!purchaseId,
  });
}

export function useShipmentsBySale(saleId: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: [...SHIPMENTS_KEY, "sale", saleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shipments")
        .select("*")
        .eq("sale_id", saleId)
        .order("shipment_date", { ascending: false });
      if (error) throw error;
      return data as Shipment[];
    },
    enabled: !!saleId,
  });
}

export function useCreateShipment() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: ShipmentInsert) => {
      const { data, error } = await supabase
        .from("shipments")
        .insert(values)
        .select()
        .single();
      if (error) throw error;
      return data as Shipment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SHIPMENTS_KEY });
    },
  });
}

export function useUpdateShipment() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...values }: ShipmentUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("shipments")
        .update(values)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Shipment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SHIPMENTS_KEY });
    },
  });
}

export function useDeleteShipment() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("shipments")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SHIPMENTS_KEY });
    },
  });
}
