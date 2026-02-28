"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Season, SeasonInsert, SeasonUpdate } from "@/lib/types/database.types";

const SEASONS_KEY = ["seasons"];

export function useSeasons() {
  const supabase = createClient();

  return useQuery({
    queryKey: SEASONS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seasons")
        .select("*")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data as Season[];
    },
  });
}

export function useActiveSeason() {
  const supabase = createClient();

  return useQuery({
    queryKey: [...SEASONS_KEY, "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seasons")
        .select("*")
        .eq("is_active", true)
        .order("start_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as Season | null;
    },
  });
}

export function useCreateSeason() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: SeasonInsert) => {
      const { data, error } = await supabase
        .from("seasons")
        .insert(values)
        .select()
        .single();
      if (error) throw error;
      return data as Season;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SEASONS_KEY });
    },
  });
}

export function useUpdateSeason() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...values }: SeasonUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("seasons")
        .update(values)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Season;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SEASONS_KEY });
    },
  });
}

export function useCloseSeason() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("seasons")
        .update({ is_active: false, end_date: today })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Season;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SEASONS_KEY });
    },
  });
}

export function useStartNewSeason() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: SeasonInsert) => {
      const today = new Date().toISOString().split("T")[0];
      // Close all active seasons
      await supabase
        .from("seasons")
        .update({ is_active: false, end_date: today })
        .eq("is_active", true);

      // Create new season
      const { data, error } = await supabase
        .from("seasons")
        .insert({ ...values, is_active: true })
        .select()
        .single();
      if (error) throw error;
      return data as Season;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SEASONS_KEY });
    },
  });
}
