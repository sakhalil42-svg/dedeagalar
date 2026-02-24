"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Payment, PaymentInsert } from "@/lib/types/database.types";

const PAYMENTS_KEY = ["payments"];
const SELECT_WITH_JOINS = "*, contact:contacts(id, name, type)";

export function usePayments() {
  const supabase = createClient();

  return useQuery({
    queryKey: PAYMENTS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select(SELECT_WITH_JOINS)
        .order("payment_date", { ascending: false });
      if (error) throw error;
      return data as Payment[];
    },
  });
}

export function useCreatePayment() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: PaymentInsert) => {
      const { data, error } = await supabase
        .from("payments")
        .insert(values)
        .select(SELECT_WITH_JOINS)
        .single();
      if (error) throw error;
      return data as Payment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PAYMENTS_KEY });
      queryClient.invalidateQueries({ queryKey: ["account_summary"] });
      queryClient.invalidateQueries({ queryKey: ["account_transactions"] });
    },
  });
}

export function useDeletePayment() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("payments")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PAYMENTS_KEY });
      queryClient.invalidateQueries({ queryKey: ["account_summary"] });
      queryClient.invalidateQueries({ queryKey: ["account_transactions"] });
    },
  });
}
