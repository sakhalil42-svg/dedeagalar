"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { MonthlyData } from "@/lib/types/database.types";

// ═══════════════════════════════════════════════════════════
// 6.1 + 6.2 — Dashboard KPIs (enhanced)
// ═══════════════════════════════════════════════════════════

export function useDashboardKpis() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["dashboard", "kpis"],
    queryFn: async () => {
      try {
      const now = new Date();
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const today = now.toISOString().split("T")[0];

      // ── Today's deliveries ──
      const { data: todayDeliveries } = await supabase
        .from("deliveries")
        .select("net_weight")
        .eq("delivery_date", today);

      const todayTruckCount = (todayDeliveries || []).length;
      const todayTonnage = (todayDeliveries || []).reduce((s, d) => s + (d.net_weight || 0), 0);

      // ── Today's profit ──
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

      // Today's freight
      const { data: todayFreightDels } = await supabase
        .from("deliveries")
        .select("freight_cost, freight_payer")
        .eq("delivery_date", today);

      const todayFreight = (todayFreightDels || []).reduce((s, d) => {
        if (d.freight_payer === "customer" || d.freight_payer === "supplier") return s;
        return s + (d.freight_cost || 0);
      }, 0);

      const todayProfit = todaySales - todayPurchases - todayFreight;

      // ── This month profit ──
      const monthEnd = now.toISOString().split("T")[0];

      const { data: monthSaleTxs } = await supabase
        .from("account_transactions")
        .select("amount")
        .eq("reference_type", "sale")
        .eq("type", "debit")
        .gte("transaction_date", monthStart)
        .lte("transaction_date", monthEnd);

      const { data: monthPurchaseTxs } = await supabase
        .from("account_transactions")
        .select("amount")
        .eq("reference_type", "purchase")
        .eq("type", "credit")
        .gte("transaction_date", monthStart)
        .lte("transaction_date", monthEnd);

      const monthSales = (monthSaleTxs || []).reduce((s, t) => s + (t.amount || 0), 0);
      const monthPurchases = (monthPurchaseTxs || []).reduce((s, t) => s + (t.amount || 0), 0);

      // Month freight
      const { data: monthFreightDels } = await supabase
        .from("deliveries")
        .select("freight_cost, freight_payer")
        .gte("delivery_date", monthStart)
        .lte("delivery_date", monthEnd);

      const monthFreight = (monthFreightDels || []).reduce((s, d) => {
        if (d.freight_payer === "customer" || d.freight_payer === "supplier") return s;
        return s + (d.freight_cost || 0);
      }, 0);

      const monthProfit = monthSales - monthPurchases - monthFreight;
      const monthlyRevenue = monthSales;

      // ── Monthly tonnage ──
      const { data: monthDeliveries } = await supabase
        .from("deliveries")
        .select("net_weight")
        .gte("delivery_date", monthStart);

      const monthlyTonnage = (monthDeliveries || []).reduce((s, d) => s + (d.net_weight || 0), 0);

      // ── Accounts + contacts (for balances) ──
      const { data: accounts } = await supabase
        .from("accounts")
        .select("contact_id, balance")
        .neq("balance", 0)
        .order("balance", { ascending: false });

      const contactIds = [...new Set((accounts || []).map((a) => a.contact_id).filter(Boolean))];
      let contactMap = new Map<string, { name: string; type: string; phone: string | null; credit_limit: number | null }>();
      if (contactIds.length > 0) {
        const { data: contacts } = await supabase
          .from("contacts")
          .select("id, name, type, phone, credit_limit")
          .in("id", contactIds);
        if (contacts) {
          contactMap = new Map(contacts.map((c) => [c.id, { name: c.name, type: c.type, phone: c.phone, credit_limit: c.credit_limit }]));
        }
      }

      // Total receivables (customers with positive balance = they owe us)
      const pendingReceivables = (accounts || []).reduce((sum, a) => {
        const c = contactMap.get(a.contact_id);
        if (c && (c.type === "customer" || c.type === "both") && a.balance > 0) {
          return sum + a.balance;
        }
        return sum;
      }, 0);

      // Total payables (suppliers with positive balance = we owe them)
      const pendingPayables = (accounts || []).reduce((sum, a) => {
        const c = contactMap.get(a.contact_id);
        if (c && (c.type === "supplier" || c.type === "both") && a.balance > 0) {
          return sum + a.balance;
        }
        return sum;
      }, 0);

      // ── Due checks (next 7 days) ──
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

      // ── Monthly freight expense ──
      const monthlyFreight = monthFreight;

      // ── 6.2 Balance warning lists (all contacts, sorted) ──
      const allBalances: Array<{
        contactId: string;
        name: string;
        phone: string | null;
        type: string;
        balance: number;
        credit_limit: number | null;
      }> = (accounts || [])
        .filter((a) => a.balance > 0 && contactMap.has(a.contact_id))
        .map((a) => {
          const c = contactMap.get(a.contact_id)!;
          return {
            contactId: a.contact_id,
            name: c.name,
            phone: c.phone || null,
            type: c.type,
            balance: a.balance,
            credit_limit: c.credit_limit,
          };
        })
        .sort((a, b) => b.balance - a.balance);

      const customerBalances = allBalances.filter(
        (b) => b.type === "customer" || b.type === "both"
      );
      const supplierBalances = allBalances.filter(
        (b) => b.type === "supplier" || b.type === "both"
      );

      return {
        todayTruckCount,
        todayTonnage,
        todayProfit,
        monthProfit,
        monthlyRevenue,
        monthlyTonnage,
        pendingReceivables,
        pendingPayables,
        dueCheckCount,
        dueCheckTotal,
        overdueCheckCount,
        monthlyFreight,
        customerBalances,
        supplierBalances,
      };
      } catch (err) {
        throw new Error("Dashboard verileri yüklenirken hata oluştu");
      }
    },
    retry: 1,
  });
}

