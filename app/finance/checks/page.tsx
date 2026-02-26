"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useChecks, useUpdateCheck, useEndorseCheck } from "@/lib/hooks/use-checks";
import { useContacts } from "@/lib/hooks/use-contacts";
import type { Check, CheckStatus, CheckType, CheckDirection } from "@/lib/types/database.types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import { Plus, Search, MessageCircle, SlidersHorizontal, CreditCard } from "lucide-react";
import { SkeletonCard } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, formatDateShort } from "@/lib/utils/format";
import { useBalanceVisibility } from "@/lib/contexts/balance-visibility";
import { BalanceToggle } from "@/components/layout/balance-toggle";
import { FilterChips, type FilterChip } from "@/components/layout/filter-chips";
import { toast } from "sonner";
import { openWhatsAppMessage, buildCekVadeMessage } from "@/lib/utils/whatsapp";

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

const STATUS_TRANSITIONS: Record<CheckStatus, CheckStatus[]> = {
  pending: ["deposited", "endorsed", "cancelled"],
  deposited: ["cleared", "bounced", "cancelled"],
  cleared: [],
  bounced: ["pending"],
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
  const [contactFilter, setContactFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Status change dialog state
  const [statusChangeTarget, setStatusChangeTarget] = useState<{
    id: string;
    name: string;
    currentStatus: CheckStatus;
  } | null>(null);
  const [newStatus, setNewStatus] = useState<CheckStatus>("deposited");

  // Endorse dialog state
  const [endorseTarget, setEndorseTarget] = useState<Check | null>(null);
  const [endorseContactId, setEndorseContactId] = useState("");
  const [endorseDate, setEndorseDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const { data: checks, isLoading } = useChecks();
  const { data: contacts } = useContacts();
  const updateCheck = useUpdateCheck();
  const endorseCheck = useEndorseCheck();
  const { isVisible } = useBalanceVisibility();
  const masked = (amount: number) =>
    isVisible ? formatCurrency(amount) : "••••••";

  const filtered = useMemo(() => {
    if (!checks) return [];
    return checks.filter((c) => {
      const matchesSearch =
        !search ||
        c.contact?.name?.toLowerCase().includes(search.toLowerCase()) ||
        c.serial_no?.toLowerCase().includes(search.toLowerCase()) ||
        c.bank_name?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus =
        statusFilter === "all" || c.status === statusFilter;
      const matchesDirection =
        directionTab === "all" || c.direction === directionTab;
      const matchesContact = !contactFilter || c.contact_id === contactFilter;
      const matchesMin = !minAmount || c.amount >= parseFloat(minAmount);
      const matchesMax = !maxAmount || c.amount <= parseFloat(maxAmount);

      // Date range filter (on due_date)
      let matchesDate = true;
      if (startDate) {
        const s = new Date(startDate);
        s.setHours(0, 0, 0, 0);
        const d = new Date(c.due_date);
        d.setHours(0, 0, 0, 0);
        if (d < s) matchesDate = false;
      }
      if (endDate) {
        const e = new Date(endDate);
        e.setHours(23, 59, 59, 999);
        const d = new Date(c.due_date);
        d.setHours(0, 0, 0, 0);
        if (d > e) matchesDate = false;
      }

      return matchesSearch && matchesStatus && matchesDirection && matchesContact && matchesMin && matchesMax && matchesDate;
    });
  }, [checks, search, statusFilter, directionTab, contactFilter, minAmount, maxAmount, startDate, endDate]);

  const summary = useMemo(() => {
    const pending = filtered.filter(
      (c) => c.status === "pending" || c.status === "deposited"
    );
    const total = pending.reduce((sum, c) => sum + (c.amount || 0), 0);
    return { count: pending.length, total };
  }, [filtered]);

  // Filter chips
  const chips: FilterChip[] = [];
  if (directionTab !== "all") chips.push({ key: "direction", label: "Yön", value: DIRECTION_LABELS[directionTab] });
  if (statusFilter !== "all") chips.push({ key: "status", label: "Durum", value: STATUS_LABELS[statusFilter] });
  if (contactFilter) {
    const cName = contacts?.find((c) => c.id === contactFilter)?.name || "";
    chips.push({ key: "contact", label: "Kişi", value: cName });
  }
  if (startDate || endDate) {
    chips.push({ key: "date", label: "Vade", value: `${startDate || "..."} - ${endDate || "..."}` });
  }
  if (minAmount || maxAmount) {
    chips.push({ key: "amount", label: "Tutar", value: `${minAmount || "0"} - ${maxAmount || "..."}` });
  }

  const handleRemoveChip = (key: string) => {
    if (key === "direction") setDirectionTab("all");
    if (key === "status") setStatusFilter("all");
    if (key === "contact") setContactFilter("");
    if (key === "date") { setStartDate(""); setEndDate(""); }
    if (key === "amount") { setMinAmount(""); setMaxAmount(""); }
  };

  const handleClearAll = () => {
    setDirectionTab("all");
    setStatusFilter("all");
    setContactFilter("");
    setStartDate("");
    setEndDate("");
    setMinAmount("");
    setMaxAmount("");
  };

  function openStatusChange(check: Check) {
    const transitions = STATUS_TRANSITIONS[check.status];
    if (transitions.length === 0) return;
    setStatusChangeTarget({
      id: check.id,
      name: `${TYPE_LABELS[check.type]} - ${check.contact?.name || ""}`,
      currentStatus: check.status,
    });
    const defaultStatus = transitions.find((s) => s !== "endorsed") || transitions[0];
    setNewStatus(defaultStatus);
  }

  async function handleStatusChange() {
    if (!statusChangeTarget) return;
    if (newStatus === "endorsed") {
      const check = checks?.find((c) => c.id === statusChangeTarget.id);
      if (check) {
        setStatusChangeTarget(null);
        openEndorseDialog(check);
        return;
      }
    }
    try {
      await updateCheck.mutateAsync({
        id: statusChangeTarget.id,
        status: newStatus,
      });
      toast.success(`Durum güncellendi: ${STATUS_LABELS[newStatus]}`);
      setStatusChangeTarget(null);
    } catch {
      toast.error("Durum güncellenirken hata oluştu");
    }
  }

  function openEndorseDialog(check: Check) {
    setEndorseTarget(check);
    setEndorseContactId("");
    setEndorseDate(new Date().toISOString().split("T")[0]);
  }

  async function handleEndorse() {
    if (!endorseTarget || !endorseContactId) {
      toast.error("Ciro edilecek kişiyi seçiniz");
      return;
    }
    const targetContact = contacts?.find((c) => c.id === endorseContactId);
    if (!targetContact) {
      toast.error("Kişi bulunamadı");
      return;
    }
    try {
      await endorseCheck.mutateAsync({
        checkId: endorseTarget.id,
        targetContactId: endorseContactId,
        targetContactName: targetContact.name,
        endorseDate,
      });
      toast.success(
        `${TYPE_LABELS[endorseTarget.type]} ${targetContact.name}'a ciro edildi`
      );
      setEndorseTarget(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ciro işlemi başarısız";
      toast.error(message);
    }
  }

  const availableTransitions = statusChangeTarget
    ? STATUS_TRANSITIONS[statusChangeTarget.currentStatus]
    : [];

  return (
    <div className="space-y-4 p-4 page-enter">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Çek / Senet</h1>
          <p className="text-sm text-muted-foreground">Çek ve senet takibi</p>
        </div>
        <div className="flex items-center gap-2">
          <BalanceToggle />
          <Button asChild size="sm">
            <Link href="/finance/checks/new">
              <Plus className="mr-1 h-4 w-4" />
              Yeni
            </Link>
          </Button>
        </div>
      </div>

      {/* Direction Tabs */}
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
              <p className="text-lg font-bold text-amber-600">
                {masked(summary.total)}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search + filter toggle */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Kişi, çek no veya banka ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md transition-colors ${
            showFilters ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <SlidersHorizontal className="h-4 w-4" />
        </button>
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

      {/* Extended filters panel */}
      {showFilters && (
        <div className="space-y-3 rounded-lg border p-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Kişi</p>
            <Select value={contactFilter || "all"} onValueChange={(v) => setContactFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Tüm kişiler" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm kişiler</SelectItem>
                {(contacts || []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Vade Tarihi Aralığı</p>
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-8 text-sm" />
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-8 text-sm" />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Tutar Aralığı</p>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                inputMode="decimal"
                placeholder="Min"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                className="h-8 text-sm"
              />
              <Input
                type="number"
                inputMode="decimal"
                placeholder="Max"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
        </div>
      )}

      {/* Filter chips */}
      <FilterChips chips={chips} onRemove={handleRemoveChip} onClearAll={handleClearAll} />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="space-y-2">
          {filtered.map((c) => {
            const daysText = getDaysText(c.due_date);
            const canChange = STATUS_TRANSITIONS[c.status].length > 0;
            return (
              <Card key={c.id} className={getDueClass(c.due_date, c.status)}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="secondary" className="text-xs">
                          {TYPE_LABELS[c.type]}
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
                        {c.serial_no && <span>No: {c.serial_no}</span>}
                        {c.bank_name && <span>{c.bank_name}</span>}
                        <span>Vade: {formatDateShort(c.due_date)}</span>
                        {daysText && (
                          <span
                            className={
                              daysText.includes("geçmiş")
                                ? "font-medium text-red-600"
                                : daysText === "Bugün"
                                  ? "font-medium text-orange-600"
                                  : "font-medium text-yellow-600"
                            }
                          >
                            {daysText}
                          </span>
                        )}
                      </div>
                      {c.endorsed_to && (
                        <p className="text-xs text-purple-600">
                          Ciro: {c.endorsed_to}
                        </p>
                      )}
                      {c.notes && (
                        <p className="text-xs text-muted-foreground italic">
                          {c.notes}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">{masked(c.amount)}</p>
                      <div className="mt-1 flex items-center justify-end gap-2">
                        {c.contact?.phone && (c.status === "pending" || c.status === "deposited") && (
                          <button
                            className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-600 hover:bg-green-200 transition-colors"
                            onClick={() =>
                              openWhatsAppMessage(
                                c.contact?.phone,
                                buildCekVadeMessage({
                                  contactName: c.contact?.name || "",
                                  amount: c.amount,
                                  type: c.type,
                                  serialNo: c.serial_no || undefined,
                                  dueDate: c.due_date,
                                })
                              )
                            }
                            title="WhatsApp ile vade hatırlat"
                          >
                            <MessageCircle className="h-3 w-3" />
                          </button>
                        )}
                        {canChange && (
                          <button
                            className="text-xs text-primary hover:underline"
                            onClick={() => openStatusChange(c)}
                          >
                            Durum Değiştir
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        search || statusFilter !== "all" || directionTab !== "all" || contactFilter || startDate || endDate || minAmount || maxAmount ? (
          <EmptyState
            icon={Search}
            title="Sonuç bulunamadı"
            description="Arama kriterlerini değiştirmeyi deneyin."
          />
        ) : (
          <EmptyState
            icon={CreditCard}
            title="Henüz çek/senet kaydı yok"
            description="Çek veya senet kaydı ekleyin."
            actionLabel="Yeni Çek/Senet"
            actionHref="/finance/checks/new"
          />
        )
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
                {statusChangeTarget
                  ? STATUS_LABELS[statusChangeTarget.currentStatus]
                  : ""}
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
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setStatusChangeTarget(null)}
            >
              İptal
            </Button>
            <Button
              onClick={handleStatusChange}
              disabled={updateCheck.isPending}
            >
              {updateCheck.isPending ? "Güncelleniyor..." : "Güncelle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Endorse (Ciro) dialog */}
      <Dialog
        open={!!endorseTarget}
        onOpenChange={(open) => !open && setEndorseTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Çek / Senet Ciro Et</DialogTitle>
            <DialogDescription>
              {endorseTarget && (
                <>
                  {TYPE_LABELS[endorseTarget.type]} —{" "}
                  {endorseTarget.contact?.name || "—"} —{" "}
                  {formatCurrency(endorseTarget.amount)}
                  {endorseTarget.serial_no && ` (No: ${endorseTarget.serial_no})`}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">
                Bu çeki kime ciro ediyorsunuz? *
              </label>
              <Select
                value={endorseContactId}
                onValueChange={setEndorseContactId}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Kişi seçiniz" />
                </SelectTrigger>
                <SelectContent>
                  {contacts
                    ?.filter(
                      (c) =>
                        c.id !== endorseTarget?.contact_id
                    )
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                        <span className="ml-1 text-xs text-muted-foreground">
                          {c.type === "supplier"
                            ? "(Üretici)"
                            : c.type === "customer"
                              ? "(Müşteri)"
                              : "(Ürt/Müş)"}
                        </span>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Ciro Tarihi</label>
              <Input
                type="date"
                value={endorseDate}
                onChange={(e) => setEndorseDate(e.target.value)}
                className="mt-1"
              />
            </div>
            {endorseTarget && (
              <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
                <p>Ciro işlemi şunları yapacak:</p>
                <p>
                  1. Bu {TYPE_LABELS[endorseTarget.type].toLowerCase()} &quot;Ciro
                  Edildi&quot; olarak işaretlenecek
                </p>
                <p>
                  2. Seçilen kişiye yeni bir &quot;Verilen{" "}
                  {TYPE_LABELS[endorseTarget.type].toLowerCase()}&quot; kaydı
                  oluşturulacak
                </p>
                <p>
                  3. Seçilen kişinin borcu{" "}
                  {formatCurrency(endorseTarget.amount)} azalacak
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEndorseTarget(null)}>
              İptal
            </Button>
            <Button
              onClick={handleEndorse}
              disabled={endorseCheck.isPending || !endorseContactId}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {endorseCheck.isPending ? "İşleniyor..." : "Ciro Et"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
