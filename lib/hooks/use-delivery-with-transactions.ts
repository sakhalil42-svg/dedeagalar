"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { DeliveryInsert, DeliveryUpdate, FreightPayer, PricingModel } from "@/lib/types/database.types";

// ─── Helper: find carrier ID by name or plate ───
async function findCarrierId(
  supabase: ReturnType<typeof createClient>,
  carrierName: string | null | undefined,
  vehiclePlate: string | null | undefined
): Promise<string | null> {
  // 1. Try by carrier name
  if (carrierName) {
    const { data: carrier } = await supabase
      .from("carriers")
      .select("id")
      .eq("name", carrierName)
      .eq("is_active", true)
      .maybeSingle();
    if (carrier) return carrier.id;
  }

  // 2. Try by plate → vehicle → carrier_id
  if (vehiclePlate) {
    const { data: vehicle } = await supabase
      .from("vehicles")
      .select("carrier_id")
      .eq("plate", vehiclePlate)
      .maybeSingle();
    if (vehicle?.carrier_id) return vehicle.carrier_id;
  }

  return null;
}

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
      const customerCredit =
        freightPayer === "customer"
          ? netKg * customerPrice - freightCost
          : netKg * customerPrice;
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

      // 6. Carrier transaction — müşteri ödemiyorsa → nakliyeci borcuma ekle
      if (freightPayer !== "customer" && freightCost > 0) {
        const carrierId = await findCarrierId(supabase, del.carrier_name, del.vehicle_plate);
        if (carrierId) {
          await supabase
            .from("carrier_transactions")
            .insert({
              carrier_id: carrierId,
              type: "freight_charge",
              amount: freightCost,
              description: `Nakliye - ${netKg.toLocaleString("tr-TR")} kg, ${del.vehicle_plate || "-"}`,
              reference_id: del.id,
              transaction_date: del.delivery_date,
            });
        }
      }

      return del;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveries"] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["account_summary"] });
      queryClient.invalidateQueries({ queryKey: ["account_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["account_by_contact"] });
      queryClient.invalidateQueries({ queryKey: ["carrier_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["carrier_balances"] });
    },
  });
}

// ─── Cancel Sale (iptal) with reverse transactions ───
export function useCancelSale() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      saleId,
      cancelNote,
    }: {
      saleId: string;
      cancelNote?: string;
    }) => {
      // 1. Get the sale
      const { data: sale, error: saleErr } = await supabase
        .from("sales")
        .select("*, contact:contacts(*)")
        .eq("id", saleId)
        .single();
      if (saleErr) throw saleErr;

      // 2. Get all deliveries for this sale
      const { data: deliveries } = await supabase
        .from("deliveries")
        .select("*")
        .eq("sale_id", saleId);

      // 3. Get customer account
      const { data: customerAccount } = await supabase
        .from("accounts")
        .select("id")
        .eq("contact_id", sale.contact_id)
        .single();

      // 4. Reverse customer transactions (credit to reduce their debt)
      if (customerAccount) {
        // Find total debited for this sale
        const { data: existingTxs } = await supabase
          .from("account_transactions")
          .select("amount")
          .eq("reference_type", "sale")
          .eq("reference_id", saleId)
          .eq("type", "debit");

        const totalDebited = (existingTxs || []).reduce((s, t) => s + Number(t.amount), 0);
        if (totalDebited > 0) {
          await supabase.from("account_transactions").insert({
            account_id: customerAccount.id,
            type: "credit",
            amount: totalDebited,
            description: `İptal - ${sale.sale_no}${cancelNote ? ` (${cancelNote})` : ""}`,
            reference_type: "sale",
            reference_id: saleId,
            transaction_date: new Date().toISOString().split("T")[0],
          });
        }
      }

      // 5. Reverse supplier transactions for each delivery
      for (const del of deliveries || []) {
        if (!del.purchase_id) continue;

        // Find supplier via purchase
        const { data: purchase } = await supabase
          .from("purchases")
          .select("contact_id")
          .eq("id", del.purchase_id)
          .maybeSingle();

        if (purchase) {
          const { data: supplierAccount } = await supabase
            .from("accounts")
            .select("id")
            .eq("contact_id", purchase.contact_id)
            .single();

          if (supplierAccount) {
            // Find total credited for this delivery
            const { data: suppTxs } = await supabase
              .from("account_transactions")
              .select("amount")
              .eq("reference_type", "purchase")
              .eq("reference_id", del.id)
              .eq("type", "credit");

            const totalCredited = (suppTxs || []).reduce((s, t) => s + Number(t.amount), 0);
            if (totalCredited > 0) {
              await supabase.from("account_transactions").insert({
                account_id: supplierAccount.id,
                type: "debit",
                amount: totalCredited,
                description: `İptal - ${sale.sale_no}${cancelNote ? ` (${cancelNote})` : ""}`,
                reference_type: "purchase",
                reference_id: del.id,
                transaction_date: new Date().toISOString().split("T")[0],
              });
            }
          }
        }

        // 6. Reverse carrier transactions for this delivery
        await supabase
          .from("carrier_transactions")
          .delete()
          .eq("reference_id", del.id);
      }

      // 7. Update sale status to cancelled
      await supabase
        .from("sales")
        .update({
          status: "cancelled",
          notes: cancelNote
            ? `${sale.notes ? sale.notes + "\n" : ""}İPTAL: ${cancelNote}`
            : sale.notes,
        })
        .eq("id", saleId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["deliveries"] });
      queryClient.invalidateQueries({ queryKey: ["account_summary"] });
      queryClient.invalidateQueries({ queryKey: ["account_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["account_by_contact"] });
      queryClient.invalidateQueries({ queryKey: ["carrier_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["carrier_balances"] });
    },
  });
}

// ─── Reassign Sale to different customer ───
export function useReassignSale() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      saleId,
      newCustomerId,
      newPrice,
    }: {
      saleId: string;
      newCustomerId: string;
      newPrice?: number;
    }) => {
      // 1. Get original sale
      const { data: sale, error: saleErr } = await supabase
        .from("sales")
        .select("*")
        .eq("id", saleId)
        .single();
      if (saleErr) throw saleErr;

      const unitPrice = newPrice ?? sale.unit_price;

      // 2. Get old customer account
      const { data: oldAccount } = await supabase
        .from("accounts")
        .select("id")
        .eq("contact_id", sale.contact_id)
        .single();

      // 3. Reverse old customer transactions
      if (oldAccount) {
        const { data: existingTxs } = await supabase
          .from("account_transactions")
          .select("amount")
          .eq("reference_type", "sale")
          .eq("reference_id", saleId)
          .eq("type", "debit");

        const totalDebited = (existingTxs || []).reduce((s, t) => s + Number(t.amount), 0);
        if (totalDebited > 0) {
          await supabase.from("account_transactions").insert({
            account_id: oldAccount.id,
            type: "credit",
            amount: totalDebited,
            description: `Müşteri değişikliği - ${sale.sale_no}`,
            reference_type: "sale",
            reference_id: saleId,
            transaction_date: new Date().toISOString().split("T")[0],
          });
        }
      }

      // 4. Get new customer account
      const { data: newAccount } = await supabase
        .from("accounts")
        .select("id")
        .eq("contact_id", newCustomerId)
        .single();
      if (!newAccount) throw new Error("Yeni müşterinin cari hesabı bulunamadı");

      // 5. Get deliveries and recalculate
      const { data: deliveries } = await supabase
        .from("deliveries")
        .select("*")
        .eq("sale_id", saleId);

      let totalNewDebit = 0;
      for (const del of deliveries || []) {
        const freightCost = del.freight_cost || 0;
        const amount =
          del.freight_payer === "customer"
            ? del.net_weight * unitPrice - freightCost
            : del.net_weight * unitPrice;
        totalNewDebit += amount;
      }

      // 6. Create new customer transaction
      if (totalNewDebit > 0) {
        await supabase.from("account_transactions").insert({
          account_id: newAccount.id,
          type: "debit",
          amount: totalNewDebit,
          description: `Satış atama - ${sale.sale_no}`,
          reference_type: "sale",
          reference_id: saleId,
          transaction_date: new Date().toISOString().split("T")[0],
        });
      }

      // 7. Update sale
      await supabase
        .from("sales")
        .update({
          contact_id: newCustomerId,
          unit_price: unitPrice,
          status: "delivered",
        })
        .eq("id", saleId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["account_summary"] });
      queryClient.invalidateQueries({ queryKey: ["account_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["account_by_contact"] });
    },
  });
}

