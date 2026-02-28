"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export function useSeasonReport(seasonId: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["season_report", seasonId],
    enabled: !!seasonId,
    queryFn: async () => {
      // Deliveries
      const { data: deliveries } = await supabase
        .from("deliveries")
        .select("id, net_weight, freight_cost, freight_payer, vehicle_plate, carrier_name, sale_id, purchase_id, delivery_date")
        .eq("season_id", seasonId)
        .is("deleted_at", null);

      const totalDeliveries = (deliveries || []).length;
      const totalTonnage = (deliveries || []).reduce((s, d) => s + (d.net_weight || 0), 0);

      // Sales revenue (account_transactions)
      const { data: saleTxs } = await supabase
        .from("account_transactions")
        .select("amount")
        .eq("season_id", seasonId)
        .eq("reference_type", "sale")
        .eq("type", "debit")
        .is("deleted_at", null);

      const totalRevenue = (saleTxs || []).reduce((s, t) => s + (t.amount || 0), 0);

      // Purchase cost
      const { data: purchaseTxs } = await supabase
        .from("account_transactions")
        .select("amount")
        .eq("season_id", seasonId)
        .eq("reference_type", "purchase")
        .eq("type", "credit")
        .is("deleted_at", null);

      const totalCost = (purchaseTxs || []).reduce((s, t) => s + (t.amount || 0), 0);

      // Carrier expenses
      const { data: carrierTxs } = await supabase
        .from("carrier_transactions")
        .select("amount, carrier_id")
        .eq("season_id", seasonId)
        .eq("type", "freight_charge")
        .is("deleted_at", null);

      const totalFreight = (carrierTxs || []).reduce((s, t) => s + (t.amount || 0), 0);

      const netProfit = totalRevenue - totalCost - totalFreight;
      const margin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

      // Top 5 customers by tonnage via sale_ids
      const saleIds = [...new Set((deliveries || []).map((d) => d.sale_id).filter(Boolean))] as string[];
      const customerTonnage = new Map<string, number>();
      for (const d of deliveries || []) {
        if (d.sale_id) {
          customerTonnage.set(d.sale_id, (customerTonnage.get(d.sale_id) || 0) + (d.net_weight || 0));
        }
      }

      const topSaleIds = Array.from(customerTonnage.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id]) => id);

      const topCustomers: { name: string; tonnage: number }[] = [];
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

      // Top 5 suppliers
      const purchaseIds = [...new Set((deliveries || []).map((d) => d.purchase_id).filter(Boolean))] as string[];
      const supplierTonnage = new Map<string, number>();
      for (const d of deliveries || []) {
        if (d.purchase_id) {
          supplierTonnage.set(d.purchase_id, (supplierTonnage.get(d.purchase_id) || 0) + (d.net_weight || 0));
        }
      }

      const topPurchaseIds = Array.from(supplierTonnage.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id]) => id);

      const topSuppliers: { name: string; tonnage: number }[] = [];
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

      // Top 5 carriers
      const carrierAgg = new Map<string, number>();
      for (const t of carrierTxs || []) {
        carrierAgg.set(t.carrier_id, (carrierAgg.get(t.carrier_id) || 0) + (t.amount || 0));
      }
      const topCarrierIds = Array.from(carrierAgg.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id]) => id);

      const topCarriers: { name: string; amount: number }[] = [];
      if (topCarrierIds.length > 0) {
        const { data: carriers } = await supabase
          .from("carriers")
          .select("id, name")
          .in("id", topCarrierIds);
        for (const cid of topCarrierIds) {
          const carrier = (carriers || []).find((c) => c.id === cid);
          topCarriers.push({
            name: carrier?.name || "—",
            amount: carrierAgg.get(cid) || 0,
          });
        }
      }

      // Feed type distribution
      const feedMap = new Map<string, string>();
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

      const feedTonnage = new Map<string, number>();
      for (const d of deliveries || []) {
        const refId = d.sale_id || d.purchase_id || "";
        const feedName = feedMap.get(refId) || "Diğer";
        feedTonnage.set(feedName, (feedTonnage.get(feedName) || 0) + (d.net_weight || 0));
      }

      const feedDistribution = Array.from(feedTonnage.entries())
        .map(([name, kg]) => ({ name, tonnage: kg }))
        .sort((a, b) => b.tonnage - a.tonnage);

      return {
        totalDeliveries,
        totalTonnage,
        totalRevenue,
        totalCost,
        totalFreight,
        netProfit,
        margin,
        topCustomers,
        topSuppliers,
        topCarriers,
        feedDistribution,
      };
    },
  });
}
