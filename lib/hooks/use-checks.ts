"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Check, CheckInsert, CheckUpdate } from "@/lib/types/database.types";

const CHECKS_KEY = ["checks"];

const INVALIDATE_KEYS = [
  CHECKS_KEY,
  ["account_summary"],
  ["account_transactions"],
  ["account_by_contact"],
  ["payments"],
  ["dashboard"],
];

export function useChecks() {
  const supabase = createClient();

  return useQuery({
    queryKey: CHECKS_KEY,
    queryFn: async () => {
      // Try with contact join first
      const { data, error } = await supabase
        .from("checks")
        .select("*, contact:contacts(id, name, type)")
        .is("deleted_at", null)
        .order("due_date", { ascending: true });

      if (!error) return data as Check[];

      // Fallback: separate queries if join fails
      const { data: checks, error: chkErr } = await supabase
        .from("checks")
        .select("*")
        .is("deleted_at", null)
        .order("due_date", { ascending: true });
      if (chkErr) throw chkErr;

      // Manually attach contact names
      const contactIds = [...new Set((checks || []).map((c) => c.contact_id).filter(Boolean))];
      let contactMap = new Map<string, { id: string; name: string; type: string; phone: string | null }>();
      if (contactIds.length > 0) {
        const { data: contacts } = await supabase
          .from("contacts")
          .select("id, name, type, phone")
          .in("id", contactIds);
        if (contacts) {
          contactMap = new Map(contacts.map((c) => [c.id, c]));
        }
      }

      return (checks || []).map((c) => ({
        ...c,
        contact: contactMap.get(c.contact_id) || null,
      })) as Check[];
    },
  });
}

// Helper: get account_id for a contact
async function getAccountId(supabase: ReturnType<typeof createClient>, contactId: string): Promise<string> {
  const { data, error } = await supabase
    .from("accounts")
    .select("id")
    .eq("contact_id", contactId)
    .single();
  if (error) throw new Error("Cari hesap bulunamadı. Kişi kaydını kontrol edin.");
  return data.id;
}

/**
 * Create check WITH immediate balance effect:
 * - Received check → credit on customer account (their debt decreases)
 * - Given check → debit on supplier account (our debt decreases)
 */
export function useCreateCheckWithTransaction() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: CheckInsert) => {
      // 1. Insert check
      const { data: check, error } = await supabase
        .from("checks")
        .insert(values)
        .select()
        .single();
      if (error) throw error;

      // 2. Create account_transaction for balance effect
      const accountId = await getAccountId(supabase, values.contact_id);
      const typeLabel = values.type === "check" ? "Çek" : "Senet";
      const noLabel = values.serial_no ? ` No: ${values.serial_no}` : "";

      if (values.direction === "received") {
        // Received from customer → credit (reduces their debt to us)
        const { error: txErr } = await supabase
          .from("account_transactions")
          .insert({
            account_id: accountId,
            type: "credit",
            amount: values.amount,
            description: `${typeLabel} Tahsilat${noLabel}`,
            reference_type: "payment",
            reference_id: check.id,
            transaction_date: values.issue_date,
          });
        if (txErr) throw txErr;
      } else {
        // Given to supplier → debit (reduces our debt to them)
        const { error: txErr } = await supabase
          .from("account_transactions")
          .insert({
            account_id: accountId,
            type: "debit",
            amount: values.amount,
            description: `${typeLabel} Ödeme${noLabel}`,
            reference_type: "payment",
            reference_id: check.id,
            transaction_date: values.issue_date,
          });
        if (txErr) throw txErr;
      }

      return check as Check;
    },
    onSuccess: () => {
      INVALIDATE_KEYS.forEach((key) =>
        queryClient.invalidateQueries({ queryKey: key })
      );
    },
  });
}

/**
 * Simple create check (no transaction) — for internal use like endorsement target
 */
export function useCreateCheck() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: CheckInsert) => {
      const { data, error } = await supabase
        .from("checks")
        .insert(values)
        .select()
        .single();
      if (error) throw error;
      return data as Check;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHECKS_KEY });
    },
  });
}

/**
 * Endorse check: mark original as endorsed + create new check for target + account_transactions
 */
export function useEndorseCheck() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      checkId,
      targetContactId,
      targetContactName,
      endorseDate,
    }: {
      checkId: string;
      targetContactId: string;
      targetContactName: string;
      endorseDate: string;
    }) => {
      // 1. Get original check
      const { data: original, error: getErr } = await supabase
        .from("checks")
        .select("*")
        .eq("id", checkId)
        .single();
      if (getErr) throw getErr;

      // Get original contact name
      const { data: originalContact } = await supabase
        .from("contacts")
        .select("name")
        .eq("id", original.contact_id)
        .single();
      const originalContactName = originalContact?.name || "—";

      const typeLabel = original.type === "check" ? "Çek" : "Senet";
      const noLabel = original.serial_no ? ` No: ${original.serial_no}` : "";

      // 2. Update original check → endorsed
      const { error: updErr } = await supabase
        .from("checks")
        .update({
          status: "endorsed",
          endorsed_to: targetContactName,
        })
        .eq("id", checkId);
      if (updErr) throw updErr;

      // 3. Create new check for target contact (given, pending)
      const { error: newErr } = await supabase
        .from("checks")
        .insert({
          contact_id: targetContactId,
          type: original.type,
          direction: "given",
          serial_no: original.serial_no,
          bank_name: original.bank_name,
          branch: original.branch,
          amount: original.amount,
          issue_date: endorseDate,
          due_date: original.due_date,
          status: "pending",
          notes: `Ciro - ${originalContactName}'dan alınan ${typeLabel.toLowerCase()}`,
        });
      if (newErr) throw newErr;

      // 4. Account transaction: Target contact (supplier) → debit (our debt decreases)
      const targetAccountId = await getAccountId(supabase, targetContactId);
      const { error: txTargetErr } = await supabase
        .from("account_transactions")
        .insert({
          account_id: targetAccountId,
          type: "debit",
          amount: original.amount,
          description: `${typeLabel} Ciro${noLabel}`,
          reference_type: "payment",
          reference_id: checkId,
          transaction_date: endorseDate,
        });
      if (txTargetErr) throw txTargetErr;

      return original;
    },
    onSuccess: () => {
      INVALIDATE_KEYS.forEach((key) =>
        queryClient.invalidateQueries({ queryKey: key })
      );
    },
  });
}

export function useUpdateCheck() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...values }: CheckUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("checks")
        .update(values)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Check;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHECKS_KEY });
    },
  });
}

export function useDeleteCheck() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("checks")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHECKS_KEY });
    },
  });
}
