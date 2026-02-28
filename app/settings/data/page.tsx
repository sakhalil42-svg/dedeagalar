"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Download,
  FileSpreadsheet,
  Trash2,
  RotateCcw,
  History,
  Loader2,
  AlertTriangle,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { useTrashedRecords, useRestoreRecord, usePermanentDelete } from "@/lib/hooks/use-trash";
import { useAuditLog } from "@/lib/hooks/use-audit-log";
import {
  exportAllToExcel,
  exportContactsCSV,
  exportDeliveriesCSV,
  exportChecksCSV,
  exportCarriersCSV,
  exportVehiclesCSV,
} from "@/lib/utils/export";
import { formatDateShort } from "@/lib/utils/format";

const ACTION_LABELS: Record<string, string> = {
  create: "Oluşturma",
  update: "Güncelleme",
  delete: "Silme",
  restore: "Geri Yükleme",
};

const TABLE_LABELS: Record<string, string> = {
  deliveries: "Sevkiyat",
  sales: "Satış",
  purchases: "Alım",
  checks: "Çek/Senet",
  payments: "Ödeme",
  account_transactions: "Hesap İşlemi",
  carrier_transactions: "Nakliyeci İşlemi",
  contacts: "Kişi",
};

const ACTION_COLORS: Record<string, string> = {
  create: "bg-green-100 text-green-700",
  update: "bg-blue-100 text-blue-700",
  delete: "bg-red-100 text-red-700",
  restore: "bg-purple-100 text-purple-700",
};

type Tab = "backup" | "trash" | "audit";