// ─── Return delivery (iade) ───
export function useReturnDelivery() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      deliveryId,
      returnKg,
      returnNote,
      returnDate,
    }: {
      deliveryId: string;
      returnKg: number;
      returnNote?: string;
      returnDate: string;
    }) => {
      // 1. Get original delivery
      const { data: delivery, error: delErr } = await supabase
        .from("deliveries")
        .select("*")
        .eq("id", deliveryId)
        .single();
      if (delErr) throw delErr;

      if (!delivery.sale_id) throw new Error("Sale ID bulunamadı");

      // 2. Get sale for price
      const { data: sale } = await supabase
        .from("sales")
        .select("unit_price, contact_id, sale_no")
        .eq("id", delivery.sale_id)
        .single();
      if (!sale) throw new Error("Satış kaydı bulunamadı");

      const returnAmount = returnKg * sale.unit_price;

      // 3. Get customer account
      const { data: account } = await supabase
        .from("accounts")
        .select("id")
        .eq("contact_id", sale.contact_id)
        .single();
      if (!account) throw new Error("Müşteri hesabı bulunamadı");

      // 4. Create return delivery (negative weight flag via notes)
      const { data: returnDel, error: retErr } = await supabase
        .from("deliveries")
        .insert({
          sale_id: delivery.sale_id,
          purchase_id: delivery.purchase_id,
          delivery_date: returnDate,
          net_weight: -returnKg,
          vehicle_plate: delivery.vehicle_plate,
          notes: `İADE: ${returnNote || ""}`.trim(),
        })
        .select()
        .single();
      if (retErr) throw retErr;

      // 5. Reverse customer credit (reduce their debt)
      await supabase.from("account_transactions").insert({
        account_id: account.id,
        type: "credit",
        amount: returnAmount,
        description: `İade - ${returnKg.toLocaleString("tr-TR")} kg × ${sale.unit_price} ₺/kg${returnNote ? ` (${returnNote})` : ""}`,
        reference_type: "sale",
        reference_id: delivery.sale_id,
        transaction_date: returnDate,
      });

      // 6. Reverse supplier debit if purchase exists
      if (delivery.purchase_id) {
        const { data: purchase } = await supabase
          .from("purchases")
          .select("contact_id, unit_price")
          .eq("id", delivery.purchase_id)
          .maybeSingle();

        if (purchase) {
          const { data: suppAccount } = await supabase
            .from("accounts")
            .select("id")
            .eq("contact_id", purchase.contact_id)
            .single();

          if (suppAccount) {
            const suppReturnAmount = returnKg * purchase.unit_price;
            await supabase.from("account_transactions").insert({
              account_id: suppAccount.id,
              type: "debit",
              amount: suppReturnAmount,
              description: `İade - ${returnKg.toLocaleString("tr-TR")} kg × ${purchase.unit_price} ₺/kg`,
              reference_type: "purchase",
              reference_id: returnDel.id,
              transaction_date: returnDate,
            });
          }
        }
      }

      return returnDel;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveries"] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["account_summary"] });
      queryClient.invalidateQueries({ queryKey: ["account_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["account_by_contact"] });
    },
  });
}