// ═══════════════════════════════════════════════════════════
// 6.3 — Enhanced charts
// ═══════════════════════════════════════════════════════════

export function useMonthlyChart() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["dashboard", "monthly_chart"],
    retry: 1,
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

// 6.3 — Daily tonnage trend (last 30 days)
export function useDailyTonnageChart() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["dashboard", "daily_tonnage"],
    retry: 1,
    queryFn: async () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 29);

      const startStr = start.toISOString().split("T")[0];
      const endStr = end.toISOString().split("T")[0];

      const { data: deliveries } = await supabase
        .from("deliveries")
        .select("delivery_date, net_weight")
        .gte("delivery_date", startStr)
        .lte("delivery_date", endStr)
        .order("delivery_date");

      // Group by date
      const dayMap = new Map<string, number>();
      for (const d of deliveries || []) {
        const key = d.delivery_date;
        dayMap.set(key, (dayMap.get(key) || 0) + (d.net_weight || 0));
      }

      // Build chart data for all 30 days
      const result: { date: string; label: string; tonnage: number }[] = [];
      for (let i = 0; i < 30; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        const key = d.toISOString().split("T")[0];
        const label = d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
        result.push({
          date: key,
          label,
          tonnage: (dayMap.get(key) || 0) / 1000, // tons
        });
      }

      return result;
    },
  });
}

// 6.3 — Weekly profit trend (last 12 weeks)
export function useWeeklyProfitChart() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["dashboard", "weekly_profit"],
    retry: 1,
    queryFn: async () => {
      const result: { week: string; profit: number }[] = [];

      for (let i = 11; i >= 0; i--) {
        const end = new Date();
        end.setDate(end.getDate() - i * 7);
        const start = new Date(end);
        start.setDate(start.getDate() - 6);

        const startStr = start.toISOString().split("T")[0];
        const endStr = end.toISOString().split("T")[0];
        const label = `${start.toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}`;

        const { data: saleTxs } = await supabase
          .from("account_transactions")
          .select("amount")
          .eq("reference_type", "sale")
          .eq("type", "debit")
          .gte("transaction_date", startStr)
          .lte("transaction_date", endStr);

        const { data: purchaseTxs } = await supabase
          .from("account_transactions")
          .select("amount")
          .eq("reference_type", "purchase")
          .eq("type", "credit")
          .gte("transaction_date", startStr)
          .lte("transaction_date", endStr);

        const sales = (saleTxs || []).reduce((s, t) => s + (t.amount || 0), 0);
        const purchases = (purchaseTxs || []).reduce((s, t) => s + (t.amount || 0), 0);

        result.push({ week: label, profit: sales - purchases });
      }

      return result;
    },
  });
}

