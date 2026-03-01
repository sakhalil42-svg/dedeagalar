"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { ParcelProfitability, RegionProfitability } from "@/lib/types/database.types";

export function useParcelProfitability(parcelId: string | null) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["parcel-profitability", parcelId],
    enabled: !!parcelId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_parcel_profitability")
        .select("*")
        .eq("parcel_id", parcelId!)
        .single();

      if (error) throw error;
      return data as unknown as ParcelProfitability;
    },
  });
}

export function useRegionProfitability(seasonId?: string | null) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["region-profitability", seasonId],
    queryFn: async () => {
      let query = supabase
        .from("v_region_profitability")
        .select("*");

      if (seasonId) {
        query = query.eq("season_id", seasonId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as RegionProfitability[];
    },
  });
}
