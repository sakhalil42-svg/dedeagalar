"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useChecks, useUpdateCheck } from "@/lib/hooks/use-checks";
import type { CheckStatus, CheckType, CheckDirection } from "@/lib/types/database.types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Loader2 } from "lucide-react";
import { formatCurrency, formatDateShort } from "@/lib/utils/format";
import { useBalanceVisibility } from "@/lib/contexts/balance-visibility";
import { toast } from "sonner";

const STATUS_LABELS: Record<CheckStatus, string> = {
  pending: "Bekliyor",
  deposited: "Bankada",
  cleared: "Tahsil Edildi",
  bounced: "Karşılıksız",
  endorsed: "Ciro Edildi",
  cancelled: "İptal",
};

const STATUS_COLORS: Record<CheckStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  deposited: "bg-blue-100 text-blue-800",
  cleared: "bg-green-100 text-green-800",
  bounced: "bg-red-100 text-red-800",
  endorsed: "bg-purple-100 text-purple-800",
  cancelled: "bg-gray-100 text-gray-800",
};

const TYPE_LABELS: Record<CheckType, string> = {
  check: "Çek",
  promissory_note: "Senet",
};

const DIRECTION_LABELS: Record<CheckDirection, string> = {
  received: "Alınan",
  given: "Verilen",
};

// Valid status transitions
const STATUS_TRANSITIONS: Record<CheckStatus, CheckStatus[]> = {
  pending: ["deposited", "endorsed", "cancelled"],
  deposited: ["cleared", "bounced", "cancelled"],
  cleared: [],
  bounced: ["pending"], // can re-try
  endorsed: ["cancelled"],
  cancelled: [],
};

type StatusFilter = CheckStatus | "all";
type DirectionTab = "received" | "given" | "all";

const STATUS_FILTER_OPTIONS: { label: string; value: StatusFilter }[] = [
  { label: "Tümü", value: "all" },
  { label: "Bekleyen", value: "pending" },
  { label: "Bankada", value: "deposited" },
  { label: "Tahsil", value: "cleared" },
  { label: "Karşılıksız", value: "bounced" },
  { label: "Ciro", value: "endorsed" },
];

function getDueClass(dueDateStr: string, status: CheckStatus): string {
  if (status !== "pending" && status !== "deposited") return "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDateStr);
  due.setHours(0, 0, 0, 0);
  const diff = (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  if (diff < 0) return "border-l-4 border-l-red-500";
  if (diff === 0) return "border-l-4 border-l-orange-500";
  if (diff <= 7) return "border-l-4 border-l-yellow-500";
  return "";
}

function getDaysText(dueDateStr: string): string | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDateStr);
  due.setHours(0, 0, 0, 0);
  const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return `${Math.abs(diff)} gün geçmiş`;
  if (diff === 0) return "Bugün";
  if (diff <= 7) return `${diff} gün kaldı`;
  return null;
}

