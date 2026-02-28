"use client";

import Link from "next/link";
import {
  useDashboardKpis,
  useMonthlyChart,
  useDailyTonnageChart,
  useWeeklyProfitChart,
  useFeedTypeDistribution,
  useRecentActivities,
  useSeasonSummary,
  useDueItems,
} from "@/lib/hooks/use-dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  TrendingUp,
  AlertTriangle,
  Truck,
  CircleDollarSign,
  Scale,
  FileText,
  Banknote,
  Plus,
  Trophy,
  ArrowRight,
  MessageCircle,
  Calendar,
} from "lucide-react";
import { SkeletonKpiCard, SkeletonChart, Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDateShort, formatWeight } from "@/lib/utils/format";
import { useBalanceVisibility } from "@/lib/contexts/balance-visibility";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { openWhatsAppMessage, buildOdemeHatirlatmaMessage, buildCekVadeMessage } from "@/lib/utils/whatsapp";
import { useCarrierBalances } from "@/lib/hooks/use-carrier-transactions";
import { Onboarding } from "@/components/layout/onboarding";
import { useSeasonFilter } from "@/lib/contexts/season-context";

// ═══════════════════════════════════════════════════════════
// SHARED HELPERS
// ═══════════════════════════════════════════════════════════

function formatMobileAmount(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)} milyon`;
  if (abs >= 1_000) return `${sign}${Math.round(abs / 1_000)} bin`;
  return `${sign}${abs.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}`;
}

function formatCompact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toFixed(0);
}

function getBalanceLevel(amount: number): { color: string; bg: string; label: string } {
  if (amount >= 500_000) return { color: "text-red-600", bg: "bg-red-100", label: "Acil" };
  if (amount >= 200_000) return { color: "text-yellow-600", bg: "bg-yellow-100", label: "Dikkat" };
  return { color: "text-green-600", bg: "bg-green-100", label: "Normal" };
}

// KPI icon color configs
const KPI_CONFIGS = {
  blue: { icon: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-900/30" },
  purple: { icon: "text-purple-600 dark:text-purple-400", bg: "bg-purple-100 dark:bg-purple-900/30" },
  green: { icon: "text-primary", bg: "bg-primary/10" },
  red: { icon: "text-red-600 dark:text-red-400", bg: "bg-red-100 dark:bg-red-900/30" },
  amber: { icon: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-900/30" },
  orange: { icon: "text-orange-600 dark:text-orange-400", bg: "bg-orange-100 dark:bg-orange-900/30" },
  teal: { icon: "text-teal-600 dark:text-teal-400", bg: "bg-teal-100 dark:bg-teal-900/30" },
  yellow: { icon: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-100 dark:bg-yellow-900/30" },
};

// ═══════════════════════════════════════════════════════════
// KPI CARD — Stitch Style
// ═══════════════════════════════════════════════════════════

function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  loading,
  color,
  iconColor = "green",
  href,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  loading?: boolean;
  color?: string;
  iconColor?: string;
  href?: string;
}) {
  const cfg = KPI_CONFIGS[iconColor as keyof typeof KPI_CONFIGS] || KPI_CONFIGS.green;

  const content = (
    <Card className={`rounded-2xl ${href ? "transition-colors hover:border-primary/30" : ""}`}>
      <CardContent className="p-4 flex flex-col gap-2">
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${cfg.bg}`}>
          <Icon className={`h-4.5 w-4.5 ${cfg.icon}`} />
        </div>
        {loading ? (
          <div className="space-y-1">
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
        ) : (
          <div>
            <p className={`text-2xl font-extrabold leading-tight truncate ${color || ""}`}>{value}</p>
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mt-0.5">{title}</p>
            {subtitle && <p className="text-[9px] text-muted-foreground truncate">{subtitle}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (href) return <Link href={href}>{content}</Link>;
  return content;
}

// ═══════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════════════════

export function DashboardContent() {
  const { selectedSeasonId } = useSeasonFilter();
  const { data: kpis, isLoading: kpisLoading, isError: kpisError } = useDashboardKpis();
  const { data: chartData, isLoading: chartLoading, isError: chartError } = useMonthlyChart();
  const { data: dailyTonnage, isLoading: dailyLoading, isError: dailyError } = useDailyTonnageChart();
  const { data: weeklyProfit, isLoading: weeklyLoading, isError: weeklyError } = useWeeklyProfitChart();
  const { data: feedDist, isLoading: feedLoading, isError: feedError } = useFeedTypeDistribution();
  const { data: activities, isLoading: activitiesLoading, isError: activitiesError } = useRecentActivities();
  const { data: season, isLoading: seasonLoading, isError: seasonError } = useSeasonSummary(selectedSeasonId);
  const { data: dueItems, isLoading: dueLoading, isError: dueError } = useDueItems();
  const { data: carrierBalances, isLoading: carrierLoading, isError: carrierError } = useCarrierBalances();

  const hasAnyError = kpisError || chartError || dailyError || weeklyError || feedError || activitiesError || seasonError || dueError || carrierError;
  const { isVisible } = useBalanceVisibility();
  const masked = (amount: number) => (isVisible ? formatCurrency(amount) : "••••••");
  const maskedCompact = (amount: number) => (isVisible ? formatMobileAmount(amount) : "••••");
  const tooltipFormatter = (value: number | undefined) => masked(value ?? 0);

  const showOnboarding =
    !kpisLoading &&
    kpis &&
    kpis.todayTruckCount === 0 &&
    kpis.monthProfit === 0 &&
    kpis.pendingReceivables === 0 &&
    kpis.pendingPayables === 0;

  return (
    <div className="space-y-5 page-enter">
      {hasAnyError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <p>Bazı veriler yüklenirken hata oluştu. İnternet bağlantınızı kontrol edin.</p>
        </div>
      )}
      <Onboarding show={!!showOnboarding} />

      {/* ═══ KPI Grid — 2 col × 4 rows ═══ */}
      <div className="grid grid-cols-2 gap-3">
        <KpiCard
          title="Bugün Tır"
          value={kpis ? String(kpis.todayTruckCount) : "--"}
          icon={Truck}
          iconColor="blue"
          loading={kpisLoading}
          subtitle={kpis && kpis.todayTonnage > 0 ? formatWeight(kpis.todayTonnage) : undefined}
        />
        <KpiCard
          title="Bugün Tonaj"
          value={kpis ? formatWeight(kpis.todayTonnage) : "--"}
          icon={Scale}
          iconColor="purple"
          loading={kpisLoading}
        />
        <KpiCard
          title="Bugün Kâr"
          value={kpis ? maskedCompact(kpis.todayProfit) : "--"}
          icon={TrendingUp}
          iconColor="green"
          loading={kpisLoading}
          color={kpis ? (kpis.todayProfit >= 0 ? "text-green-600" : "text-red-600") : ""}
          href="/finance/profit"
        />
        <KpiCard
          title="Bu Ay Kâr"
          value={kpis ? maskedCompact(kpis.monthProfit) : "--"}
          icon={TrendingUp}
          iconColor="green"
          loading={kpisLoading}
          color={kpis ? (kpis.monthProfit >= 0 ? "text-green-600" : "text-red-600") : ""}
          href="/finance/profit"
        />
        <KpiCard
          title="Toplam Alacak"
          value={kpis ? maskedCompact(kpis.pendingReceivables) : "--"}
          icon={CircleDollarSign}
          iconColor="teal"
          loading={kpisLoading}
          color="text-red-600"
          href="/finance"
        />
        <KpiCard
          title="Toplam Borç"
          value={kpis ? maskedCompact(kpis.pendingPayables) : "--"}
          icon={CircleDollarSign}
          iconColor="orange"
          loading={kpisLoading}
          color="text-amber-600"
          href="/finance"
        />
        <KpiCard
          title="Vadesi Gelen"
          value={kpis ? `${kpis.dueCheckCount} adet` : "--"}
          subtitle={kpis && kpis.dueCheckTotal > 0 ? maskedCompact(kpis.dueCheckTotal) : undefined}
          icon={FileText}
          iconColor="yellow"
          loading={kpisLoading}
          color={kpis && kpis.overdueCheckCount > 0 ? "text-red-600" : "text-amber-600"}
          href="/finance/calendar"
        />
        <KpiCard
          title="Nakliye (Ay)"
          value={kpis ? maskedCompact(kpis.monthlyFreight) : "--"}
          icon={Truck}
          iconColor="red"
          loading={kpisLoading}
          color="text-orange-600"
        />
      </div>

      {/* ═══ Dikkat Gerekenler ═══ */}
      {!kpisLoading && kpis && (kpis.customerBalances.length > 0 || kpis.supplierBalances.length > 0) && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Dikkat Gerekenler</h2>
            <Link href="/finance" className="text-xs text-primary font-medium">
              Tümünü Gör
            </Link>
          </div>
          <Card className="rounded-2xl">
            <CardContent className="p-0 divide-y">
              {/* Müşteri Alacakları */}
              {kpis.customerBalances.length > 0 && (
                <div className="px-4 py-3">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2">Müşteri Alacakları</p>
                  <div className="space-y-2">
                    {kpis.customerBalances.slice(0, 5).map((b) => {
                      const level = getBalanceLevel(b.balance);
                      const isOverLimit = b.credit_limit != null && b.credit_limit > 0 && b.balance > b.credit_limit;
                      const initials = b.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
                      return (
                        <div key={b.contactId} className="flex items-center gap-3">
                          <Link href={`/finance/${b.contactId}`} className="flex items-center gap-3 min-w-0 flex-1">
                            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${isOverLimit ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : level.bg + " " + level.color}`}>
                              {initials}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{b.name}</p>
                              <p className={`text-xs ${isOverLimit ? "text-red-600 font-semibold" : level.color}`}>
                                {maskedCompact(b.balance)}
                                {isOverLimit && " · LİMİT AŞIMI"}
                              </p>
                            </div>
                          </Link>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {b.phone && (
                              <button
                                onClick={() =>
                                  openWhatsAppMessage(
                                    b.phone,
                                    buildOdemeHatirlatmaMessage({ contactName: b.name, balance: b.balance })
                                  )
                                }
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 transition-colors"
                              >
                                <MessageCircle className="h-4 w-4" />
                              </button>
                            )}
                            <Link href={`/finance/${b.contactId}`}>
                              <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tedarikçi Borçları */}
              {kpis.supplierBalances.length > 0 && (
                <div className="px-4 py-3">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2">Tedarikçi Borçları</p>
                  <div className="space-y-2">
                    {kpis.supplierBalances.slice(0, 5).map((b) => {
                      const level = getBalanceLevel(b.balance);
                      const initials = b.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
                      return (
                        <div key={b.contactId} className="flex items-center gap-3">
                          <Link href={`/finance/${b.contactId}`} className="flex items-center gap-3 min-w-0 flex-1">
                            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${level.bg} ${level.color}`}>
                              {initials}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{b.name}</p>
                              <p className={`text-xs ${level.color}`}>{maskedCompact(b.balance)}</p>
                            </div>
                          </Link>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {b.phone && (
                              <button
                                onClick={() =>
                                  openWhatsAppMessage(
                                    b.phone,
                                    buildOdemeHatirlatmaMessage({ contactName: b.name, balance: b.balance })
                                  )
                                }
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 transition-colors"
                              >
                                <MessageCircle className="h-4 w-4" />
                              </button>
                            )}
                            <Link href={`/finance/${b.contactId}`}>
                              <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Nakliyeci Borçları */}
              {!carrierLoading && carrierBalances && carrierBalances.filter((b) => b.balance > 0).length > 0 && (
                <div className="px-4 py-3">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2">Nakliyeci Borçları</p>
                  <div className="space-y-2">
                    {carrierBalances
                      .filter((b) => b.balance > 0)
                      .slice(0, 5)
                      .map((b) => {
                        const initials = b.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
                        return (
                          <Link
                            key={b.id}
                            href={`/settings/carriers/${b.id}`}
                            className="flex items-center gap-3"
                          >
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 text-xs font-bold">
                              {initials}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{b.name}</p>
                              <p className="text-xs text-orange-600">{maskedCompact(b.balance)}</p>
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                          </Link>
                        );
                      })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {/* ═══ Yaklaşan Vadeler — Horizontal Scroll ═══ */}
      {!dueLoading && dueItems && dueItems.length > 0 && (() => {
        const overdue = dueItems.filter((i) => i.days_diff < 0);
        const todayDue = dueItems.filter((i) => i.days_diff === 0);
        const thisWeek = dueItems.filter((i) => i.days_diff > 0 && i.days_diff <= 7);
        const later = dueItems.filter((i) => i.days_diff > 7);

        const overdueTotal = overdue.reduce((s, i) => s + i.amount, 0);
        const todayTotal = todayDue.reduce((s, i) => s + i.amount, 0);
        const weekTotal = thisWeek.reduce((s, i) => s + i.amount, 0);
        const laterTotal = later.reduce((s, i) => s + i.amount, 0);

        const cards: { label: string; count: number; total: number; color: string; bgColor: string; iconColor: string }[] = [];
        if (overdue.length > 0) cards.push({ label: "Gecikmiş", count: overdue.length, total: overdueTotal, color: "text-red-700 dark:text-red-400", bgColor: "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800", iconColor: "text-red-500" });
        if (todayDue.length > 0) cards.push({ label: "Bugün", count: todayDue.length, total: todayTotal, color: "text-amber-700 dark:text-amber-400", bgColor: "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800", iconColor: "text-amber-500" });
        if (thisWeek.length > 0) cards.push({ label: "Bu Hafta", count: thisWeek.length, total: weekTotal, color: "text-green-700 dark:text-green-400", bgColor: "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800", iconColor: "text-green-500" });
        if (later.length > 0) cards.push({ label: "Yaklaşan", count: later.length, total: laterTotal, color: "text-blue-700 dark:text-blue-400", bgColor: "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800", iconColor: "text-blue-500" });

        return (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Yaklaşan Vadeler</h2>
              <Link href="/finance/calendar" className="text-xs text-primary font-medium">
                Takvim
              </Link>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
              {cards.map((card) => (
                <Link
                  key={card.label}
                  href="/finance/calendar"
                  className={`flex-shrink-0 w-36 rounded-2xl border p-3 ${card.bgColor} transition-colors`}
                >
                  <Calendar className={`h-5 w-5 mb-2 ${card.iconColor}`} />
                  <p className={`text-lg font-extrabold ${card.color}`}>{card.count}</p>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{card.label}</p>
                  <p className={`text-xs font-semibold mt-1 ${card.color}`}>{maskedCompact(card.total)}</p>
                </Link>
              ))}
            </div>
          </section>
        );
      })()}

      {/* ═══ Charts ═══ */}

      {/* Daily Tonnage (last 30 days) */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Günlük Sevkiyat (Son 30 Gün)</CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          {dailyLoading ? (
            <SkeletonChart />
          ) : dailyTonnage && dailyTonnage.some((d) => d.tonnage > 0) ? (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={dailyTonnage} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={4} />
                <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => `${v}t`} />
                <Tooltip
                  formatter={(v: number | undefined) => [`${(v ?? 0).toFixed(1)} ton`, "Tonaj"]}
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))" }}
                />
                <Bar dataKey="tonnage" name="Tonaj" fill="#166534" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              Sevkiyat verisi yok.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Weekly Profit (last 12 weeks) */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Haftalık Kâr Trendi (12 Hafta)</CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          {weeklyLoading ? (
            <SkeletonChart />
          ) : weeklyProfit && weeklyProfit.some((d) => d.profit !== 0) ? (
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={weeklyProfit} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="week" tick={{ fontSize: 9 }} interval={1} />
                <YAxis tick={{ fontSize: 9 }} tickFormatter={formatCompact} />
                <Tooltip
                  formatter={tooltipFormatter}
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))" }}
                />
                <Line
                  type="monotone"
                  dataKey="profit"
                  name="Kâr"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              Kâr verisi yok.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Feed Type + Monthly Chart */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Yem Türü Dağılımı</CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            {feedLoading ? (
              <SkeletonChart />
            ) : feedDist && feedDist.length > 0 ? (
              <div className="flex items-center gap-2">
                <ResponsiveContainer width="60%" height={160}>
                  <PieChart>
                    <Pie
                      data={feedDist}
                      dataKey="tonnage"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={60}
                      label={false}
                    >
                      {feedDist.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number | undefined) => [`${v ?? 0} ton`, ""]}
                      contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1">
                  {feedDist.slice(0, 5).map((item) => (
                    <div key={item.name} className="flex items-center gap-1.5">
                      <div
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: item.fill }}
                      />
                      <span className="text-[10px] truncate">{item.name}</span>
                      <span className="text-[10px] font-medium ml-auto">{item.tonnage}t</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                Veri yok.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Aylık Alım / Satış</CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            {chartLoading ? (
              <SkeletonChart />
            ) : chartData && chartData.some((d) => d.purchases > 0 || d.sales > 0) ? (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 9 }} tickFormatter={formatCompact} />
                  <Tooltip
                    formatter={tooltipFormatter}
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="purchases" name="Alım" fill="#166534" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="sales" name="Satış" fill="#d97706" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                Grafik verisi yok.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══ Son İşlemler ═══ */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Son İşlemler</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0 p-0">
          {activitiesLoading ? (
            <div className="space-y-3 px-4 py-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                  <Skeleton className="h-4 w-16 shrink-0" />
                </div>
              ))}
            </div>
          ) : activities && activities.length > 0 ? (
            activities.map((act, i) => {
              const IconComp =
                act.icon === "truck" ? Truck : act.icon === "banknote" ? Banknote : FileText;
              const iconBg =
                act.type === "delivery"
                  ? "bg-green-100 text-green-600"
                  : act.type === "payment"
                    ? "bg-blue-100 text-blue-600"
                    : "bg-amber-100 text-amber-600";

              return (
                <div key={act.id}>
                  {i > 0 && <Separator />}
                  <Link
                    href={act.href}
                    className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50"
                  >
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${iconBg}`}>
                      <IconComp className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{act.description}</p>
                      <p className="text-xs text-muted-foreground">{formatDateShort(act.date)}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      {act.amount != null && (
                        <p className="text-sm font-bold">{masked(act.amount)}</p>
                      )}
                      {act.weight != null && (
                        <p className="text-sm font-bold">{formatWeight(act.weight)}</p>
                      )}
                    </div>
                  </Link>
                </div>
              );
            })
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Henüz işlem yok.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ═══ Sezon Özeti ═══ */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Trophy className="h-4 w-4" />
            Sezon Özeti
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 px-4 pb-4">
          {seasonLoading ? (
            <div className="space-y-3 px-4 py-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                  <Skeleton className="h-4 w-16 shrink-0" />
                </div>
              ))}
            </div>
          ) : season ? (
            <>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-muted/50 p-2">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Toplam Tonaj</p>
                  <p className="text-sm font-bold">{formatWeight(season.totalTonnage)}</p>
                </div>
                <div className="rounded-xl bg-muted/50 p-2">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Toplam Ciro</p>
                  <p className="text-xs sm:text-sm font-bold truncate">{maskedCompact(season.totalRevenue)}</p>
                </div>
                <div className="rounded-xl bg-muted/50 p-2">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Toplam Kâr</p>
                  <p className={`text-xs sm:text-sm font-bold truncate ${season.totalProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {maskedCompact(season.totalProfit)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {season.topCustomers.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">En Çok Satılan</p>
                    {season.topCustomers.map((c, i) => (
                      <div key={i} className="flex items-center justify-between py-0.5">
                        <p className="text-xs truncate">{i + 1}. {c.name}</p>
                        <p className="text-xs font-medium">{formatWeight(c.tonnage)}</p>
                      </div>
                    ))}
                  </div>
                )}
                {season.topSuppliers.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">En Çok Alınan</p>
                    {season.topSuppliers.map((c, i) => (
                      <div key={i} className="flex items-center justify-between py-0.5">
                        <p className="text-xs truncate">{i + 1}. {c.name}</p>
                        <p className="text-xs font-medium">{formatWeight(c.tonnage)}</p>
                      </div>
                    ))}
                  </div>
                )}
                {(season.topCarriers.length > 0 || season.topPlates.length > 0) && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">En Çok Nakliye</p>
                    {season.topPlates.map((p, i) => (
                      <div key={i} className="flex items-center justify-between py-0.5">
                        <p className="text-xs font-mono truncate">{i + 1}. {p.plate}</p>
                        <p className="text-xs font-medium">{p.count} sefer</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      {/* ═══ FAB — Simple Green Circle ═══ */}
      <div className="fixed bottom-20 right-4 z-50">
        <Link href="/sales">
          <Button
            size="icon"
            className="h-14 w-14 rounded-full bg-primary shadow-xl hover:bg-primary/90"
          >
            <Plus className="h-6 w-6" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
