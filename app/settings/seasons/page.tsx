"use client";

import { useState } from "react";
import Link from "next/link";
import { useSeasons, useCloseSeason, useStartNewSeason } from "@/lib/hooks/use-seasons";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Calendar,
  Plus,
  Lock,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { formatDateShort } from "@/lib/utils/format";
import { toast } from "sonner";

export default function SeasonsPage() {
  const { data: seasons, isLoading } = useSeasons();
  const closeSeason = useCloseSeason();
  const startNewSeason = useStartNewSeason();

  const [newName, setNewName] = useState("");
  const [newStartDate, setNewStartDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [creating, setCreating] = useState(false);

  const activeSeason = seasons?.find((s) => s.is_active);
  const closedSeasons = seasons?.filter((s) => !s.is_active) || [];

  const handleStartNewSeason = async () => {
    if (!newName.trim()) {
      toast.error("Sezon adı giriniz");
      return;
    }
    setCreating(true);
    try {
      await startNewSeason.mutateAsync({
        name: newName.trim(),
        start_date: newStartDate,
      });
      toast.success(`"${newName.trim()}" sezonu başlatıldı`);
      setNewName("");
    } catch {
      toast.error("Sezon oluşturulurken hata");
    } finally {
      setCreating(false);
    }
  };

  const handleCloseSeason = async (id: string) => {
    try {
      await closeSeason.mutateAsync(id);
      toast.success("Sezon kapatıldı");
    } catch {
      toast.error("Sezon kapatılırken hata");
    }
  };

  return (
    <div className="p-4 page-enter">
      <div className="flex items-center gap-2 mb-5">
        <Link
          href="/settings"
          className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold">Sezon Yönetimi</h1>
          <p className="text-xs text-muted-foreground">
            Sezon oluşturma, kapatma ve raporlama
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Aktif Sezon */}
          {activeSeason ? (
            <div className="rounded-2xl border-2 border-green-200 bg-green-50/30 p-4 shadow-sm mb-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-green-100">
                  <Calendar className="h-4 w-4 text-green-600" />
                </div>
                <span className="text-xs font-semibold text-green-700">Aktif Sezon</span>
              </div>
              <p className="text-lg font-bold">{activeSeason.name}</p>
              <p className="text-xs text-muted-foreground mb-3">
                Başlangıç: {formatDateShort(activeSeason.start_date)}
                {activeSeason.notes && ` — ${activeSeason.notes}`}
              </p>
              <div className="flex gap-2">
                <Link
                  href={`/settings/seasons/${activeSeason.id}`}
                  className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:bg-muted transition-colors"
                >
                  Sezon Raporu
                </Link>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button className="flex items-center gap-1.5 rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 transition-colors">
                      <Lock className="h-3 w-3" />
                      Sezonu Kapat
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Sezonu Kapat</AlertDialogTitle>
                      <AlertDialogDescription>
                        &quot;{activeSeason.name}&quot; sezonu kapatılacak. Bu
                        işlem geri alınabilir ancak sezon kapandıktan sonra yeni
                        kayıtlar bu sezonu kullanmaz.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="rounded-xl">İptal</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleCloseSeason(activeSeason.id)}
                        className="rounded-xl"
                      >
                        Kapat
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/30 p-6 shadow-sm text-center mb-4">
              <Calendar className="mx-auto mb-2 h-8 w-8 text-amber-500" />
              <p className="font-semibold">Aktif sezon yok</p>
              <p className="text-xs text-muted-foreground">
                Aşağıdan yeni bir sezon başlatın
              </p>
            </div>
          )}

          {/* Yeni Sezon Başlat */}
          <div className="rounded-xl bg-card p-4 shadow-sm mb-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
                <Plus className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm font-semibold">Yeni Sezon Başlat</span>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Sezon Adı</label>
                <Input
                  placeholder="örn: 2026 İlkbahar"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="rounded-xl bg-muted border-0 h-11"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Başlangıç Tarihi</label>
                <Input
                  type="date"
                  value={newStartDate}
                  onChange={(e) => setNewStartDate(e.target.value)}
                  className="rounded-xl bg-muted border-0 h-11"
                />
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    disabled={!newName.trim() || creating}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-60"
                  >
                    {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                    Yeni Sezon Başlat
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-2xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Yeni Sezon Başlat</AlertDialogTitle>
                    <AlertDialogDescription>
                      {activeSeason
                        ? `"${activeSeason.name}" sezonu kapatılıp "${newName.trim()}" sezonu başlatılacak.`
                        : `"${newName.trim()}" sezonu başlatılacak.`}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-xl">İptal</AlertDialogCancel>
                    <AlertDialogAction onClick={handleStartNewSeason} className="rounded-xl">
                      Başlat
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          {/* Eski Sezonlar */}
          {closedSeasons.length > 0 && (
            <div className="rounded-xl bg-card shadow-sm overflow-hidden">
              <div className="p-3 bg-muted/50">
                <span className="text-sm font-semibold">Geçmiş Sezonlar</span>
              </div>
              {closedSeasons.map((s, i) => (
                <Link
                  key={s.id}
                  href={`/settings/seasons/${s.id}`}
                  className={`flex items-center justify-between px-4 py-3 transition-colors hover:bg-muted/50 ${
                    i > 0 ? "border-t border-border/50" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{s.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateShort(s.start_date)}
                      {s.end_date ? ` — ${formatDateShort(s.end_date)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      Kapalı
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