// ─── Update delivery with carrier transaction sync ───
export function useUpdateDeliveryWithCarrierSync() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...values
    }: DeliveryUpdate & { id: string }) => {
      // 1. Get old delivery state
      const { data: oldDel } = await supabase
        .from("deliveries")
        .select("*")
        .eq("id", id)
        .single();
      if (!oldDel) throw new Error("Delivery bulunamadı");

      // 2. Update the delivery
      const { data: newDel, error } = await supabase
        .from("deliveries")
        .update(values)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;

      const oldPayer = oldDel.freight_payer || "me";
      const newPayer = newDel.freight_payer || "me";
      const oldFreight = oldDel.freight_cost || 0;
      const newFreight = newDel.freight_cost || 0;
      const oldHadCarrierTx = oldPayer !== "customer" && oldFreight > 0;
      const newNeedsCarrierTx = newPayer !== "customer" && newFreight > 0;

      // 3. Handle carrier transaction changes
      if (oldHadCarrierTx && !newNeedsCarrierTx) {
        // Was "me" → now not "me" OR freight removed: delete carrier tx
        await supabase
          .from("carrier_transactions")
          .delete()
          .eq("reference_id", id);
      } else if (!oldHadCarrierTx && newNeedsCarrierTx) {
        // Was not "me" → now "me": create carrier tx
        const carrierId = await findCarrierId(supabase, newDel.carrier_name, newDel.vehicle_plate);
        if (carrierId) {
          await supabase
            .from("carrier_transactions")
            .insert({
              carrier_id: carrierId,
              type: "freight_charge",
              amount: newFreight,
              description: `Nakliye - ${newDel.net_weight.toLocaleString("tr-TR")} kg, ${newDel.vehicle_plate || "-"}`,
              reference_id: id,
              transaction_date: newDel.delivery_date,
            });
        }
      } else if (oldHadCarrierTx && newNeedsCarrierTx) {
        // Still "me" — check if amount or carrier changed
        const oldCarrierId = await findCarrierId(supabase, oldDel.carrier_name, oldDel.vehicle_plate);
        const newCarrierId = await findCarrierId(supabase, newDel.carrier_name, newDel.vehicle_plate);

        if (oldCarrierId !== newCarrierId) {
          // Carrier changed — delete old, create new
          await supabase
            .from("carrier_transactions")
            .delete()
            .eq("reference_id", id);
          if (newCarrierId) {
            await supabase
              .from("carrier_transactions")
              .insert({
                carrier_id: newCarrierId,
                type: "freight_charge",
                amount: newFreight,
                description: `Nakliye - ${newDel.net_weight.toLocaleString("tr-TR")} kg, ${newDel.vehicle_plate || "-"}`,
                reference_id: id,
                transaction_date: newDel.delivery_date,
              });
          }
        } else if (oldFreight !== newFreight && newCarrierId) {
          // Same carrier, amount changed — update
          await supabase
            .from("carrier_transactions")
            .update({ amount: newFreight })
            .eq("reference_id", id)
            .eq("type", "freight_charge");
        }
      }

      return newDel;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveries"] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["account_summary"] });
      queryClient.invalidateQueries({ queryKey: ["account_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["account_by_contact"] });
      queryClient.invalidateQueries({ queryKey: ["carrier_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["carrier_balances"] });
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
      // Delete carrier transaction for this delivery
      await supabase
        .from("carrier_transactions")
        .delete()
        .eq("reference_id", deliveryId);

      // Delete the delivery
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
      queryClient.invalidateQueries({ queryKey: ["carrier_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["carrier_balances"] });
    },
  });
}
