"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Payment, PaymentInsert } from "@/lib/types/database.types";
import { recalcAccountBalance } from "./use-delivery-with-transactions";

const PAYMENTS_KEY = ["payments"];

export function usePayments() {
  const supabase = createClient();

  return useQuery({
    queryKey: PAYMENTS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*, contact:contacts(id, name, type)")
        .is("deleted_at", null)
        .order("payment_date", { ascending: false });
      if (error) {
        // Fallback without join if relation fails
        const { data: fallback, error: fbErr } = await supabase
          .from("payments")
          .select("*")
          .is("deleted_at", null)
          .order("payment_date", { ascending: false });
        if (fbErr) throw fbErr;
        return fallback as Payment[];
      }
      return data as Payment[];
    },
  });
}

export function useCreatePaymentWithTransaction() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      values: Omit<PaymentInsert, "account_id"> & { serial_no?: string; bank_name?: string; branch?: string; due_date?: string; season_id?: string | null }
    ) => {
      // 1. Get account_id from contact_id
      const { data: account, error: accErr } = await supabase
        .from("accounts")
        .select("id")
        .eq("contact_id", values.contact_id)
        .single();
      if (accErr) throw new Error("Cari hesap bulunamadı. Önce kişi kaydını kontrol edin.");

      // 2. Insert payment (include account_id)
      const { serial_no, bank_name, branch, due_date, season_id, ...paymentValues } = values;
      const { data: payment, error: payErr } = await supabase
        .from("payments")
        .insert({
          ...paymentValues,
          account_id: account.id,
        })
        .select()
        .single();
      if (payErr) throw payErr;

      // 3. Insert account_transaction
      // inbound (tahsilat) = müşteri bize ödüyor = credit (alacak azalır)
      // outbound (ödeme) = biz üreticiye ödüyoruz = debit (borç azalır)
      const txType = values.direction === "inbound" ? "credit" : "debit";
      const methodLabel = values.method === "cash" ? "Nakit" : values.method === "bank_transfer" ? "Havale" : values.method === "check" ? "Çek" : "Senet";
      const txDescription =
        values.direction === "inbound"
          ? `Tahsilat - ${methodLabel}`
          : `Ödeme - ${methodLabel}`;

      const { error: txErr } = await supabase
        .from("account_transactions")
        .insert({
          account_id: account.id,
          type: txType,
          amount: values.amount,
          description: values.description || txDescription,
          reference_type: "payment",
          reference_id: payment.id,
          transaction_date: values.payment_date,
          season_id: season_id || null,
        });
      if (txErr) throw txErr;

      // 4. If check or promissory_note, also create a check record
      if (
        (values.method === "check" || values.method === "promissory_note") &&
        due_date
      ) {
        const { error: chkErr } = await supabase.from("checks").insert({
          contact_id: values.contact_id,
          type: values.method === "check" ? "check" : "promissory_note",
          direction: values.direction === "inbound" ? "received" : "given",
          serial_no: serial_no || null,
          bank_name: bank_name || null,
          branch: branch || null,
          amount: values.amount,
          issue_date: values.payment_date,
          due_date: due_date,
          status: "pending",
          season_id: season_id || null,
        });
        if (chkErr) throw chkErr;
      }

      return payment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PAYMENTS_KEY });
      queryClient.invalidateQueries({ queryKey: ["account_summary"] });
      queryClient.invalidateQueries({ queryKey: ["account_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["account_by_contact"] });
      queryClient.invalidateQueries({ queryKey: ["checks"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
    },
  });
}

export function useDeletePaymentWithTransaction() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const now = new Date().toISOString();

      // 1. Get payment to find account_id
      const { data: payment } = await supabase
        .from("payments")
        .select("account_id")
        .eq("id", id)
        .single();

      // 2. Soft-delete related account_transactions
      await supabase
        .from("account_transactions")
        .update({ deleted_at: now })
        .eq("reference_id", id)
        .eq("reference_type", "payment");

      // 3. Soft-delete the payment
      const { error } = await supabase
        .from("payments")
        .update({ deleted_at: now })
        .eq("id", id);
      if (error) throw error;

      // 4. Recalculate account balance
      if (payment?.account_id) {
        await recalcAccountBalance(supabase, payment.account_id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PAYMENTS_KEY });
      queryClient.invalidateQueries({ queryKey: ["account_summary"] });
      queryClient.invalidateQueries({ queryKey: ["account_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["account_by_contact"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
