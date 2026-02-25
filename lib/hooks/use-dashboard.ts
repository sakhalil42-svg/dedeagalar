"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { MonthlyData } from "@/lib/types/database.types";

export function useDashboardKpis() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["dashboard", "kpis"],
    queryFn: async () => {
      const now = new Date();
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

      // Active sales count (not cancelled)
      const { count: activeSalesCount } = await supabase
        .from("sales")
        .select("*", { count: "exact", head: true })
        .neq("status", "cancelled");

      // This month revenue (sales)
      const { data: sales } = await supabase
        .from("sales")
        .select("total_amount")
        .gte("sale_date", monthStart)
        .neq("status", "cancelled");

      // Pending receivables (positive balances = customers owe us)
      const { data: receivableAccounts } = await supabase
        .from("accounts")
        .select("balance")
        .gt("balance", 0);

      // Pending payables (negative balances = we owe suppliers)
      const { data: payableAccounts } = await supabase
        .from("accounts")
        .select("balance")
        .lt("balance", 0);

      const monthlyRevenue = (sales || []).reduce((sum, s) => sum + (s.total_amount || 0), 0);
      const pendingReceivables = (receivableAccounts || []).reduce((sum, a) => sum + (a.balance || 0), 0);
      const pendingPayables = Math.abs((payableAccounts || []).reduce((sum, a) => sum + (a.balance || 0), 0));

      return {
        activeSalesCount: activeSalesCount || 0,
        monthlyRevenue,
        pendingReceivables,
        pendingPayables,
      };
    },
  });
}

export function useMonthlyChart() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["dashboard", "monthly_chart"],
    queryFn: async () => {
      const now = new Date();
      const months: MonthlyData[] = [];

      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        const endStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;

        const monthLabel = d.toLocaleDateString("tr-TR", { month: "short" });

        const { data: purchases } = await supabase
          .from("purchases")
          .select("total_amount")
          .gte("purchase_date", start)
          .lte("purchase_date", endStr)
          .neq("status", "cancelled");

        const { data: sales } = await supabase
          .from("sales")
          .select("total_amount")
          .gte("sale_date", start)
          .lte("sale_date", endStr)
          .neq("status", "cancelled");

        months.push({
          month: monthLabel,
          purchases: (purchases || []).reduce((sum, p) => sum + (p.total_amount || 0), 0),
          sales: (sales || []).reduce((sum, s) => sum + (s.total_amount || 0), 0),
        });
      }

      return months;
    },
  });
}

export function useRecentDeliveries() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["dashboard", "recent_deliveries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deliveries")
        .select(`
          id,
          delivery_date,
          net_weight,
          vehicle_plate,
          sale_id,
          purchase_id
        `)
        .order("delivery_date", { ascending: false })
        .limit(5);

      if (error) throw error;

      // Fetch related sale/purchase contacts separately
      const items = [];
      for (const d of data || []) {
        let contactName = "—";
        if (d.sale_id) {
          const { data: sale } = await supabase
            .from("sales")
            .select("contact:contacts(name)")
            .eq("id", d.sale_id)
            .single();
          const c = sale?.contact as unknown as { name: string } | null;
          contactName = c?.name || "—";
        } else if (d.purchase_id) {
          const { data: purchase } = await supabase
            .from("purchases")
            .select("contact:contacts(name)")
            .eq("id", d.purchase_id)
            .single();
          const c = purchase?.contact as unknown as { name: string } | null;
          contactName = c?.name || "—";
        }
        items.push({
          id: d.id,
          delivery_date: d.delivery_date,
          net_weight: d.net_weight,
          vehicle_plate: d.vehicle_plate,
          type: d.sale_id ? ("sale" as const) : ("purchase" as const),
          contact_name: contactName,
        });
      }

      return items;
    },
  });
}

export function useDueItems() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["dashboard", "due_items"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const next30 = new Date();
      next30.setDate(next30.getDate() + 30);
      const next30Str = next30.toISOString().split("T")[0];

      const { data: checks } = await supabase
        .from("checks")
        .select("id, amount, due_date, status, check_type, contact:contacts(name)")
        .in("status", ["pending", "deposited"])
        .lte("due_date", next30Str)
        .order("due_date")
        .limit(5);

      const items: Array<{
        id: string;
        type: string;
        contact_name: string;
        amount: number;
        due_date: string;
        overdue: boolean;
      }> = [];

      (checks || []).forEach((c) => {
        const contact = c.contact as unknown as { name: string } | null;
        items.push({
          id: c.id,
          type: c.check_type === "check" ? "Çek" : "Senet",
          contact_name: contact?.name || "—",
          amount: c.amount,
          due_date: c.due_date,
          overdue: c.due_date < today,
        });
      });

      items.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
      return items.slice(0, 5);
    },
  });
}
