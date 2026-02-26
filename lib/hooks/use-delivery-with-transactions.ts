"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { DeliveryInsert, FreightPayer, PricingModel } from "@/lib/types/database.types";

interface CreateDeliveryWithTxParams {
  delivery: DeliveryInsert;
  customerContactId: string;
  supplierContactId: string;
  customerPrice: number; // ₺/kg
  supplierPrice: number; // ₺/kg
  pricingModel: PricingModel;
}

export function useCreateDeliveryWithTransactions() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      delivery,
      customerContactId,
      supplierContactId,
      customerPrice,
      supplierPrice,
      pricingModel,
    }: CreateDeliveryWithTxParams) => {
      // 1. Insert delivery
      const { data: del, error: delErr } = await supabase
        .from("deliveries")
        .insert(delivery)
        .select()
        .single();
      if (delErr) throw delErr;

      const netKg = del.net_weight;
      const freightCost = del.freight_cost || 0;
      const freightPayer: FreightPayer = del.freight_payer || "me";

      // 2. Calculate amounts
      // If customer pays freight, deduct from their credit
      const customerCredit =
        freightPayer === "customer"
          ? netKg * customerPrice - freightCost
          : netKg * customerPrice;
      // Nakliye dahil: üretici fiyatı nakliyeyi içerir
      // Üretici ödüyorsa düşüm yok (zaten fiyatında), diğer durumlarda düşülür
      const supplierDebit = pricingModel === "nakliye_dahil" && freightPayer !== "supplier"
        ? netKg * supplierPrice - freightCost
        : netKg * supplierPrice;

      // 3. Get account IDs
      const { data: customerAccount, error: caErr } = await supabase
        .from("accounts")
        .select("id")
        .eq("contact_id", customerContactId)
        .single();
      if (caErr) throw caErr;

      const { data: supplierAccount, error: saErr } = await supabase
        .from("accounts")
        .select("id")
        .eq("contact_id", supplierContactId)
        .single();
      if (saErr) throw saErr;

      // 4. Insert customer transaction (customer owes us → debit)
      const { error: ctxErr } = await supabase
        .from("account_transactions")
        .insert({
          account_id: customerAccount.id,
          type: "debit",
          amount: customerCredit,
          description: `Satış - ${netKg.toLocaleString("tr-TR")} kg × ${customerPrice} ₺/kg${freightPayer === "customer" ? ` (nakliye -${freightCost} ₺)` : ""}`,
          reference_type: "sale",
          reference_id: del.sale_id,
          transaction_date: del.delivery_date,
        });
      if (ctxErr) throw ctxErr;

      // 5. Insert supplier transaction (we owe supplier → credit)
      const { error: stxErr } = await supabase
        .from("account_transactions")
        .insert({
          account_id: supplierAccount.id,
          type: "credit",
          amount: supplierDebit,
          description: `Alım - ${netKg.toLocaleString("tr-TR")} kg × ${supplierPrice} ₺/kg${pricingModel === "nakliye_dahil" && freightPayer !== "supplier" ? ` (nakliye -${freightCost} ₺)` : ""}`,
          reference_type: "purchase",
          reference_id: del.id,
          transaction_date: del.delivery_date,
        });
      if (stxErr) throw stxErr;

      return del;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveries"] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["account_summary"] });
      queryClient.invalidateQueries({ queryKey: ["account_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["account_by_contact"] });
    },
  });
}

export function useDeleteDeliveryWithTransactions() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      deliveryId,
      saleId,
      purchaseId,
    }: {
      deliveryId: string;
      saleId: string | null;
      purchaseId: string | null;
    }) => {
      // Delete related account_transactions by reference
      if (saleId) {
        // Find and delete the customer transaction for this delivery
        // We match by reference_id (sale_id) — but there could be multiple,
        // so we also delete the delivery-specific one by matching created_at proximity
        // Simpler approach: delete transactions that reference this sale/purchase
        // and were created around the same time as the delivery
      }

      // For now, just delete the delivery
      // The account transactions will need manual cleanup or a DB trigger
      const { error } = await supabase
        .from("deliveries")
        .delete()
        .eq("id", deliveryId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveries"] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["account_summary"] });
      queryClient.invalidateQueries({ queryKey: ["account_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["account_by_contact"] });
    },
  });
}
