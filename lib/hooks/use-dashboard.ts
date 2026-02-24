"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Purchase, Sale, Check, MonthlyData } from "@/lib/types/database.types";

export function useDashboardKpis() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["dashboard", "kpis"],
    queryFn: async () => {
      const now = new Date();
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

      // This month purchases
      const { data: purchases } = await supabase
        .from("purchases")
        .select("total_amount")
        .gte("purchase_date", monthStart)
        .neq("status", "cancelled");

      // This month sales
      const { data: sales } = await supabase
        .from("sales")
        .select("total_amount")
        .gte("sale_date", monthStart)
        .neq("status", "cancelled");

      // Total stock (from inventory table)
      const { data: inventory } = await supabase
        .from("inventory")
        .select("quantity_kg");

      // Net balance (from accounts)
      const { data: accounts } = await supabase
        .from("accounts")
        .select("balance");

      const totalPurchases = (purchases || []).reduce((sum, p) => sum + (p.total_amount || 0), 0);
      const totalSales = (sales || []).reduce((sum, s) => sum + (s.total_amount || 0), 0);
      const totalStock = (inventory || []).reduce((sum, i) => sum + (i.quantity_kg || 0), 0);
      const netBalance = (accounts || []).reduce((sum, a) => sum + (a.balance || 0), 0);

      return { totalPurchases, totalSales, totalStock, netBalance };
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

export function useRecentTransactions() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["dashboard", "recent"],
    queryFn: async () => {
      const { data: purchases } = await supabase
        .from("purchases")
        .select("id, purchase_no, total_amount, purchase_date, status, contact:contacts(name)")
        .order("purchase_date", { ascending: false })
        .limit(5);

      const { data: sales } = await supabase
        .from("sales")
        .select("id, sale_no, total_amount, sale_date, status, contact:contacts(name)")
        .order("sale_date", { ascending: false })
        .limit(5);

      const items: Array<{
        id: string;
        type: "purchase" | "sale";
        no: string;
        amount: number;
        date: string;
        status: string;
        contact_name: string;
      }> = [];

      (purchases || []).forEach((p) => {
        const contact = p.contact as unknown as { name: string } | null;
        items.push({
          id: p.id,
          type: "purchase",
          no: p.purchase_no,
          amount: p.total_amount,
          date: p.purchase_date,
          status: p.status,
          contact_name: contact?.name || "—",
        });
      });

      (sales || []).forEach((s) => {
        const contact = s.contact as unknown as { name: string } | null;
        items.push({
          id: s.id,
          type: "sale",
          no: s.sale_no,
          amount: s.total_amount,
          date: s.sale_date,
          status: s.status,
          contact_name: contact?.name || "—",
        });
      });

      items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return items.slice(0, 5);
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

      // Checks due soon
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
