"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Parcel, ParcelInsert, ParcelUpdate } from "@/lib/types/database.types";

export function useParcels(seasonId?: string | null) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["parcels", seasonId],
    queryFn: async () => {
      let query = supabase
        .from("parcels")
        .select(`
          *,
          contact:contacts!parcels_contact_id_fkey(id, name, phone, city),
          feed_type:feed_types(id, name),
          contractor:contacts!parcels_contractor_id_fkey(id, name, phone),
          warehouse:warehouses(id, name)
        `)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (seasonId) {
        query = query.eq("season_id", seasonId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as Parcel[];
    },
  });
}

export function useParcel(id: string | null) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["parcel", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parcels")
        .select(`
          *,
          contact:contacts!parcels_contact_id_fkey(id, name, phone, city),
          feed_type:feed_types(id, name),
          contractor:contacts!parcels_contractor_id_fkey(id, name, phone),
          warehouse:warehouses(id, name)
        `)
        .eq("id", id!)
        .single();

      if (error) throw error;
      return data as unknown as Parcel;
    },
  });
}

export function useCreateParcel() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ParcelInsert) => {
      const { data, error } = await supabase
        .from("parcels")
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parcels"] });
    },
  });
}

export function useUpdateParcel() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: ParcelUpdate & { id: string }) => {
      // Strip computed fields
      const { ...clean } = updates;
      delete (clean as Record<string, unknown>).remaining_bales;
      delete (clean as Record<string, unknown>).owner_total_cost;

      const { data, error } = await supabase
        .from("parcels")
        .update(clean)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["parcels"] });
      queryClient.invalidateQueries({ queryKey: ["parcel", variables.id] });
    },
  });
}

export function useDeleteParcel() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("parcels")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parcels"] });
    },
  });
}
