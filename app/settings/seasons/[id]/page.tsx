"use client";

import { use } from "react";
import Link from "next/link";
import { useSeasons } from "@/lib/hooks/use-seasons";
import { useSeasonReport } from "@/lib/hooks/use-season-report";
import {
  ArrowLeft,
  Loader2,
  Download,
  TrendingUp,
  Truck,
  Scale,
  CircleDollarSign,
  Users,
  Wheat,
} from "lucide-react";
import { formatCurrency, formatWeight, formatDateShort } from "@/lib/utils/format";
import * as XLSX from "xlsx";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

const MEDAL_STYLES = [
  "bg-amber-100 text-amber-600",
  "bg-gray-200 text-gray-600",
  "bg-orange-100 text-orange-600",
];

export default function SeasonReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: seasons } = useSeasons();
  const { data: report, isLoading } = useSeasonReport(id);

  const season = seasons?.find((s) => s.id === id);

  const handleExport = () => {
    if (!report || !season) return;

    const wb = XLSX.utils.book_new();

    const summaryData = [
      { Metrik: "Sezon", Değer: season.name },
      { Metrik: "Başlangıç", Değer: season.start_date },
      { Metrik: "Bitiş", Değer: season.end_date || "Devam ediyor" },
      { Metrik: "Sevkiyat Adedi", Değer: report.totalDeliveries },
      { Metrik: "Toplam Tonaj (kg)", Değer: report.totalTonnage },
      { Metrik: "Satış Cirosu", Değer: report.totalRevenue },
      { Metrik: "Alım Maliyeti", Değer: report.totalCost },
      { Metrik: "Nakliye Gideri", Değer: report.totalFreight },
      { Metrik: "Net Kâr", Değer: report.netProfit },
      { Metrik: "Marj (%)", Değer: Math.round(report.margin * 10) / 10 },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), "Özet");

    if (report.topCustomers.length > 0) {
      const custData = report.topCustomers.map((c, i) => ({
        Sıra: i + 1,
        Müşteri: c.name,
        "Tonaj (kg)": c.tonnage,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(custData), "Müşteriler");
    }

    if (report.topSuppliers.length > 0) {
      const suppData = report.topSuppliers.map((s, i) => ({
        Sıra: i + 1,
        Tedarikçi: s.name,
        "Tonaj (kg)": s.tonnage,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(suppData), "Tedarikçiler");
    }

    if (report.topCarriers.length > 0) {
      const carrData = report.topCarriers.map((c, i) => ({
        Sıra: i + 1,
        Nakliyeci: c.name,
        Tutar: c.amount,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(carrData), "Nakliyeciler");
    }

    if (report.feedDistribution.length > 0) {
      const feedData = report.feedDistribution.map((f) => ({
        "Yem Türü": f.name,
        "Tonaj (kg)": f.tonnage,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(feedData), "Yem Türleri");
    }

    const filename = `Sezon_Rapor_${season.name.replace(/\s+/g, "_")}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  return (
    <div className="p-4 page-enter">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Link
            href="/settings/seasons"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold">{season?.name || "Sezon Raporu"}</h1>
            {season && (
              <p className="text-xs text-muted-foreground">
                {formatDateShort(season.start_date)}
                {season.end_date ? ` — ${formatDateShort(season.end_date)}` : " — Devam ediyor"}
                {" "}
                {season.is_active ? (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">Aktif</span>
                ) : (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">Kapalı</span>
                )}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={handleExport}
          disabled={!report}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-muted-foreground hover:bg-muted/80 transition-colors disabled:opacity-40"
        >
          <Download className="h-4 w-4" />
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : report ? (
        <>
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="rounded-2xl bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100">
                  <Truck className="h-4 w-4 text-blue-600" />
                </div>
              </div>
              <p className="text-xl font-extrabold">{report.totalDeliveries}</p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">
                Sevkiyat · {formatWeight(report.totalTonnage)}
              </p>
            </div>
            <div className="rounded-2xl bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-green-100">
                  <CircleDollarSign className="h-4 w-4 text-green-600" />
                </div>
              </div>
              <p className="text-xl font-extrabold text-green-600">{formatCurrency(report.totalRevenue)}</p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">Satış Cirosu</p>
            </div>
            <div className="rounded-2xl bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-100">
                  <Scale className="h-4 w-4 text-red-600" />
                </div>
              </div>
              <p className="text-xl font-extrabold text-red-600">{formatCurrency(report.totalCost)}</p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">Alım Maliyeti</p>
            </div>
            <div className="rounded-2xl bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-100">
                  <Truck className="h-4 w-4 text-orange-600" />
                </div>
              </div>
              <p className="text-xl font-extrabold text-orange-600">{formatCurrency(report.totalFreight)}</p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">Nakliye Gideri</p>
            </div>
          </div>

          {/* Net Profit */}
          <div className={`rounded-2xl p-5 shadow-sm mb-4 text-center ${
            report.netProfit >= 0 ? "bg-primary text-white" : "bg-red-600 text-white"
          }`}>
            <p className="text-xs opacity-80 mb-1">Net Kâr</p>
            <p className="text-2xl font-extrabold">{formatCurrency(report.netProfit)}</p>
            <p className="text-[10px] opacity-60 mt-0.5">Marj: %{report.margin.toFixed(1)}</p>
          </div>

          {/* Monthly Profit Trend Bar Chart */}
          {(report as Record<string, unknown>).monthlyBreakdown && ((report as Record<string, unknown>).monthlyBreakdown as Array<{month: string; profit: number}>).length > 0 && (
            <div className="rounded-xl bg-card p-4 shadow-sm mb-4">
              <p className="text-sm font-semibold mb-3">Aylık Kâr Trendi</p>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={(report as Record<string, unknown>).monthlyBreakdown as Array<{month: string; profit: number}>}>
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    { /* eslint-disable-next-line @typescript-eslint/no-explicit-any */ }
                    <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                    <Bar dataKey="profit" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Feed Distribution Pie Chart */}
          {report.feedDistribution.length > 0 && (
            <div className="rounded-xl bg-card p-4 shadow-sm mb-4">
              <div className="flex items-center gap-2 mb-3">
                <Wheat className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Ürün Dağılımı</span>
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={report.feedDistribution.map(f => ({ name: f.name, value: f.tonnage }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {report.feedDistribution.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend
                      formatter={(value: string) => <span className="text-xs">{value}</span>}
                    />
                    { /* eslint-disable-next-line @typescript-eslint/no-explicit-any */ }
                    <Tooltip formatter={(value: any) => formatWeight(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Top Customers with medals */}
          {report.topCustomers.length > 0 && (
            <ListSection
              icon={Users}
              title="En Çok Satış Yapılan Müşteriler"
              ranked
              items={report.topCustomers.map((c, i) => ({
                rank: i + 1,
                name: c.name,
                value: formatWeight(c.tonnage),
              }))}
            />
          )}

          {/* Top Suppliers as horizontal scroll cards */}
          {report.topSuppliers.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-3 px-1">
                <Users className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">En Çok Alım Yapılan Tedarikçiler</span>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                {report.topSuppliers.map((s, i) => (
                  <div key={i} className="flex-shrink-0 w-36 rounded-xl bg-card p-3 shadow-sm">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold mb-2">
                      {(s.name || "?").charAt(0).toUpperCase()}
                    </div>
                    <p className="text-xs font-semibold truncate">{s.name}</p>
                    <p className="text-[10px] text-muted-foreground">{formatWeight(s.tonnage)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Carriers */}
          {report.topCarriers.length > 0 && (
            <ListSection
              icon={Truck}
              title="En Çok Nakliye Gideri"
              items={report.topCarriers.map((c, i) => ({
                rank: i + 1,
                name: c.name,
                value: formatCurrency(c.amount),
              }))}
            />
          )}
        </>
      ) : (
        <div className="py-20 text-center text-sm text-muted-foreground">
          Rapor verisi bulunamadı
        </div>
      )}
    </div>
  );
}

function ListSection({
  icon: Icon,
  title,
  items,
  ranked = false,
}: {
  icon: React.ElementType;
  title: string;
  items: { rank?: number; name: string; value: string }[];
  ranked?: boolean;
}) {
  return (
    <div className="rounded-xl bg-card shadow-sm overflow-hidden mb-3">
      <div className="flex items-center gap-2 p-3 bg-muted/50">
        <Icon className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">{title}</span>
      </div>
      {items.map((item, i) => (
        <div
          key={i}
          className={`flex items-center justify-between px-4 py-2.5 ${
            i > 0 ? "border-t border-border/50" : ""
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {item.rank != null && ranked && item.rank <= 3 ? (
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold shrink-0 ${
                  MEDAL_STYLES[item.rank - 1]
                }`}
              >
                {item.rank}
              </div>
            ) : item.rank != null ? (
              <span className="text-sm text-muted-foreground shrink-0 w-6 text-center">{item.rank}.</span>
            ) : null}
            <p className="text-sm truncate">{item.name}</p>
          </div>
          <p className="text-sm font-bold shrink-0 ml-2">{item.value}</p>
        </div>
      ))}
    </div>
  );
}
