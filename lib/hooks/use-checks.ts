"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Check, CheckInsert, CheckUpdate } from "@/lib/types/database.types";

const CHECKS_KEY = ["checks"];

export function useChecks() {
  const supabase = createClient();

  return useQuery({
    queryKey: CHECKS_KEY,
    queryFn: async () => {
      // Try with contact join first
      const { data, error } = await supabase
        .from("checks")
        .select("*, contact:contacts(id, name, type)")
        .order("due_date", { ascending: true });

      if (!error) return data as Check[];

      // Fallback: separate queries if join fails
      const { data: checks, error: chkErr } = await supabase
        .from("checks")
        .select("*")
        .order("due_date", { ascending: true });
      if (chkErr) throw chkErr;

      // Manually attach contact names
      const contactIds = [...new Set((checks || []).map((c) => c.contact_id).filter(Boolean))];
      let contactMap = new Map<string, { id: string; name: string; type: string }>();
      if (contactIds.length > 0) {
        const { data: contacts } = await supabase
          .from("contacts")
          .select("id, name, type")
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
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHECKS_KEY });
    },
  });
}
