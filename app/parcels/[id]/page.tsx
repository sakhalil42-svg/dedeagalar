"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useParcel, useUpdateParcel, useDeleteParcel } from "@/lib/hooks/use-parcels";
import { useParcelDeliveries } from "@/lib/hooks/use-parcel-deliveries";
import { useParcelProfitability } from "@/lib/hooks/use-parcel-profitability";
import { useCompleteParcel } from "@/lib/hooks/use-complete-parcel";
import { useSeasonFilter } from "@/lib/contexts/season-context";
import { useBalanceVisibility } from "@/lib/contexts/balance-visibility";
import { formatCurrency, formatDateShort, formatWeight } from "@/lib/utils/format";
import type { ParcelStatus, CropType, ParcelPaymentType, BalingProvider } from "@/lib/types/database.types";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  MapPin,
  User,
  Wheat,
  Package,
  Truck,
  TrendingUp,
  CheckCircle2,
  Loader2,
  Pencil,
  Trash2,
  Calendar,
  Scale,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

const STATUS_LABELS: Record<ParcelStatus, string> = {
  active: "Aktif",
  baling: "Balyalaniyor",
  completed: "Tamamlandi",
  cancelled: "Iptal",
};

const STATUS_COLORS: Record<ParcelStatus, string> = {
  active: "bg-blue-100 text-blue-800",
  baling: "bg-yellow-100 text-yellow-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-gray-100 text-gray-500",
};

const CROP_LABELS: Record<CropType, string> = {
  bugday_sapi: "Bugday Sapi",
  arpa_sapi: "Arpa Sapi",
};