// 6.3 — Feed type distribution (pie chart)
export function useFeedTypeDistribution() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["dashboard", "feed_type_dist"],
    retry: 1,
    queryFn: async () => {
      // Get deliveries with their purchase/sale to find feed type
      const { data: deliveries } = await supabase
        .from("deliveries")
        .select("net_weight, purchase_id, sale_id")
        .order("delivery_date", { ascending: false });

      if (!deliveries || deliveries.length === 0) return [];

      // Gather purchase_ids and sale_ids
      const purchaseIds = [...new Set(deliveries.map((d) => d.purchase_id).filter(Boolean))] as string[];
      const saleIds = [...new Set(deliveries.map((d) => d.sale_id).filter(Boolean))] as string[];

      // Fetch feed_type info from purchases and sales
      const feedMap = new Map<string, string>(); // reference_id → feed_type name

      if (purchaseIds.length > 0) {
        const { data: purchases } = await supabase
          .from("purchases")
          .select("id, feed_type:feed_types(name)")
          .in("id", purchaseIds);
        for (const p of purchases || []) {
          const ft = p.feed_type as unknown as { name: string } | null;
          if (ft?.name) feedMap.set(p.id, ft.name);
        }
      }

      if (saleIds.length > 0) {
        const { data: sales } = await supabase
          .from("sales")
          .select("id, feed_type:feed_types(name)")
          .in("id", saleIds);
        for (const s of sales || []) {
          const ft = s.feed_type as unknown as { name: string } | null;
          if (ft?.name) feedMap.set(s.id, ft.name);
        }
      }

      // Aggregate tonnage by feed type
      const typeTonnage = new Map<string, number>();
      for (const d of deliveries) {
        const refId = d.purchase_id || d.sale_id || "";
        const feedName = feedMap.get(refId) || "Diğer";
        typeTonnage.set(feedName, (typeTonnage.get(feedName) || 0) + (d.net_weight || 0));
      }

      // Convert to array, sort by tonnage descending
      const COLORS = ["#166534", "#d97706", "#2563eb", "#dc2626", "#7c3aed", "#0891b2", "#be185d", "#65a30d"];
      return Array.from(typeTonnage.entries())
        .map(([name, kg], i) => ({
          name,
          tonnage: Math.round(kg / 1000 * 10) / 10,
          fill: COLORS[i % COLORS.length],
        }))
        .sort((a, b) => b.tonnage - a.tonnage);
    },
  });
}

// ═══════════════════════════════════════════════════════════
// 6.5 — Recent activities (mixed: deliveries + payments + checks)
// ═══════════════════════════════════════════════════════════

export interface RecentActivity {
  id: string;
  date: string;
  type: "delivery" | "payment" | "check";
  icon: "truck" | "banknote" | "file";
  description: string;
  amount?: number;
  weight?: number;
  href: string;
}

export function useRecentActivities() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["dashboard", "recent_activities"],
    retry: 1,
    queryFn: async () => {
      const activities: RecentActivity[] = [];

      // Recent deliveries (last 10)
      const { data: deliveries } = await supabase
        .from("deliveries")
        .select("id, delivery_date, net_weight, vehicle_plate, sale_id, purchase_id")
        .order("created_at", { ascending: false })
        .limit(10);

      // Get contact names for deliveries
      const saleIds = (deliveries || []).map((d) => d.sale_id).filter(Boolean) as string[];
      const purchaseIds = (deliveries || []).map((d) => d.purchase_id).filter(Boolean) as string[];

      const saleContactMap = new Map<string, string>();
      const purchaseContactMap = new Map<string, string>();

      if (saleIds.length > 0) {
        const { data: sales } = await supabase
          .from("sales")
          .select("id, contact:contacts(name)")
          .in("id", saleIds);
        for (const s of sales || []) {
          const c = s.contact as unknown as { name: string } | null;
          if (c?.name) saleContactMap.set(s.id, c.name);
        }
      }

      if (purchaseIds.length > 0) {
        const { data: purchases } = await supabase
          .from("purchases")
          .select("id, contact:contacts(name)")
          .in("id", purchaseIds);
        for (const p of purchases || []) {
          const c = p.contact as unknown as { name: string } | null;
          if (c?.name) purchaseContactMap.set(p.id, c.name);
        }
      }

      for (const d of deliveries || []) {
        const contactName = d.sale_id
          ? saleContactMap.get(d.sale_id) || "—"
          : d.purchase_id
            ? purchaseContactMap.get(d.purchase_id) || "—"
            : "—";
        const typeLabel = d.sale_id ? "Satış" : "Alım";
        activities.push({
          id: `del-${d.id}`,
          date: d.delivery_date,
          type: "delivery",
          icon: "truck",
          description: `${typeLabel}: ${contactName}${d.vehicle_plate ? ` (${d.vehicle_plate})` : ""}`,
          weight: d.net_weight,
          href: d.sale_id ? `/sales/${d.sale_id}` : d.purchase_id ? `/purchases/${d.purchase_id}` : "/",
        });
      }

      // Recent payments (last 10)
      const { data: payments } = await supabase
        .from("payments")
        .select("id, payment_date, amount, direction, method, contact:contacts(name)")
        .order("created_at", { ascending: false })
        .limit(10);

      for (const p of payments || []) {
        const c = p.contact as unknown as { name: string } | null;
        const dirLabel = p.direction === "inbound" ? "Tahsilat" : "Ödeme";
        activities.push({
          id: `pay-${p.id}`,
          date: p.payment_date,
          type: "payment",
          icon: "banknote",
          description: `${dirLabel}: ${c?.name || "—"}`,
          amount: p.amount,
          href: "/finance/payments",
        });
      }

      // Recent check events (last 10)
      const { data: checks } = await supabase
        .from("checks")
        .select("id, created_at, amount, type, direction, status, contact_id")
        .order("created_at", { ascending: false })
        .limit(10);

      const checkContactIds = [...new Set((checks || []).map((c) => c.contact_id).filter(Boolean))];
      let checkContactMap = new Map<string, string>();
      if (checkContactIds.length > 0) {
        const { data: contacts } = await supabase
          .from("contacts")
          .select("id, name")
          .in("id", checkContactIds);
        if (contacts) {
          checkContactMap = new Map(contacts.map((c) => [c.id, c.name]));
        }
      }

      for (const ch of checks || []) {
        const contactName = checkContactMap.get(ch.contact_id) || "—";
        const typeLabel = ch.type === "check" ? "Çek" : "Senet";
        const dirLabel = ch.direction === "received" ? "Alınan" : "Verilen";
        activities.push({
          id: `chk-${ch.id}`,
          date: ch.created_at.split("T")[0],
          type: "check",
          icon: "file",
          description: `${dirLabel} ${typeLabel}: ${contactName}`,
          amount: ch.amount,
          href: "/finance/checks",
        });
      }

      // Sort by date descending, take top 10
      activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return activities.slice(0, 10);
    },
  });
}

