"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Contact, ContactInsert, ContactUpdate, ContactType } from "@/lib/types/database.types";

const CONTACTS_KEY = ["contacts"];

export function useContacts(filter?: ContactType) {
  const supabase = createClient();

  return useQuery({
    queryKey: filter ? [...CONTACTS_KEY, filter] : CONTACTS_KEY,
    queryFn: async () => {
      let query = supabase
        .from("contacts")
        .select("*")
        .order("name");

      if (filter) {
        query = query.or(`type.eq.${filter},type.eq.both`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Contact[];
    },
  });
}

export function useContact(id: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: [...CONTACTS_KEY, id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*, accounts(*)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as Contact & { accounts: { id: string; balance: number; total_debit: number; total_credit: number }[] };
    },
    enabled: !!id,
  });
}

export function useCreateContact() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: ContactInsert) => {
      const { data, error } = await supabase
        .from("contacts")
        .insert(values)
        .select()
        .single();
      if (error) throw error;
      return data as Contact;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTACTS_KEY });
    },
  });
}

export function useUpdateContact() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...values }: ContactUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("contacts")
        .update(values)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Contact;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTACTS_KEY });
    },
  });
}

export function useDeleteContact() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("contacts")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTACTS_KEY });
    },
  });
}
