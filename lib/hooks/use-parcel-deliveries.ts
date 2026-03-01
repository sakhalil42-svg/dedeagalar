"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export function useParcelDeliveries(parcelId: string | null) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["parcel-deliveries", parcelId],
    enabled: !!parcelId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deliveries")
        .select(`
          *,
          sale:sales(id, sale_no, unit_price, contact:contacts(name)),
          purchase:purchases(id, purchase_no, contact:contacts(name))
        `)
        .eq("parcel_id", parcelId!)
        .is("deleted_at", null)
        .order("delivery_date", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });
}
