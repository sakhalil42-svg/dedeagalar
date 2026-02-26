"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Delivery, DeliveryInsert, DeliveryUpdate } from "@/lib/types/database.types";

const DELIVERIES_KEY = ["deliveries"];

export function useDeliveriesBySale(saleId: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: [...DELIVERIES_KEY, "sale", saleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deliveries")
        .select("*")
        .eq("sale_id", saleId)
        .order("delivery_date", { ascending: false });
      if (error) throw error;
      return data as Delivery[];
    },
    enabled: !!saleId,
  });
}

export function useDeliveriesByPurchase(purchaseId: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: [...DELIVERIES_KEY, "purchase", purchaseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deliveries")
        .select("*")
        .eq("purchase_id", purchaseId)
        .order("delivery_date", { ascending: false });
      if (error) throw error;
      return data as Delivery[];
    },
    enabled: !!purchaseId,
  });
}

export function useCreateDelivery() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: DeliveryInsert) => {
      const { data, error } = await supabase
        .from("deliveries")
        .insert(values)
        .select()
        .single();
      if (error) throw error;
      return data as Delivery;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DELIVERIES_KEY });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
    },
  });
}

export function useUpdateDelivery() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...values }: DeliveryUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("deliveries")
        .update(values)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Delivery;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DELIVERIES_KEY });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
    },
  });
}

// Today's deliveries with sale info (customer, feed type, price)
export interface TodayDelivery extends Delivery {
  sale?: {
    contact_id: string;
    unit_price: number;
    feed_type_id: string;
    contact?: { id: string; name: string; phone: string | null };
    feed_type?: { id: string; name: string };
  } | null;
}

export function useTodayDeliveries() {
  const supabase = createClient();
  const today = new Date().toISOString().split("T")[0];

  return useQuery({
    queryKey: [...DELIVERIES_KEY, "today", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deliveries")
        .select("*, sale:sales(contact_id, unit_price, feed_type_id, contact:contacts(id, name, phone), feed_type:feed_types(id, name))")
        .eq("delivery_date", today)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as TodayDelivery[];
    },
  });
}

export function useDeleteDelivery() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("deliveries")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DELIVERIES_KEY });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
    },
  });
}
