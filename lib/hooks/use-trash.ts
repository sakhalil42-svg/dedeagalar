"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { writeAuditLog } from "./use-audit-log";
import { recalcAccountBalance } from "./use-delivery-with-transactions";

const TRASH_KEY = ["trash"];

export interface TrashedRecord {
  id: string;
  table_name: string;
  deleted_at: string;
  summary: string;
  details: Record<string, unknown>;
}

export function useTrashedRecords() {
  const supabase = createClient();

  return useQuery({
    queryKey: TRASH_KEY,
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const cutoff = thirtyDaysAgo.toISOString();

      const results: TrashedRecord[] = [];

      // Deliveries
      const { data: dels } = await supabase
        .from("deliveries")
        .select("id, deleted_at, delivery_date, net_weight, vehicle_plate, ticket_no, carrier_name")
        .not("deleted_at", "is", null)
        .gte("deleted_at", cutoff)
        .order("deleted_at", { ascending: false });

      if (dels) {
        for (const d of dels) {
          results.push({
            id: d.id,
            table_name: "deliveries",
            deleted_at: d.deleted_at!,
            summary: `Sevkiyat: ${d.net_weight?.toLocaleString("tr-TR")} kg${d.vehicle_plate ? ` · ${d.vehicle_plate}` : ""}${d.ticket_no ? ` · #${d.ticket_no}` : ""}`,
            details: d as Record<string, unknown>,
          });
        }
      }

      // Checks
      const { data: chks } = await supabase
        .from("checks")
        .select("id, deleted_at, type, amount, serial_no, due_date, contact_id")
        .not("deleted_at", "is", null)
        .gte("deleted_at", cutoff)
        .order("deleted_at", { ascending: false });

      if (chks) {
        for (const c of chks) {
          const label = c.type === "check" ? "Çek" : "Senet";
          results.push({
            id: c.id,
            table_name: "checks",
            deleted_at: c.deleted_at!,
            summary: `${label}: ${c.amount?.toLocaleString("tr-TR")} ₺${c.serial_no ? ` · No: ${c.serial_no}` : ""}`,
            details: c as Record<string, unknown>,
          });
        }
      }

      // Payments
      const { data: pays } = await supabase
        .from("payments")
        .select("id, deleted_at, amount, direction, method, payment_date, description")
        .not("deleted_at", "is", null)
        .gte("deleted_at", cutoff)
        .order("deleted_at", { ascending: false });

      if (pays) {
        for (const p of pays) {
          const dir = p.direction === "inbound" ? "Tahsilat" : "Ödeme";
          results.push({
            id: p.id,
            table_name: "payments",
            deleted_at: p.deleted_at!,
            summary: `${dir}: ${p.amount?.toLocaleString("tr-TR")} ₺${p.description ? ` · ${p.description}` : ""}`,
            details: p as Record<string, unknown>,
          });
        }
      }

      // Sort all by deleted_at desc
      results.sort((a, b) => new Date(b.deleted_at).getTime() - new Date(a.deleted_at).getTime());
      return results;
    },
  });
}

export function useRestoreRecord() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, table_name }: { id: string; table_name: string }) => {
      // Collect affected account IDs
      const affectedAccountIds: string[] = [];

      if (table_name === "payments") {
        // Restore payment AND its account_transactions
        const { data: payment } = await supabase
          .from("payments")
          .select("account_id")
          .eq("id", id)
          .maybeSingle();
        if (payment?.account_id) affectedAccountIds.push(payment.account_id);
        await supabase
          .from("account_transactions")
          .update({ deleted_at: null })
          .eq("reference_id", id)
          .eq("reference_type", "payment");
      } else if (table_name === "checks") {
        // Restore check AND its account_transactions
        const { data: check } = await supabase
          .from("checks")
          .select("contact_id")
          .eq("id", id)
          .maybeSingle();
        if (check?.contact_id) {
          const { data: account } = await supabase
            .from("accounts")
            .select("id")
            .eq("contact_id", check.contact_id)
            .maybeSingle();
          if (account) affectedAccountIds.push(account.id);
        }
        await supabase
          .from("account_transactions")
          .update({ deleted_at: null })
          .eq("reference_id", id)
          .eq("reference_type", "payment");
      }

      // Restore the record
      const { error } = await supabase
        .from(table_name)
        .update({ deleted_at: null })
        .eq("id", id);
      if (error) throw error;

      // Recalculate affected account balances
      for (const accountId of affectedAccountIds) {
        await recalcAccountBalance(supabase, accountId);
      }

      await writeAuditLog({
        table_name,
        record_id: id,
        action: "restore",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRASH_KEY });
      queryClient.invalidateQueries({ queryKey: ["deliveries"] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["checks"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["account_summary"] });
      queryClient.invalidateQueries({ queryKey: ["account_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["account_by_contact"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function usePermanentDelete() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, table_name }: { id: string; table_name: string }) => {
      // Collect affected account IDs before deleting
      const affectedAccountIds: string[] = [];

      if (table_name === "payments") {
        // Find account_id from payment
        const { data: payment } = await supabase
          .from("payments")
          .select("account_id")
          .eq("id", id)
          .maybeSingle();
        if (payment?.account_id) affectedAccountIds.push(payment.account_id);
        // Hard delete related account_transactions
        await supabase
          .from("account_transactions")
          .delete()
          .eq("reference_id", id)
          .eq("reference_type", "payment");
      } else if (table_name === "checks") {
        // Find contact → account
        const { data: check } = await supabase
          .from("checks")
          .select("contact_id")
          .eq("id", id)
          .maybeSingle();
        if (check?.contact_id) {
          const { data: account } = await supabase
            .from("accounts")
            .select("id")
            .eq("contact_id", check.contact_id)
            .maybeSingle();
          if (account) affectedAccountIds.push(account.id);
        }
        // Hard delete related account_transactions
        await supabase
          .from("account_transactions")
          .delete()
          .eq("reference_id", id)
          .eq("reference_type", "payment");
      } else if (table_name === "deliveries") {
        // Carrier transactions already hard deleted in soft delete step
        // Hard delete any reversal account_transactions for this delivery
        await supabase
          .from("account_transactions")
          .delete()
          .eq("reference_id", id)
          .eq("reference_type", "purchase");
      }

      // Hard delete the record
      const { error } = await supabase
        .from(table_name)
        .delete()
        .eq("id", id);
      if (error) throw error;

      // Recalculate affected account balances
      for (const accountId of affectedAccountIds) {
        await recalcAccountBalance(supabase, accountId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRASH_KEY });
      queryClient.invalidateQueries({ queryKey: ["account_summary"] });
      queryClient.invalidateQueries({ queryKey: ["account_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["account_by_contact"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
