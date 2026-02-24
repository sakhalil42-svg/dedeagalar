"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { InventorySummary, InventoryMovement } from "@/lib/types/database.types";

const INVENTORY_KEY = ["inventory"];

export function useInventorySummary() {
  const supabase = createClient();

  return useQuery({
    queryKey: [...INVENTORY_KEY, "summary"],
    queryFn: async () => {
      // Try view first, fallback to table join
      const { data, error } = await supabase
        .from("v_inventory_summary")
        .select("*")
        .order("warehouse_name");

      if (error) {
        // Fallback: join inventory with warehouses and feed_types
        const { data: fallback, error: fbErr } = await supabase
          .from("inventory")
          .select("*, warehouse:warehouses(name), feed_type:feed_types(name)")
          .order("warehouse_id");

        if (fbErr) throw fbErr;

        return (fallback || []).map((i: Record<string, unknown>) => {
          const warehouse = i.warehouse as { name: string } | null;
          const feedType = i.feed_type as { name: string } | null;
          const qty = (i.quantity_kg as number) || 0;
          const cost = (i.unit_cost as number) || 0;
          return {
            id: i.id as string,
            warehouse_id: i.warehouse_id as string,
            feed_type_id: i.feed_type_id as string,
            warehouse_name: warehouse?.name || "—",
            feed_type_name: feedType?.name || "—",
            quantity_kg: qty,
            unit_cost: cost,
            total_value: qty * cost,
            last_updated: (i.last_updated as string) || (i.created_at as string) || "",
          };
        }) as InventorySummary[];
      }

      return data as InventorySummary[];
    },
  });
}

export function useInventoryMovements(limit = 20) {
  const supabase = createClient();

  return useQuery({
    queryKey: [...INVENTORY_KEY, "movements", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_movements")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data as InventoryMovement[];
    },
  });
}
