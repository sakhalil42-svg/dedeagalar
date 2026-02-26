"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Vehicle, VehicleInsert, VehicleUpdate } from "@/lib/types/database.types";

const VEHICLES_KEY = ["vehicles"];

export function useVehicles() {
  const supabase = createClient();

  return useQuery({
    queryKey: VEHICLES_KEY,
    queryFn: async () => {
      // Fetch vehicles and carriers separately (no FK join dependency)
      const { data: vehicles, error } = await supabase
        .from("vehicles")
        .select("*")
        .eq("is_active", true)
        .order("plate");
      if (error) throw error;

      const carrierIds = [...new Set((vehicles || []).map((v) => v.carrier_id).filter(Boolean))];
      let carrierMap = new Map<string, { id: string; name: string; phone: string | null }>();
      if (carrierIds.length > 0) {
        const { data: carriers } = await supabase
          .from("carriers")
          .select("id, name, phone")
          .in("id", carrierIds as string[]);
        if (carriers) {
          carrierMap = new Map(carriers.map((c) => [c.id, c]));
        }
      }

      return (vehicles || []).map((v) => ({
        ...v,
        carrier: v.carrier_id ? carrierMap.get(v.carrier_id) || null : null,
      })) as Vehicle[];
    },
  });
}

export function useCreateVehicle() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: VehicleInsert) => {
      // Upsert on plate to avoid 409 conflict on duplicate plates
      const { data, error } = await supabase
        .from("vehicles")
        .upsert(values, { onConflict: "plate" })
        .select()
        .single();
      if (error) throw error;
      return data as Vehicle;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: VEHICLES_KEY });
    },
  });
}

export function useUpdateVehicle() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...values }: VehicleUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("vehicles")
        .update(values)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Vehicle;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: VEHICLES_KEY });
    },
  });
}

export function useDeleteVehicle() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("vehicles")
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: VEHICLES_KEY });
    },
  });
}
