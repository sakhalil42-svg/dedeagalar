import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export function useTodayDeliveryCount() {
  return useQuery({
    queryKey: ["badge-today-deliveries"],
    queryFn: async () => {
      const supabase = createClient();
      const today = new Date().toISOString().split("T")[0];
      const { count } = await supabase
        .from("deliveries")
        .select("*", { count: "exact", head: true })
        .eq("delivery_date", today);
      return count ?? 0;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useOverdueCheckCount() {
  return useQuery({
    queryKey: ["badge-overdue-checks"],
    queryFn: async () => {
      const supabase = createClient();
      const today = new Date().toISOString().split("T")[0];
      const { count } = await supabase
        .from("checks")
        .select("*", { count: "exact", head: true })
        .lt("due_date", today)
        .in("status", ["pending", "deposited"]);
      return count ?? 0;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
