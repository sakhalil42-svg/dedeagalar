"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Check, CheckInsert, CheckUpdate } from "@/lib/types/database.types";

const CHECKS_KEY = ["checks"];
const SELECT_WITH_JOINS = "*, contact:contacts(id, name, type)";

export function useChecks() {
  const supabase = createClient();

  return useQuery({
    queryKey: CHECKS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checks")
        .select(SELECT_WITH_JOINS)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data as Check[];
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
        .select(SELECT_WITH_JOINS)
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
        .select(SELECT_WITH_JOINS)
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
