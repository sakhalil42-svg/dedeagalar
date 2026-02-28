"use client";

import { use } from "react";
import Link from "next/link";
import { useSeasons } from "@/lib/hooks/use-seasons";
import { useSeasonReport } from "@/lib/hooks/use-season-report";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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

    // Summary sheet
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

    // Customers
    if (report.topCustomers.length > 0) {
      const custData = report.topCustomers.map((c, i) => ({
        Sıra: i + 1,
        Müşteri: c.name,
        "Tonaj (kg)": c.tonnage,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(custData), "Müşteriler");
    }

    // Suppliers
    if (report.topSuppliers.length > 0) {
      const suppData = report.topSuppliers.map((s, i) => ({
        Sıra: i + 1,
        Tedarikçi: s.name,
        "Tonaj (kg)": s.tonnage,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(suppData), "Tedarikçiler");
    }

    // Carriers
    if (report.topCarriers.length > 0) {
      const carrData = report.topCarriers.map((c, i) => ({
        Sıra: i + 1,
        Nakliyeci: c.name,
        Tutar: c.amount,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(carrData), "Nakliyeciler");
    }

    // Feed types
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
    <div className="space-y-4 p-4 page-enter">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/settings/seasons">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold">{season?.name || "Sezon Raporu"}</h1>
            {season && (
              <p className="text-sm text-muted-foreground">
                {formatDateShort(season.start_date)}
                {season.end_date ? ` — ${formatDateShort(season.end_date)}` : " — Devam ediyor"}
                {" "}
                {season.is_active ? (
                  <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-700">Aktif</Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px]">Kapalı</Badge>
                )}
              </p>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={!report}>
          <Download className="mr-1 h-3 w-3" />
          Excel
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : report ? (
        <>
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 gap-2">
            <SummaryCard
              icon={Truck}
              title="Sevkiyat"
              value={`${report.totalDeliveries} adet`}
              subtitle={formatWeight(report.totalTonnage)}
            />
            <SummaryCard
              icon={CircleDollarSign}
              title="Satış Cirosu"
              value={formatCurrency(report.totalRevenue)}
              color="text-green-600"
            />
            <SummaryCard
              icon={Scale}
              title="Alım Maliyeti"
              value={formatCurrency(report.totalCost)}
              color="text-red-600"
            />
            <SummaryCard
              icon={Truck}
              title="Nakliye Gideri"
              value={formatCurrency(report.totalFreight)}
              color="text-orange-600"
            />
          </div>

          {/* Net Profit */}
          <Card className={report.netProfit >= 0 ? "border-green-200 bg-green-50/30" : "border-red-200 bg-red-50/30"}>
            <CardContent className="py-4 text-center">
              <p className="text-xs text-muted-foreground">Net Kâr</p>
              <p className={`text-2xl font-bold ${report.netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatCurrency(report.netProfit)}
              </p>
              <p className="text-xs text-muted-foreground">
                Marj: %{report.margin.toFixed(1)}
              </p>
            </CardContent>
          </Card>

          {/* Top Customers */}
          {report.topCustomers.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4" />
                  En Çok Satış Yapılan Müşteriler
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {report.topCustomers.map((c, i) => (
                  <div key={i} className="flex items-center justify-between py-1">
                    <p className="text-sm truncate">{i + 1}. {c.name}</p>
                    <p className="text-sm font-medium shrink-0">{formatWeight(c.tonnage)}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Top Suppliers */}
          {report.topSuppliers.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4" />
                  En Çok Alım Yapılan Tedarikçiler
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {report.topSuppliers.map((s, i) => (
                  <div key={i} className="flex items-center justify-between py-1">
                    <p className="text-sm truncate">{i + 1}. {s.name}</p>
                    <p className="text-sm font-medium shrink-0">{formatWeight(s.tonnage)}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Top Carriers */}
          {report.topCarriers.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Truck className="h-4 w-4" />
                  En Çok Nakliye Gideri
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {report.topCarriers.map((c, i) => (
                  <div key={i} className="flex items-center justify-between py-1">
                    <p className="text-sm truncate">{i + 1}. {c.name}</p>
                    <p className="text-sm font-medium shrink-0">{formatCurrency(c.amount)}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Feed Distribution */}
          {report.feedDistribution.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Wheat className="h-4 w-4" />
                  Yem Türü Dağılımı
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {report.feedDistribution.map((f, i) => (
                  <div key={i} className="flex items-center justify-between py-1">
                    <p className="text-sm truncate">{f.name}</p>
                    <p className="text-sm font-medium shrink-0">{formatWeight(f.tonnage)}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
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

function SummaryCard({
  icon: Icon,
  title,
  value,
  subtitle,
  color,
}: {
  icon: React.ElementType;
  title: string;
  value: string;
  subtitle?: string;
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground">{title}</p>
        </div>
        <p className={`mt-1 text-sm font-bold truncate ${color || ""}`}>{value}</p>
        {subtitle && <p className="text-[10px] text-muted-foreground">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}
