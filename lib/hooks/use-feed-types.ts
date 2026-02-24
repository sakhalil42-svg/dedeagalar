"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { FeedType, FeedTypeInsert, FeedTypeUpdate } from "@/lib/types/database.types";

const FEED_TYPES_KEY = ["feed_types"];

export function useFeedTypes(activeOnly = false) {
  const supabase = createClient();

  return useQuery({
    queryKey: activeOnly ? [...FEED_TYPES_KEY, "active"] : FEED_TYPES_KEY,
    queryFn: async () => {
      let query = supabase
        .from("feed_types")
        .select("*")
        .order("name");

      if (activeOnly) {
        query = query.eq("is_active", true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as FeedType[];
    },
  });
}

export function useCreateFeedType() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: FeedTypeInsert) => {
      const { data, error } = await supabase
        .from("feed_types")
        .insert(values)
        .select()
        .single();
      if (error) throw error;
      return data as FeedType;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FEED_TYPES_KEY });
    },
  });
}

export function useUpdateFeedType() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...values }: FeedTypeUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("feed_types")
        .update(values)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as FeedType;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FEED_TYPES_KEY });
    },
  });
}

export function useDeleteFeedType() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("feed_types")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FEED_TYPES_KEY });
    },
  });
}
