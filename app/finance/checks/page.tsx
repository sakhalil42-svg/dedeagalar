"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useChecks, useUpdateCheck } from "@/lib/hooks/use-checks";
import type { CheckStatus, CheckType } from "@/lib/types/database.types";
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
import { Plus, Search, Loader2 } from "lucide-react";
import { formatCurrency, formatDateShort } from "@/lib/utils/format";
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

const FILTER_OPTIONS: { label: string; value: CheckStatus | "all" | "overdue" }[] = [
  { label: "Tümü", value: "all" },
  { label: "Bekleyen", value: "pending" },
  { label: "Bankada", value: "deposited" },
  { label: "Tahsil", value: "cleared" },
  { label: "Karşılıksız", value: "bounced" },
];

function getDueClass(dueDateStr: string, status: CheckStatus): string {
  if (status !== "pending" && status !== "deposited") return "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDateStr);
  due.setHours(0, 0, 0, 0);
  const diff = (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  if (diff < 0) return "border-l-4 border-l-red-500";
  if (diff <= 7) return "border-l-4 border-l-yellow-500";
  return "";
}

export default function ChecksPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<CheckStatus | "all" | "overdue">("all");
  const [statusChangeTarget, setStatusChangeTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [newStatus, setNewStatus] = useState<CheckStatus>("deposited");

  const { data: checks, isLoading } = useChecks();
  const updateCheck = useUpdateCheck();

  const filtered = useMemo(() => {
    if (!checks) return [];
    return checks.filter((c) => {
      const matchesSearch =
        !search ||
        c.contact?.name?.toLowerCase().includes(search.toLowerCase()) ||
        c.check_no?.toLowerCase().includes(search.toLowerCase()) ||
        c.bank_name?.toLowerCase().includes(search.toLowerCase());
      const matchesFilter =
        filter === "all" || c.status === filter;
      return matchesSearch && matchesFilter;
    });
  }, [checks, search, filter]);

  async function handleStatusChange() {
    if (!statusChangeTarget) return;
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

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Kişi, çek no veya banka ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={`whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              filter === opt.value
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
          {filtered.map((c) => (
            <Card
              key={c.id}
              className={getDueClass(c.due_date, c.status)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {TYPE_LABELS[c.check_type]}
                      </Badge>
                      <Badge
                        variant="secondary"
                        className={`text-xs ${STATUS_COLORS[c.status]}`}
                      >
                        {STATUS_LABELS[c.status]}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {c.direction === "inbound" ? "Alınan" : "Verilen"}
                      </Badge>
                    </div>
                    <p className="font-medium">{c.contact?.name || "—"}</p>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {c.check_no && <span>No: {c.check_no}</span>}
                      {c.bank_name && <span>{c.bank_name}</span>}
                      <span>Vade: {formatDateShort(c.due_date)}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{formatCurrency(c.amount)}</p>
                    {(c.status === "pending" || c.status === "deposited") && (
                      <button
                        className="mt-1 text-xs text-primary hover:underline"
                        onClick={() =>
                          setStatusChangeTarget({
                            id: c.id,
                            name: `${TYPE_LABELS[c.check_type]} - ${c.contact?.name || ""}`,
                          })
                        }
                      >
                        Durum Değiştir
                      </button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="py-12 text-center text-sm text-muted-foreground">
          {search || filter !== "all"
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
          <div className="space-y-2">
            <Label>Yeni Durum</Label>
            <Select
              value={newStatus}
              onValueChange={(val) => setNewStatus(val as CheckStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Bekliyor</SelectItem>
                <SelectItem value="deposited">Bankaya Verildi</SelectItem>
                <SelectItem value="cleared">Tahsil Edildi</SelectItem>
                <SelectItem value="bounced">Karşılıksız</SelectItem>
                <SelectItem value="endorsed">Ciro Edildi</SelectItem>
                <SelectItem value="cancelled">İptal</SelectItem>
              </SelectContent>
            </Select>
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

// Imported by the status change dialog
function Label({ children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement> & { children: React.ReactNode }) {
  return (
    <label className="text-sm font-medium" {...props}>
      {children}
    </label>
  );
}
