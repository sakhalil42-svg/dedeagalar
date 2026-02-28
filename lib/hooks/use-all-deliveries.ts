"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { TodayDelivery } from "./use-deliveries";

export function useAllDeliveries(seasonId?: string | null) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["deliveries", "all", seasonId],
    queryFn: async () => {
      let query = supabase
        .from("deliveries")
        .select(
          "*, sale:sales(contact_id, unit_price, feed_type_id, contact:contacts(id, name, phone), feed_type:feed_types(id, name))"
        )
        .is("deleted_at", null)
        .order("delivery_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (seasonId) {
        query = query.eq("season_id", seasonId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as TodayDelivery[];
    },
  });
}