export default function DataSettingsPage() {
  const [tab, setTab] = useState<Tab>("backup");
  const [exporting, setExporting] = useState(false);
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<{ id: string; table_name: string; summary: string } | null>(null);
  const [auditFilter, setAuditFilter] = useState("");

  const { data: trashedRecords, isLoading: trashLoading } = useTrashedRecords();
  const restoreRecord = useRestoreRecord();
  const permanentDelete = usePermanentDelete();
  const { data: auditEntries, isLoading: auditLoading } = useAuditLog(50);

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const filename = await exportAllToExcel();
      toast.success(`${filename} indirildi`);
    } catch (err) {
      toast.error("Export hatası: " + (err instanceof Error ? err.message : "Bilinmeyen hata"));
    } finally {
      setExporting(false);
    }
  };

  const handleCSVExport = async (fn: () => Promise<void>, label: string) => {
    try {
      await fn();
      toast.success(`${label} CSV indirildi`);
    } catch {
      toast.error("CSV export hatası");
    }
  };

  const handleRestore = async (id: string, table_name: string) => {
    try {
      await restoreRecord.mutateAsync({ id, table_name });
      toast.success("Kayıt geri yüklendi");
    } catch {
      toast.error("Geri yükleme hatası");
    }
  };

  const handlePermanentDelete = async () => {
    if (!permanentDeleteTarget) return;
    try {
      await permanentDelete.mutateAsync(permanentDeleteTarget);
      toast.success("Kalıcı olarak silindi");
      setPermanentDeleteTarget(null);
    } catch {
      toast.error("Silme hatası");
    }
  };

  const filteredAudit = auditEntries?.filter((e) => {
    if (!auditFilter) return true;
    const q = auditFilter.toLowerCase();
    return (
      TABLE_LABELS[e.table_name]?.toLowerCase().includes(q) ||
      ACTION_LABELS[e.action]?.toLowerCase().includes(q) ||
      e.user_email?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-4 page-enter">
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <Link
          href="/settings"
          className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold">Veri Yönetimi</h1>
          <p className="text-xs text-muted-foreground">Yedekleme, çöp kutusu ve işlem geçmişi</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-card p-1 shadow-sm mb-4">
        {([
          { key: "backup" as Tab, label: "Yedekleme", icon: Download },
          { key: "trash" as Tab, label: "Çöp Kutusu", icon: Trash2 },
          { key: "audit" as Tab, label: "İşlem Geçmişi", icon: History },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-xs font-semibold transition-colors ${
              tab === t.key
                ? "bg-primary text-white"
                : "text-muted-foreground"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* === BACKUP TAB === */}
      {tab === "backup" && (
        <div className="space-y-3">
          {/* Full Excel Export */}
          <div className="rounded-xl bg-card p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-green-100">
                <FileSpreadsheet className="h-4 w-4 text-green-600" />
              </div>
              <span className="text-sm font-semibold">Excel Export</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Tüm verileri tek Excel dosyasında dışa aktarın. 7 sayfa: Kişiler, Sevkiyatlar, Hesap İşlemleri, Çek/Senet, Nakliyeciler, Nakliyeci İşlemleri, Araçlar.
            </p>
            <button
              onClick={handleExportExcel}
              disabled={exporting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-3 text-sm font-semibold text-white hover:bg-green-700 transition-colors disabled:opacity-60"
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {exporting ? "Hazırlanıyor..." : "Excel'e Aktar (.xlsx)"}
            </button>
          </div>

          {/* Individual CSV Exports */}
          <div className="rounded-xl bg-card p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100">
                <FileText className="h-4 w-4 text-blue-600" />
              </div>
              <span className="text-sm font-semibold">CSV Export (Tablo Bazlı)</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Kişiler", fn: exportContactsCSV },
                { label: "Sevkiyatlar", fn: exportDeliveriesCSV },
                { label: "Çek/Senet", fn: exportChecksCSV },
                { label: "Nakliyeciler", fn: exportCarriersCSV },
                { label: "Araçlar", fn: exportVehiclesCSV },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={() => handleCSVExport(item.fn, item.label)}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-border py-2.5 text-xs font-semibold hover:bg-muted transition-colors"
                >
                  <Download className="h-3 w-3" />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* === TRASH TAB === */}
      {tab === "trash" && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground mb-2">
            Son 30 gün içinde silinen kayıtlar. Geri yükleyebilir veya kalıcı olarak silebilirsiniz.
          </p>

          {trashLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : trashedRecords && trashedRecords.length > 0 ? (
            trashedRecords.map((r) => (
              <div key={`${r.table_name}-${r.id}`} className="flex items-center gap-3 rounded-xl bg-card p-3 shadow-sm">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-100">
                  <Trash2 className="h-4 w-4 text-red-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{r.summary}</p>
                  <p className="text-[10px] text-muted-foreground">
                    Silindi: {formatDateShort(r.deleted_at)}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => handleRestore(r.id, r.table_name)}
                    disabled={restoreRecord.isPending}
                    className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[10px] font-semibold hover:bg-muted transition-colors"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Geri
                  </button>
                  <button
                    onClick={() => setPermanentDeleteTarget({ id: r.id, table_name: r.table_name, summary: r.summary })}
                    className="flex items-center justify-center rounded-lg bg-red-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-red-700 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Çöp kutusu boş.
            </div>
          )}
        </div>
      )}

      {/* === AUDIT TAB === */}
      {tab === "audit" && (
        <div className="space-y-3">
          <div className="relative">
            <History className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Filtrele..."
              value={auditFilter}
              onChange={(e) => setAuditFilter(e.target.value)}
              className="pl-9 rounded-xl bg-muted border-0 h-11 text-sm"
            />
          </div>

          {auditLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredAudit && filteredAudit.length > 0 ? (
            <div className="space-y-1">
              {filteredAudit.map((e) => (
                <div key={e.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-muted/50 transition-colors">
                  <span className={`shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-semibold ${ACTION_COLORS[e.action] || ""}`}>
                    {ACTION_LABELS[e.action] || e.action}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium">
                      {TABLE_LABELS[e.table_name] || e.table_name}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatDateShort(e.created_at)}
                      {e.user_email && ` · ${e.user_email}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {auditFilter ? "Filtreye uygun işlem yok." : "Henüz işlem geçmişi yok."}
            </div>
          )}
        </div>
      )}

      {/* Permanent Delete Confirmation */}
      <Dialog open={!!permanentDeleteTarget} onOpenChange={(open) => !open && setPermanentDeleteTarget(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Kalıcı Silme
            </DialogTitle>
            <DialogDescription>
              Bu işlem geri alınamaz. Kayıt veritabanından tamamen silinecektir.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl bg-red-50 p-3 text-sm">
            {permanentDeleteTarget?.summary}
          </div>
          <DialogFooter className="gap-2">
            <button
              onClick={() => setPermanentDeleteTarget(null)}
              className="flex-1 rounded-xl border border-border py-3 text-sm font-semibold hover:bg-muted transition-colors"
            >
              İptal
            </button>
            <button
              onClick={handlePermanentDelete}
              disabled={permanentDelete.isPending}
              className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-semibold text-white hover:bg-red-700 transition-colors disabled:opacity-60"
            >
              {permanentDelete.isPending ? "Siliniyor..." : "Kalıcı Sil"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
