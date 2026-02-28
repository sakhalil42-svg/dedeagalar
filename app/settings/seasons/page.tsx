"use client";

import { useState } from "react";
import Link from "next/link";
import { useSeasons, useCloseSeason, useStartNewSeason } from "@/lib/hooks/use-seasons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
    <div className="space-y-4 p-4 page-enter">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/settings">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Sezon Yönetimi</h1>
          <p className="text-sm text-muted-foreground">
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
            <Card className="border-green-200 bg-green-50/30">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-green-600" />
                  Aktif Sezon
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-lg font-bold">{activeSeason.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Başlangıç: {formatDateShort(activeSeason.start_date)}
                    {activeSeason.notes && ` — ${activeSeason.notes}`}
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/settings/seasons/${activeSeason.id}`}>
                      Sezon Raporu
                    </Link>
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        <Lock className="mr-1 h-3 w-3" />
                        Sezonu Kapat
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Sezonu Kapat</AlertDialogTitle>
                        <AlertDialogDescription>
                          &quot;{activeSeason.name}&quot; sezonu kapatılacak. Bu
                          işlem geri alınabilir ancak sezon kapandıktan sonra yeni
                          kayıtlar bu sezonu kullanmaz.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>İptal</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleCloseSeason(activeSeason.id)}
                        >
                          Kapat
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-amber-200 bg-amber-50/30">
              <CardContent className="py-6 text-center">
                <Calendar className="mx-auto mb-2 h-8 w-8 text-amber-500" />
                <p className="font-medium">Aktif sezon yok</p>
                <p className="text-sm text-muted-foreground">
                  Aşağıdan yeni bir sezon başlatın
                </p>
              </CardContent>
            </Card>
          )}

          {/* Yeni Sezon Başlat */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Plus className="h-4 w-4" />
                Yeni Sezon Başlat
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label>Sezon Adı</Label>
                <Input
                  placeholder="örn: 2026 İlkbahar"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Başlangıç Tarihi</Label>
                <Input
                  type="date"
                  value={newStartDate}
                  onChange={(e) => setNewStartDate(e.target.value)}
                />
              </div>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button className="w-full" disabled={!newName.trim() || creating}>
                    {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Yeni Sezon Başlat
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Yeni Sezon Başlat</AlertDialogTitle>
                    <AlertDialogDescription>
                      {activeSeason
                        ? `"${activeSeason.name}" sezonu kapatılıp "${newName.trim()}" sezonu başlatılacak.`
                        : `"${newName.trim()}" sezonu başlatılacak.`}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>İptal</AlertDialogCancel>
                    <AlertDialogAction onClick={handleStartNewSeason}>
                      Başlat
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>

          {/* Eski Sezonlar */}
          {closedSeasons.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Geçmiş Sezonlar</CardTitle>
              </CardHeader>
              <CardContent className="space-y-0 p-0">
                {closedSeasons.map((s, i) => (
                  <div key={s.id}>
                    {i > 0 && <Separator />}
                    <Link
                      href={`/settings/seasons/${s.id}`}
                      className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-muted/50"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-sm">{s.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateShort(s.start_date)}
                          {s.end_date ? ` — ${formatDateShort(s.end_date)}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="secondary" className="text-xs">
                          Kapalı
                        </Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </Link>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