export default function ChecksPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [directionTab, setDirectionTab] = useState<DirectionTab>("all");
  const [statusChangeTarget, setStatusChangeTarget] = useState<{
    id: string;
    name: string;
    currentStatus: CheckStatus;
  } | null>(null);
  const [newStatus, setNewStatus] = useState<CheckStatus>("deposited");
  const [endorsedTo, setEndorsedTo] = useState("");

  const { data: checks, isLoading } = useChecks();
  const updateCheck = useUpdateCheck();
  const { isVisible } = useBalanceVisibility();
  const masked = (amount: number) => isVisible ? formatCurrency(amount) : "••••••";

  const filtered = useMemo(() => {
    if (!checks) return [];
    return checks.filter((c) => {
      const matchesSearch =
        !search ||
        c.contact?.name?.toLowerCase().includes(search.toLowerCase()) ||
        c.check_no?.toLowerCase().includes(search.toLowerCase()) ||
        c.bank_name?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus =
        statusFilter === "all" || c.status === statusFilter;
      const matchesDirection =
        directionTab === "all" || c.direction === directionTab;
      return matchesSearch && matchesStatus && matchesDirection;
    });
  }, [checks, search, statusFilter, directionTab]);

  // Summary totals
  const summary = useMemo(() => {
    const pending = filtered.filter((c) => c.status === "pending" || c.status === "deposited");
    const total = pending.reduce((sum, c) => sum + (c.amount || 0), 0);
    return { count: pending.length, total };
  }, [filtered]);

  function openStatusChange(check: { id: string; status: CheckStatus; check_type: CheckType; contact?: { name: string } | null }) {
    const transitions = STATUS_TRANSITIONS[check.status];
    if (transitions.length === 0) return;
    setStatusChangeTarget({
      id: check.id,
      name: `${TYPE_LABELS[check.check_type]} - ${check.contact?.name || ""}`,
      currentStatus: check.status,
    });
    setNewStatus(transitions[0]);
    setEndorsedTo("");
  }

  async function handleStatusChange() {
    if (!statusChangeTarget) return;
    try {
      const updateData: { status: CheckStatus; endorsed_to?: string; notes?: string } = {
        status: newStatus,
      };
      if (newStatus === "endorsed" && endorsedTo.trim()) {
        updateData.endorsed_to = endorsedTo.trim();
      }
      await updateCheck.mutateAsync({ id: statusChangeTarget.id, ...updateData });
      toast.success(`Durum güncellendi: ${STATUS_LABELS[newStatus]}`);
      setStatusChangeTarget(null);
    } catch {
      toast.error("Durum güncellenirken hata oluştu");
    }
  }

  const availableTransitions = statusChangeTarget
    ? STATUS_TRANSITIONS[statusChangeTarget.currentStatus]
    : [];

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Çek / Senet</h1>
          <p className="text-sm text-muted-foreground">Çek ve senet takibi</p>
        </div>
        <Button asChild size="sm">
          <Link href="/finance/checks/new">
            <Plus className="mr-1 h-4 w-4" />
            Yeni
          </Link>
        </Button>
      </div>

      {/* Direction Tabs: Tümü / Alınan / Verilen */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {([
          { key: "all" as DirectionTab, label: "Tümü" },
          { key: "received" as DirectionTab, label: "Alınan" },
          { key: "given" as DirectionTab, label: "Verilen" },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setDirectionTab(t.key)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              directionTab === t.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Summary */}
      {!isLoading && summary.count > 0 && (
        <Card>
          <CardContent className="grid grid-cols-2 gap-2 p-3 text-center text-xs">
            <div>
              <p className="text-muted-foreground">Bekleyen Adet</p>
              <p className="text-lg font-bold">{summary.count}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Bekleyen Toplam</p>
              <p className="text-lg font-bold text-amber-600">{masked(summary.total)}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Kişi, çek no veya banka ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Status Filters */}
      <div className="flex gap-2 overflow-x-auto">
        {STATUS_FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={`whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              statusFilter === opt.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length > 0 ? (
        <div className="space-y-2">
          {filtered.map((c) => {
            const daysText = getDaysText(c.due_date);
            const canChange = STATUS_TRANSITIONS[c.status].length > 0;
            return (
              <Card
                key={c.id}
                className={getDueClass(c.due_date, c.status)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="secondary" className="text-xs">
                          {TYPE_LABELS[c.check_type]}
                        </Badge>
                        <Badge
                          variant="secondary"
                          className={`text-xs ${STATUS_COLORS[c.status]}`}
                        >
                          {STATUS_LABELS[c.status]}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {DIRECTION_LABELS[c.direction]}
                        </Badge>
                      </div>
                      <p className="font-medium">{c.contact?.name || "—"}</p>
                      <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                        {c.check_no && <span>No: {c.check_no}</span>}
                        {c.bank_name && <span>{c.bank_name}</span>}
                        <span>Vade: {formatDateShort(c.due_date)}</span>
                        {daysText && (
                          <span className={
                            daysText.includes("geçmiş") ? "font-medium text-red-600" :
                            daysText === "Bugün" ? "font-medium text-orange-600" :
                            "font-medium text-yellow-600"
                          }>
                            {daysText}
                          </span>
                        )}
                      </div>
                      {c.endorsed_to && (
                        <p className="text-xs text-purple-600">
                          Ciro: {c.endorsed_to}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">{masked(c.amount)}</p>
                      {canChange && (
                        <button
                          className="mt-1 text-xs text-primary hover:underline"
                          onClick={() => openStatusChange(c)}
                        >
                          Durum Değiştir
                        </button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="py-12 text-center text-sm text-muted-foreground">
          {search || statusFilter !== "all" || directionTab !== "all"
            ? "Sonuç bulunamadı."
            : "Henüz çek/senet kaydı yok."}
        </div>
      )}

      {/* Status change dialog */}
      <Dialog
        open={!!statusChangeTarget}
        onOpenChange={(open) => !open && setStatusChangeTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Durum Değiştir</DialogTitle>
            <DialogDescription>{statusChangeTarget?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Mevcut Durum</label>
              <p className="text-sm text-muted-foreground">
                {statusChangeTarget ? STATUS_LABELS[statusChangeTarget.currentStatus] : ""}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">Yeni Durum</label>
              <Select
                value={newStatus}
                onValueChange={(val) => setNewStatus(val as CheckStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableTransitions.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {newStatus === "endorsed" && (
              <div>
                <label className="text-sm font-medium">Kime Ciro Edildi?</label>
                <Textarea
                  placeholder="Ciro edilen kişi/firma adı..."
                  value={endorsedTo}
                  onChange={(e) => setEndorsedTo(e.target.value)}
                  className="mt-1"
                  rows={2}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusChangeTarget(null)}>
              İptal
            </Button>
            <Button onClick={handleStatusChange} disabled={updateCheck.isPending}>
              {updateCheck.isPending ? "Güncelleniyor..." : "Güncelle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
