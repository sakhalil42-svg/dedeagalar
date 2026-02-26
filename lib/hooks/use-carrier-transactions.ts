"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type {
  CarrierTransaction,
  CarrierTransactionInsert,
  CarrierBalance,
} from "@/lib/types/database.types";

const CARRIER_TX_KEY = ["carrier_transactions"];
const CARRIER_BALANCE_KEY = ["carrier_balances"];

// ─── Get all transactions for a carrier ───
export function useCarrierTransactions(carrierId: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: [...CARRIER_TX_KEY, carrierId],
    enabled: !!carrierId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("carrier_transactions")
        .select("*")
        .eq("carrier_id", carrierId)
        .is("deleted_at", null)
        .order("transaction_date", { ascending: false });
      if (error) throw error;
      return data as CarrierTransaction[];
    },
  });
}

// ─── Get all carrier balances (from view) ───
export function useCarrierBalances() {
  const supabase = createClient();

  return useQuery({
    queryKey: CARRIER_BALANCE_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_carrier_balance")
        .select("*")
        .order("balance", { ascending: false });
      if (error) throw error;
      return data as CarrierBalance[];
    },
  });
}

// ─── Create carrier transaction ───
export function useCreateCarrierTransaction() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: CarrierTransactionInsert) => {
      const { data, error } = await supabase
        .from("carrier_transactions")
        .insert(values)
        .select()
        .single();
      if (error) throw error;
      return data as CarrierTransaction;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CARRIER_TX_KEY });
      queryClient.invalidateQueries({ queryKey: CARRIER_BALANCE_KEY });
    },
  });
}

// ─── Delete carrier transaction by reference_id (for reversals) ───
export function useDeleteCarrierTransactionByRef() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (referenceId: string) => {
      const { error } = await supabase
        .from("carrier_transactions")
        .delete()
        .eq("reference_id", referenceId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CARRIER_TX_KEY });
      queryClient.invalidateQueries({ queryKey: CARRIER_BALANCE_KEY });
    },
  });
}