export default function ParcelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: parcel, isLoading } = useParcel(id);
  const { data: deliveries } = useParcelDeliveries(id);
  const { data: profitability } = useParcelProfitability(id);
  const { isVisible } = useBalanceVisibility();
  const isHidden = !isVisible;
  const { selectedSeasonId } = useSeasonFilter();

  const completeParcel = useCompleteParcel();
  const updateParcel = useUpdateParcel();
  const deleteParcel = useDeleteParcel();

  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  if (isLoading) {
    return (
      <div className="px-4 pt-3 pb-24 space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (!parcel) {
    return (
      <div className="px-4 pt-3">
        <p className="text-muted-foreground">Parsel bulunamadi</p>
      </div>
    );
  }

  const progress = parcel.total_bales > 0 ? (parcel.shipped_bales / parcel.total_bales) * 100 : 0;

  const handleComplete = async () => {
    try {
      await completeParcel.mutateAsync({ parcelId: id, seasonId: selectedSeasonId });
      toast.success("Parsel tamamlandi, cari hesaplara borc yazildi");
      setShowCompleteDialog(false);
    } catch (err) {
      toast.error("Hata: " + (err instanceof Error ? err.message : "Bilinmeyen"));
    }
  };

  const handleDelete = async () => {
    try {
      await deleteParcel.mutateAsync(id);
      toast.success("Parsel silindi");
      router.push("/parcels");
    } catch (err) {
      toast.error("Hata: " + (err instanceof Error ? err.message : "Bilinmeyen"));
    }
  };

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="sticky top-14 z-30 bg-background/95 backdrop-blur-lg border-b border-border/50 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold truncate">{parcel.parcel_name}</h1>
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${STATUS_COLORS[parcel.status]}`}>
                {STATUS_LABELS[parcel.status]}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{parcel.contact?.name}</p>
          </div>
          <div className="flex gap-1">
            <button onClick={() => setShowEditDialog(true)} className="p-2 rounded-xl hover:bg-muted">
              <Pencil className="h-4 w-4 text-muted-foreground" />
            </button>
            <button onClick={() => setShowDeleteDialog(true)} className="p-2 rounded-xl hover:bg-muted">
              <Trash2 className="h-4 w-4 text-red-500" />
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 pt-3 space-y-3">
        {/* Bilgi Karti */}
        <Card className="rounded-xl">
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Wheat className="h-4 w-4" />
              Tarla Bilgileri
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="grid grid-cols-2 gap-y-2 text-xs">
              <div>
                <span className="text-muted-foreground">Urun:</span>
                <span className="ml-1 font-medium">{CROP_LABELS[parcel.crop_type]}</span>
              </div>
              {parcel.feed_type && (
                <div>
                  <span className="text-muted-foreground">Yem Turu:</span>
                  <span className="ml-1 font-medium">{parcel.feed_type.name}</span>
                </div>
              )}
              {parcel.area_dekar && (
                <div>
                  <span className="text-muted-foreground">Alan:</span>
                  <span className="ml-1 font-medium">{parcel.area_dekar} dekar</span>
                </div>
              )}
              {parcel.region && (
                <div>
                  <span className="text-muted-foreground">Bolge:</span>
                  <span className="ml-1 font-medium">{parcel.region}</span>
                </div>
              )}
              {(parcel.village || parcel.city) && (
                <div className="col-span-2 flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {[parcel.village, parcel.district, parcel.city].filter(Boolean).join(", ")}
                  </span>
                </div>
              )}
              {parcel.storage_location && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Depo:</span>
                  <span className="ml-1 font-medium">{parcel.warehouse?.name || parcel.storage_location}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Odeme Karti */}
        <Card className="rounded-xl">
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <User className="h-4 w-4" />
              Tarla Sahibine Odeme
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="grid grid-cols-2 gap-y-2 text-xs">
              <div>
                <span className="text-muted-foreground">Odeme Tipi:</span>
                <span className="ml-1 font-medium">
                  {parcel.payment_type === "per_bale" ? "Balyaya gore" : "Dekara gore"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Birim Fiyat:</span>
                <span className="ml-1 font-medium">
                  {isHidden ? "***" : formatCurrency(
                    parcel.payment_type === "per_bale"
                      ? (parcel.price_per_bale || 0)
                      : (parcel.price_per_dekar || 0)
                  )}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Toplam Maliyet:</span>
                <span className="ml-1 font-semibold text-red-600">
                  {isHidden ? "***" : formatCurrency(parcel.owner_total_cost)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Balyalama Karti */}
        <Card className="rounded-xl">
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Package className="h-4 w-4" />
              Balyalama
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="grid grid-cols-2 gap-y-2 text-xs">
              <div>
                <span className="text-muted-foreground">Balyalayan:</span>
                <span className="ml-1 font-medium">
                  {parcel.baling_provider === "own" ? "Kendi makinemiz" : parcel.contractor?.name || "Muteahhit"}
                </span>
              </div>
              {parcel.baling_provider === "contractor" && parcel.contractor_cost_per_bale && (
                <div>
                  <span className="text-muted-foreground">Balya Ucreti:</span>
                  <span className="ml-1 font-medium">
                    {isHidden ? "***" : formatCurrency(parcel.contractor_cost_per_bale)}
                  </span>
                </div>
              )}
              {parcel.baling_date && (
                <div>
                  <span className="text-muted-foreground">Balyalama Tarihi:</span>
                  <span className="ml-1 font-medium">{formatDateShort(parcel.baling_date)}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Balya Takip */}
        <Card className="rounded-xl border-2 border-green-200 bg-green-50/30">
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Scale className="h-4 w-4" />
              Balya Takibi
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="text-center">
                <div className="text-lg font-bold">{parcel.total_bales}</div>
                <div className="text-[10px] text-muted-foreground">Toplam</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-green-700">{parcel.shipped_bales}</div>
                <div className="text-[10px] text-muted-foreground">Sevk</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-amber-700">{parcel.remaining_bales}</div>
                <div className="text-[10px] text-muted-foreground">Kalan</div>
              </div>
            </div>
            {parcel.total_bales > 0 && (
              <div className="space-y-1">
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all"
                    style={{ width: `${Math.min(100, progress)}%` }}
                  />
                </div>
                <div className="text-right text-[10px] text-muted-foreground">
                  %{progress.toFixed(0)} tamamlandi
                </div>
              </div>
            )}
            {profitability && profitability.avg_bale_weight > 0 && (
              <div className="mt-2 text-xs text-center">
                <span className="text-muted-foreground">Ort. Balya Agirligi:</span>
                <span className="ml-1 font-semibold">{Number(profitability.avg_bale_weight).toLocaleString("tr-TR")} kg</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sevkiyatlar */}
        <Card className="rounded-xl">
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Sevkiyatlar ({deliveries?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            {!deliveries || deliveries.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">Henuz sevkiyat yok</p>
            ) : (
              <div className="space-y-2">
                {deliveries.map((d: Record<string, unknown>) => {
                  const sale = d.sale as Record<string, unknown> | null;
                  const saleContact = sale?.contact as { name: string } | null;
                  return (
                    <div key={d.id as string} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                      <div className="text-xs">
                        <div className="font-medium">{formatDateShort(d.delivery_date as string)}</div>
                        <div className="text-muted-foreground">
                          {saleContact?.name || "—"} {d.vehicle_plate ? `(${d.vehicle_plate})` : ""}
                        </div>
                      </div>
                      <div className="text-right text-xs">
                        <div className="font-medium">{formatWeight(d.net_weight as number)}</div>
                        {(d.bale_count as number) > 0 && (
                          <div className="text-muted-foreground">{d.bale_count as number} balya</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Karlilik */}
        {profitability && (
          <Card className="rounded-xl">
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Karlilik
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Gelir (satis):</span>
                  <span className="font-medium">{isHidden ? "***" : formatCurrency(Number(profitability.total_revenue))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sahip maliyeti:</span>
                  <span className="font-medium text-red-600">-{isHidden ? "***" : formatCurrency(Number(profitability.owner_total_cost))}</span>
                </div>
                {Number(profitability.contractor_cost) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Muteahhit maliyeti:</span>
                    <span className="font-medium text-red-600">-{isHidden ? "***" : formatCurrency(Number(profitability.contractor_cost))}</span>
                  </div>
                )}
                {Number(profitability.total_freight) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Nakliye:</span>
                    <span className="font-medium text-red-600">-{isHidden ? "***" : formatCurrency(Number(profitability.total_freight))}</span>
                  </div>
                )}
                <hr className="my-1" />
                <div className="flex justify-between text-sm">
                  <span className="font-semibold">Kar:</span>
                  <span className={`font-bold ${Number(profitability.profit) >= 0 ? "text-green-700" : "text-red-600"}`}>
                    {isHidden ? "***" : formatCurrency(Number(profitability.profit))}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action buttons */}
        {parcel.status === "active" || parcel.status === "baling" ? (
          <Button
            onClick={() => setShowCompleteDialog(true)}
            className="w-full h-12 rounded-xl text-base font-semibold bg-green-600 hover:bg-green-700"
          >
            <CheckCircle2 className="h-5 w-5 mr-2" />
            Parseli Tamamla
          </Button>
        ) : null}
      </div>

      {/* Complete Dialog */}
      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent className="max-w-[90vw] rounded-2xl">
          <DialogHeader>
            <DialogTitle>Parseli Tamamla</DialogTitle>
            <DialogDescription>
              Bu islem ile tarla sahibine ve muteahhite (varsa) borc yazilacaktir.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Tarla sahibi borcu:</span>
              <span className="font-semibold">{formatCurrency(parcel.owner_total_cost)}</span>
            </div>
            {parcel.baling_provider === "contractor" && parcel.contractor_cost_per_bale && (
              <div className="flex justify-between">
                <span>Muteahhit borcu:</span>
                <span className="font-semibold">
                  {formatCurrency(parcel.total_bales * parcel.contractor_cost_per_bale)}
                </span>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCompleteDialog(false)} className="rounded-xl">
              Vazgec
            </Button>
            <Button
              onClick={handleComplete}
              disabled={completeParcel.isPending}
              className="rounded-xl bg-green-600 hover:bg-green-700"
            >
              {completeParcel.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Onayla
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-[90vw] rounded-2xl">
          <DialogHeader>
            <DialogTitle>Parseli Sil</DialogTitle>
            <DialogDescription>
              &quot;{parcel.parcel_name}&quot; parseli silinecek. Bu islem geri alinamaz.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} className="rounded-xl">
              Vazgec
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteParcel.isPending}
              className="rounded-xl"
            >
              {deleteParcel.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>Parseli Duzenle</DialogTitle>
          </DialogHeader>
          <EditParcelForm parcel={parcel} onSuccess={() => setShowEditDialog(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── EDIT PARCEL FORM ─────────────────────────────────────────

function EditParcelForm({
  parcel,
  onSuccess,
}: {
  parcel: NonNullable<ReturnType<typeof useParcel>["data"]>;
  onSuccess: () => void;
}) {
  const updateParcel = useUpdateParcel();

  const [name, setName] = useState(parcel.parcel_name);
  const [city, setCity] = useState(parcel.city || "");
  const [district, setDistrict] = useState(parcel.district || "");
  const [village, setVillage] = useState(parcel.village || "");
  const [region, setRegion] = useState(parcel.region || "");
  const [areaDekar, setAreaDekar] = useState(parcel.area_dekar?.toString() || "");
  const [totalBales, setTotalBales] = useState(parcel.total_bales.toString());
  const [pricePerBale, setPricePerBale] = useState(parcel.price_per_bale?.toString() || "");
  const [pricePerDekar, setPricePerDekar] = useState(parcel.price_per_dekar?.toString() || "");
  const [contractorCostPerBale, setContractorCostPerBale] = useState(
    parcel.contractor_cost_per_bale?.toString() || ""
  );
  const [storageLocation, setStorageLocation] = useState(parcel.storage_location || "");
  const [notes, setNotes] = useState(parcel.notes || "");
  const [status, setStatus] = useState(parcel.status);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Parsel adi gerekli");
      return;
    }

    try {
      await updateParcel.mutateAsync({
        id: parcel.id,
        parcel_name: name.trim(),
        city: city.trim() || null,
        district: district.trim() || null,
        village: village.trim() || null,
        region: region.trim() || null,
        area_dekar: areaDekar ? parseFloat(areaDekar) : null,
        total_bales: totalBales ? parseInt(totalBales, 10) : 0,
        price_per_bale: pricePerBale ? parseFloat(pricePerBale) : null,
        price_per_dekar: pricePerDekar ? parseFloat(pricePerDekar) : null,
        contractor_cost_per_bale: contractorCostPerBale ? parseFloat(contractorCostPerBale) : null,
        storage_location: storageLocation.trim() || null,
        notes: notes.trim() || null,
        status,
      });
      toast.success("Parsel guncellendi");
      onSuccess();
    } catch (err) {
      toast.error("Hata: " + (err instanceof Error ? err.message : "Bilinmeyen"));
    }
  };

  return (
    <div className="space-y-3">
      <Input placeholder="Parsel adi" value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl" />
      <div className="grid grid-cols-2 gap-2">
        <Input placeholder="Il" value={city} onChange={(e) => setCity(e.target.value)} className="rounded-xl" />
        <Input placeholder="Ilce" value={district} onChange={(e) => setDistrict(e.target.value)} className="rounded-xl" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input placeholder="Koy" value={village} onChange={(e) => setVillage(e.target.value)} className="rounded-xl" />
        <Input placeholder="Bolge" value={region} onChange={(e) => setRegion(e.target.value)} className="rounded-xl" />
      </div>
      <Input placeholder="Alan (dekar)" type="number" value={areaDekar} onChange={(e) => setAreaDekar(e.target.value)} className="rounded-xl" />
      <Input placeholder="Toplam balya sayisi" type="number" value={totalBales} onChange={(e) => setTotalBales(e.target.value)} className="rounded-xl" />

      {parcel.payment_type === "per_bale" ? (
        <Input placeholder="Balya basi fiyat (TL)" type="number" value={pricePerBale} onChange={(e) => setPricePerBale(e.target.value)} className="rounded-xl" />
      ) : (
        <Input placeholder="Dekar basi fiyat (TL)" type="number" value={pricePerDekar} onChange={(e) => setPricePerDekar(e.target.value)} className="rounded-xl" />
      )}

      {parcel.baling_provider === "contractor" && (
        <Input placeholder="Muteahhit balya ucreti (TL)" type="number" value={contractorCostPerBale} onChange={(e) => setContractorCostPerBale(e.target.value)} className="rounded-xl" />
      )}

      <Input placeholder="Depolama yeri" value={storageLocation} onChange={(e) => setStorageLocation(e.target.value)} className="rounded-xl" />
      <Input placeholder="Notlar" value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded-xl" />

      <Button
        onClick={handleSave}
        disabled={updateParcel.isPending}
        className="w-full h-12 rounded-xl text-base font-semibold"
      >
        {updateParcel.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        Kaydet
      </Button>
    </div>
  );
}
