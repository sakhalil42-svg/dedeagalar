"use client";

import { useMemo } from "react";
import { useInventorySummary, useInventoryMovements } from "@/lib/hooks/use-inventory";
import type { MovementType, InventorySummary } from "@/lib/types/database.types";
import { Loader2, Warehouse, ArrowDownToLine, ArrowUpFromLine, RefreshCw, Package, Scale } from "lucide-react";
import { formatCurrency, formatDateShort } from "@/lib/utils/format";
import { useBalanceVisibility } from "@/lib/contexts/balance-visibility";

const MOVEMENT_LABELS: Record<MovementType, string> = {
  purchase_in: "Alım Girişi",
  sale_out: "Satış Çıkışı",
  adjustment: "Düzeltme",
  return: "İade",
};

const MOVEMENT_COLORS: Record<MovementType, string> = {
  purchase_in: "bg-green-100 text-green-600",
  sale_out: "bg-red-100 text-red-600",
  adjustment: "bg-yellow-100 text-yellow-600",
  return: "bg-blue-100 text-blue-600",
};

const MOVEMENT_ICONS: Record<MovementType, React.ElementType> = {
  purchase_in: ArrowDownToLine,
  sale_out: ArrowUpFromLine,
  adjustment: RefreshCw,
  return: ArrowDownToLine,
};

export default function InventoryPage() {
  const { data: inventory, isLoading: invLoading } = useInventorySummary();
  const { data: movements, isLoading: movLoading } = useInventoryMovements(20);
  const { isVisible } = useBalanceVisibility();
  const masked = (amount: number) => isVisible ? formatCurrency(amount) : "••••••";

  // Group by warehouse
  const grouped = useMemo(() => {
    if (!inventory) return new Map<string, InventorySummary[]>();
    const map = new Map<string, InventorySummary[]>();
    for (const item of inventory) {
      const key = item.warehouse_name;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return map;
  }, [inventory]);

  // Totals
  const totals = useMemo(() => {
    if (!inventory) return { qty: 0, value: 0 };
    return inventory.reduce(
      (acc, i) => ({
        qty: acc.qty + i.quantity_kg,
        value: acc.value + i.total_value,
      }),
      { qty: 0, value: 0 }
    );
  }, [inventory]);

  return (
    <div className="p-4 page-enter">
      <div className="mb-4">
        <h1 className="text-xl font-bold">Stok</h1>
        <p className="text-xs text-muted-foreground">
          Depo bazlı stok durumu ve hareketler
        </p>
      </div>

      {/* KPI Cards */}
      {!invLoading && inventory && inventory.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-2xl bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100">
                <Scale className="h-4 w-4 text-blue-600" />
              </div>
            </div>
            <p className="text-xl font-extrabold">
              {(totals.qty / 1000).toFixed(1)} ton
            </p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">Toplam Stok</p>
          </div>
          <div className="rounded-2xl bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-green-100">
                <Package className="h-4 w-4 text-green-600" />
              </div>
            </div>
            <p className="text-xl font-extrabold">{masked(totals.value)}</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">Toplam Değer</p>
          </div>
        </div>
      )}

      {/* Warehouse sections */}
      {invLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : grouped.size > 0 ? (
        <div className="space-y-3 mb-4">
          {Array.from(grouped.entries()).map(([warehouseName, items]) => {
            const whTotal = items.reduce((s, i) => s + i.total_value, 0);
            const whQty = items.reduce((s, i) => s + i.quantity_kg, 0);
            return (
              <div key={warehouseName} className="rounded-xl bg-card shadow-sm overflow-hidden">
                <div className="flex items-center justify-between p-3 bg-muted/50">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <Warehouse className="h-4 w-4 text-primary" />
                    {warehouseName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {(whQty / 1000).toFixed(1)} ton · {masked(whTotal)}
                  </span>
                </div>
                <div>
                  {items.map((item, i) => (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between px-4 py-2.5 ${
                        i > 0 ? "border-t border-border/50" : ""
                      }`}
                    >
                      <div>
                        <p className="text-sm font-medium">{item.feed_type_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.quantity_kg.toLocaleString("tr-TR")} kg ·{" "}
                          {masked(item.unit_cost)}/kg
                        </p>
                      </div>
                      <p className="text-sm font-bold">
                        {masked(item.total_value)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Henüz stok kaydı yok.
        </div>
      )}

      {/* Movement Log */}
      <div className="rounded-xl bg-card shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 p-3 bg-muted/50">
          <RefreshCw className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Son Stok Hareketleri</span>
        </div>
        {movLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : movements && movements.length > 0 ? (
          movements.map((m, i) => {
            const Icon = MOVEMENT_ICONS[m.movement_type] || RefreshCw;
            const isPositive = m.quantity_change > 0;
            return (
              <div
                key={m.id}
                className={`flex items-center gap-3 px-4 py-2.5 ${
                  i > 0 ? "border-t border-border/50" : ""
                }`}
              >
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                    MOVEMENT_COLORS[m.movement_type] || "bg-gray-100 text-gray-600"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className={`inline-block rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                    MOVEMENT_COLORS[m.movement_type] || ""
                  }`}>
                    {MOVEMENT_LABELS[m.movement_type] || m.movement_type}
                  </span>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {formatDateShort(m.created_at)}
                    {m.notes && ` · ${m.notes}`}
                  </p>
                </div>
                <p
                  className={`shrink-0 text-sm font-bold ${
                    isPositive ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {isPositive ? "+" : ""}
                  {m.quantity_change.toLocaleString("tr-TR")} kg
                </p>
              </div>
            );
          })
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Henüz stok hareketi yok.
          </p>
        )}
      </div>
    </div>
  );
}