// ═══════════════════════════════════════════════════════════
// 6.6 — Season performance summary
// ═══════════════════════════════════════════════════════════

export function useSeasonSummary(seasonId?: string | null) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["dashboard", "season_summary", seasonId],
    retry: 1,
    queryFn: async () => {
      // Build delivery query with season filter
      let deliveryQuery = supabase
        .from("deliveries")
        .select("net_weight, vehicle_plate, sale_id, purchase_id, carrier_name")
        .is("deleted_at", null);

      if (seasonId) {
        deliveryQuery = deliveryQuery.eq("season_id", seasonId);
      } else {
        // Fallback: current season year starting from September
        const now = new Date();
        const seasonYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
        const seasonStart = `${seasonYear}-09-01`;
        deliveryQuery = deliveryQuery.gte("delivery_date", seasonStart);
      }

      // Total tonnage
      const { data: deliveries } = await deliveryQuery;

      const totalTonnage = (deliveries || []).reduce((s, d) => s + (d.net_weight || 0), 0);

      // Total revenue (sales)
      let saleTxQuery = supabase
        .from("account_transactions")
        .select("amount")
        .eq("reference_type", "sale")
        .eq("type", "debit")
        .is("deleted_at", null);
      if (seasonId) {
        saleTxQuery = saleTxQuery.eq("season_id", seasonId);
      } else {
        const now2 = new Date();
        const sy = now2.getMonth() >= 8 ? now2.getFullYear() : now2.getFullYear() - 1;
        saleTxQuery = saleTxQuery.gte("transaction_date", `${sy}-09-01`);
      }
      const { data: saleTxs } = await saleTxQuery;

      const totalRevenue = (saleTxs || []).reduce((s, t) => s + (t.amount || 0), 0);

      // Total cost (purchases)
      let purchaseTxQuery = supabase
        .from("account_transactions")
        .select("amount")
        .eq("reference_type", "purchase")
        .eq("type", "credit")
        .is("deleted_at", null);
      if (seasonId) {
        purchaseTxQuery = purchaseTxQuery.eq("season_id", seasonId);
      } else {
        const now3 = new Date();
        const sy3 = now3.getMonth() >= 8 ? now3.getFullYear() : now3.getFullYear() - 1;
        purchaseTxQuery = purchaseTxQuery.gte("transaction_date", `${sy3}-09-01`);
      }
      const { data: purchaseTxs } = await purchaseTxQuery;

      const totalCost = (purchaseTxs || []).reduce((s, t) => s + (t.amount || 0), 0);

      // Total freight
      const totalFreight = (deliveries || []).reduce((s, d) => s + ((d as unknown as { freight_cost?: number }).freight_cost || 0), 0);

      const totalProfit = totalRevenue - totalCost;

      // Top 3 customers (by sale tonnage)
      const customerTonnage = new Map<string, number>();
      const supplierTonnage = new Map<string, number>();
      const carrierCount = new Map<string, number>();
      const plateCount = new Map<string, number>();

      for (const d of deliveries || []) {
        if (d.sale_id) {
          customerTonnage.set(d.sale_id, (customerTonnage.get(d.sale_id) || 0) + (d.net_weight || 0));
        }
        if (d.purchase_id) {
          supplierTonnage.set(d.purchase_id, (supplierTonnage.get(d.purchase_id) || 0) + (d.net_weight || 0));
        }
        if (d.carrier_name) {
          carrierCount.set(d.carrier_name, (carrierCount.get(d.carrier_name) || 0) + 1);
        }
        if (d.vehicle_plate) {
          plateCount.set(d.vehicle_plate, (plateCount.get(d.vehicle_plate) || 0) + 1);
        }
      }

      // Resolve sale_ids → customer names
      const topSaleIds = Array.from(customerTonnage.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([id]) => id);

      const topPurchaseIds = Array.from(supplierTonnage.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([id]) => id);

      const topCustomers: { name: string; tonnage: number }[] = [];
      const topSuppliers: { name: string; tonnage: number }[] = [];

      if (topSaleIds.length > 0) {
        const { data: sales } = await supabase
          .from("sales")
          .select("id, contact:contacts(name)")
          .in("id", topSaleIds);
        for (const sid of topSaleIds) {
          const sale = (sales || []).find((s) => s.id === sid);
          const c = sale?.contact as unknown as { name: string } | null;
          topCustomers.push({
            name: c?.name || "—",
            tonnage: customerTonnage.get(sid) || 0,
          });
        }
      }

      if (topPurchaseIds.length > 0) {
        const { data: purchases } = await supabase
          .from("purchases")
          .select("id, contact:contacts(name)")
          .in("id", topPurchaseIds);
        for (const pid of topPurchaseIds) {
          const purchase = (purchases || []).find((p) => p.id === pid);
          const c = purchase?.contact as unknown as { name: string } | null;
          topSuppliers.push({
            name: c?.name || "—",
            tonnage: supplierTonnage.get(pid) || 0,
          });
        }
      }

      // Top 3 carriers/plates
      const topCarriers = Array.from(carrierCount.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, count]) => ({ name, count }));

      const topPlates = Array.from(plateCount.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([plate, count]) => ({ plate, count }));

      return {
        seasonId: seasonId || null,
        totalTonnage,
        totalRevenue,
        totalProfit,
        topCustomers,
        topSuppliers,
        topCarriers,
        topPlates,
      };
    },
  });
}

