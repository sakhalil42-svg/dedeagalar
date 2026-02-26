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
      const today = now.toISOString().split("T")[0];

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

      // --- NEW: Today's profit ---
      const { data: todaySaleTxs } = await supabase
        .from("account_transactions")
        .select("amount")
        .eq("reference_type", "sale")
        .eq("type", "debit")
        .eq("transaction_date", today);

      const { data: todayPurchaseTxs } = await supabase
        .from("account_transactions")
        .select("amount")
        .eq("reference_type", "purchase")
        .eq("type", "credit")
        .eq("transaction_date", today);

      const todaySales = (todaySaleTxs || []).reduce((s, t) => s + (t.amount || 0), 0);
      const todayPurchases = (todayPurchaseTxs || []).reduce((s, t) => s + (t.amount || 0), 0);
      const todayProfit = todaySales - todayPurchases;

      // --- NEW: Monthly tonnage ---
      const { data: monthDeliveries } = await supabase
        .from("deliveries")
        .select("net_weight")
        .gte("delivery_date", monthStart);

      const monthlyTonnage = (monthDeliveries || []).reduce((s, d) => s + (d.net_weight || 0), 0);

      // --- NEW: Due checks count & amount (next 7 days) ---
      const next7 = new Date();
      next7.setDate(next7.getDate() + 7);
      const next7Str = next7.toISOString().split("T")[0];

      const { data: dueChecks } = await supabase
        .from("checks")
        .select("amount, due_date")
        .in("status", ["pending", "deposited"])
        .lte("due_date", next7Str);

      const dueCheckCount = (dueChecks || []).length;
      const dueCheckTotal = (dueChecks || []).reduce((s, c) => s + (c.amount || 0), 0);
      const overdueCheckCount = (dueChecks || []).filter((c) => c.due_date < today).length;

      // --- NEW: Top balances ---
      // We need accounts + contacts to figure out customer vs supplier
      const { data: accounts } = await supabase
        .from("accounts")
        .select("contact_id, balance")
        .neq("balance", 0)
        .order("balance", { ascending: false });

      const contactIds = [...new Set((accounts || []).map((a) => a.contact_id).filter(Boolean))];
      let contactMap = new Map<string, { name: string; type: string }>();
      if (contactIds.length > 0) {
        const { data: contacts } = await supabase
          .from("contacts")
          .select("id, name, type")
          .in("id", contactIds);
        if (contacts) {
          contactMap = new Map(contacts.map((c) => [c.id, { name: c.name, type: c.type }]));
        }
      }

      // Top 3 customers with highest receivable (positive balance, type customer/both)
      const topCustomers = (accounts || [])
        .filter((a) => {
          const c = contactMap.get(a.contact_id);
          return c && (c.type === "customer" || c.type === "both") && a.balance > 0;
        })
        .slice(0, 3)
        .map((a) => ({
          name: contactMap.get(a.contact_id)?.name || "—",
          balance: a.balance,
        }));

      // Top 3 suppliers with highest payable (we look at positive balance for supplier = we owe)
      const topSuppliers = (accounts || [])
        .filter((a) => {
          const c = contactMap.get(a.contact_id);
          return c && (c.type === "supplier" || c.type === "both") && a.balance > 0;
        })
        .slice(0, 3)
        .map((a) => ({
          name: contactMap.get(a.contact_id)?.name || "—",
          balance: a.balance,
        }));

      return {
        activeSalesCount: activeSalesCount || 0,
        monthlyRevenue,
        pendingReceivables,
        pendingPayables,
        todayProfit,
        monthlyTonnage,
        dueCheckCount,
        dueCheckTotal,
        overdueCheckCount,
        topCustomers,
        topSuppliers,
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
        .select("*")
        .in("status", ["pending", "deposited"])
        .lte("due_date", next30Str)
        .order("due_date")
        .limit(10);

      const contactIds = [...new Set((checks || []).map((c) => c.contact_id).filter(Boolean))];
      let contactMap = new Map<string, string>();
      if (contactIds.length > 0) {
        const { data: contacts } = await supabase
          .from("contacts")
          .select("id, name")
          .in("id", contactIds);
        if (contacts) {
          contactMap = new Map(contacts.map((c) => [c.id, c.name]));
        }
      }

      const items: Array<{
        id: string;
        type: string;
        contact_name: string;
        amount: number;
        due_date: string;
        overdue: boolean;
      }> = [];

      (checks || []).forEach((c) => {
        items.push({
          id: c.id,
          type: c.type === "check" ? "Çek" : "Senet",
          contact_name: contactMap.get(c.contact_id) || "—",
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
