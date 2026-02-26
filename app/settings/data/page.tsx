"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
import { useAuditLog, type AuditEntry } from "@/lib/hooks/use-audit-log";
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
  create: "bg-green-100 text-green-800",
  update: "bg-blue-100 text-blue-800",
  delete: "bg-red-100 text-red-800",
  restore: "bg-purple-100 text-purple-800",
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
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/settings">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold">Veri Yönetimi</h1>
          <p className="text-sm text-muted-foreground">Yedekleme, çöp kutusu ve işlem geçmişi</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {([
          { key: "backup" as Tab, label: "Yedekleme", icon: Download },
          { key: "trash" as Tab, label: "Çöp Kutusu", icon: Trash2 },
          { key: "audit" as Tab, label: "İşlem Geçmişi", icon: History },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition-colors ${
              tab === t.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* === BACKUP TAB === */}
      {tab === "backup" && (
        <div className="space-y-4">
          {/* Full Excel Export */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileSpreadsheet className="h-4 w-4" />
                Excel Export
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Tüm verileri tek Excel dosyasında dışa aktarın. 7 sayfa: Kişiler, Sevkiyatlar, Hesap İşlemleri, Çek/Senet, Nakliyeciler, Nakliyeci İşlemleri, Araçlar.
              </p>
              <Button onClick={handleExportExcel} disabled={exporting} className="w-full">
                {exporting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                {exporting ? "Hazırlanıyor..." : "Excel'e Aktar (.xlsx)"}
              </Button>
            </CardContent>
          </Card>

          {/* Individual CSV Exports */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" />
                CSV Export (Tablo Bazlı)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Kişiler", fn: exportContactsCSV },
                  { label: "Sevkiyatlar", fn: exportDeliveriesCSV },
                  { label: "Çek/Senet", fn: exportChecksCSV },
                  { label: "Nakliyeciler", fn: exportCarriersCSV },
                  { label: "Araçlar", fn: exportVehiclesCSV },
                ].map((item) => (
                  <Button
                    key={item.label}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => handleCSVExport(item.fn, item.label)}
                  >
                    <Download className="mr-1 h-3 w-3" />
                    {item.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* === TRASH TAB === */}
      {tab === "trash" && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Son 30 gün içinde silinen kayıtlar. Geri yükleyebilir veya kalıcı olarak silebilirsiniz.
          </p>

          {trashLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : trashedRecords && trashedRecords.length > 0 ? (
            trashedRecords.map((r) => (
              <Card key={`${r.table_name}-${r.id}`}>
                <CardContent className="flex items-center gap-3 p-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{r.summary}</p>
                    <p className="text-xs text-muted-foreground">
                      Silindi: {formatDateShort(r.deleted_at)}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => handleRestore(r.id, r.table_name)}
                      disabled={restoreRecord.isPending}
                    >
                      <RotateCcw className="mr-1 h-3 w-3" />
                      Geri Yükle
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 text-xs"
                      onClick={() => setPermanentDeleteTarget({ id: r.id, table_name: r.table_name, summary: r.summary })}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
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
              className="pl-9 h-9 text-sm"
            />
          </div>

          {auditLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredAudit && filteredAudit.length > 0 ? (
            <div className="space-y-1">
              {filteredAudit.map((e) => (
                <div key={e.id} className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-muted/50">
                  <Badge variant="secondary" className={`text-[10px] shrink-0 ${ACTION_COLORS[e.action] || ""}`}>
                    {ACTION_LABELS[e.action] || e.action}
                  </Badge>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Kalıcı Silme
            </DialogTitle>
            <DialogDescription>
              Bu işlem geri alınamaz. Kayıt veritabanından tamamen silinecektir.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md bg-red-50 p-3 text-sm">
            {permanentDeleteTarget?.summary}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPermanentDeleteTarget(null)}>
              İptal
            </Button>
            <Button
              variant="destructive"
              onClick={handlePermanentDelete}
              disabled={permanentDelete.isPending}
            >
              {permanentDelete.isPending ? "Siliniyor..." : "Kalıcı Sil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