// ═══════════════════════════════════════════════════════════
// Legacy hooks (kept for backward compatibility)
// ═══════════════════════════════════════════════════════════

export function useRecentDeliveries() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["dashboard", "recent_deliveries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deliveries")
        .select("id, delivery_date, net_weight, vehicle_plate, sale_id, purchase_id")
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
      let contactMap = new Map<string, { name: string; phone: string | null }>();
      if (contactIds.length > 0) {
        const { data: contacts } = await supabase
          .from("contacts")
          .select("id, name, phone")
          .in("id", contactIds);
        if (contacts) {
          contactMap = new Map(contacts.map((c) => [c.id, { name: c.name, phone: c.phone }]));
        }
      }

      const items: Array<{
        id: string;
        type: string;
        raw_type: string;
        contact_name: string;
        contact_phone: string | null;
        serial_no: string | null;
        amount: number;
        due_date: string;
        overdue: boolean;
        days_diff: number;
      }> = [];

      (checks || []).forEach((c) => {
        const contact = contactMap.get(c.contact_id);
        const dueDate = new Date(c.due_date);
        dueDate.setHours(0, 0, 0, 0);
        const todayDate = new Date(today);
        todayDate.setHours(0, 0, 0, 0);
        const daysDiff = Math.ceil((dueDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));

        items.push({
          id: c.id,
          type: c.type === "check" ? "Çek" : "Senet",
          raw_type: c.type,
          contact_name: contact?.name || "—",
          contact_phone: contact?.phone || null,
          serial_no: c.serial_no || null,
          amount: c.amount,
          due_date: c.due_date,
          overdue: c.due_date < today,
          days_diff: daysDiff,
        });
      });

      items.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
      return items.slice(0, 10);
    },
  });
}
