"use client";

import { useMemo } from "react";
import { useInventorySummary, useInventoryMovements } from "@/lib/hooks/use-inventory";
import type { MovementType, InventorySummary } from "@/lib/types/database.types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Warehouse, ArrowDownToLine, ArrowUpFromLine, RefreshCw } from "lucide-react";
import { formatCurrency, formatDateShort } from "@/lib/utils/format";
import { useBalanceVisibility } from "@/lib/contexts/balance-visibility";

const MOVEMENT_LABELS: Record<MovementType, string> = {
  purchase_in: "Alım Girişi",
  sale_out: "Satış Çıkışı",
  adjustment: "Düzeltme",
  return: "İade",
};

const MOVEMENT_COLORS: Record<MovementType, string> = {
  purchase_in: "bg-green-100 text-green-800",
  sale_out: "bg-red-100 text-red-800",
  adjustment: "bg-yellow-100 text-yellow-800",
  return: "bg-blue-100 text-blue-800",
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
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-2xl font-bold">Stok</h1>
        <p className="text-sm text-muted-foreground">
          Depo bazlı stok durumu ve hareketler
        </p>
      </div>

      {/* Summary Card */}
      {!invLoading && inventory && inventory.length > 0 && (
        <Card>
          <CardContent className="grid grid-cols-2 gap-3 p-4 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Toplam Stok</p>
              <p className="text-lg font-bold">
                {(totals.qty / 1000).toFixed(1)} ton
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Toplam Değer</p>
              <p className="text-lg font-bold">{masked(totals.value)}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Warehouse sections */}
      {invLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : grouped.size > 0 ? (
        Array.from(grouped.entries()).map(([warehouseName, items]) => {
          const whTotal = items.reduce((s, i) => s + i.total_value, 0);
          const whQty = items.reduce((s, i) => s + i.quantity_kg, 0);
          return (
            <Card key={warehouseName}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Warehouse className="h-4 w-4" />
                    {warehouseName}
                  </span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {(whQty / 1000).toFixed(1)} ton · {masked(whTotal)}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-0 p-0">
                {items.map((item, i) => (
                  <div key={item.id}>
                    {i > 0 && <Separator />}
                    <div className="flex items-center justify-between px-4 py-2.5">
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
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })
      ) : (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Henüz stok kaydı yok.
        </div>
      )}

      {/* Movement Log */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Son Stok Hareketleri</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0 p-0">
          {movLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : movements && movements.length > 0 ? (
            movements.map((m, i) => {
              const Icon = MOVEMENT_ICONS[m.movement_type] || RefreshCw;
              const isPositive = m.quantity_change > 0;
              return (
                <div key={m.id}>
                  {i > 0 && <Separator />}
                  <div className="flex items-center gap-3 px-4 py-2.5">
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                        isPositive ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="secondary"
                          className={`text-xs ${MOVEMENT_COLORS[m.movement_type] || ""}`}
                        >
                          {MOVEMENT_LABELS[m.movement_type] || m.movement_type}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
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
                </div>
              );
            })
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Henüz stok hareketi yok.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
