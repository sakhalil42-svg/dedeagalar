"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { purchaseSchema, type PurchaseFormValues } from "@/lib/schemas/purchase";
import {
  usePurchase,
  useUpdatePurchase,
  useDeletePurchase,
} from "@/lib/hooks/use-purchases";
import { useDeliveriesByPurchase } from "@/lib/hooks/use-deliveries";
import { useContacts } from "@/lib/hooks/use-contacts";
import { useFeedTypes } from "@/lib/hooks/use-feed-types";
import { useWarehouses } from "@/lib/hooks/use-warehouses";
import type { PurchaseStatus } from "@/lib/types/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { formatCurrency, formatDate, formatWeight, formatPercent } from "@/lib/utils/format";
import { DeliverySection } from "@/components/forms/delivery-section";

const STATUS_LABELS: Record<PurchaseStatus, string> = {
  draft: "Taslak",
  confirmed: "Onaylı",
  delivered: "Teslim Edildi",
  cancelled: "İptal",
};

const STATUS_COLORS: Record<PurchaseStatus, string> = {
  draft: "bg-amber-100 text-amber-800",
  confirmed: "bg-blue-100 text-blue-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const PRICING_MODEL_LABELS: Record<string, string> = {
  nakliye_dahil: "Nakliye Dahil",
  tir_ustu: "Tır Üstü",
};

const STATUS_FLOW: PurchaseStatus[] = ["draft", "confirmed", "delivered"];

export default function PurchaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data: purchase, isLoading } = usePurchase(id);
  const { data: deliveries, isLoading: deliveriesLoading } = useDeliveriesByPurchase(id);
  const updatePurchase = useUpdatePurchase();
  const deletePurchase = useDeletePurchase();

  const { data: contacts } = useContacts("supplier");
  const { data: feedTypes } = useFeedTypes(true);
  const { data: warehouses } = useWarehouses(true);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    control,
    formState: { errors },
  } = useForm<PurchaseFormValues>({
    resolver: zodResolver(purchaseSchema),
  });

  const quantity = useWatch({ control, name: "quantity" });
  const unitPrice = useWatch({ control, name: "unit_price" });
  const editTotal = (parseFloat(quantity || "0") * parseFloat(unitPrice || "0"));
  const editPricingModel = watch("pricing_model");

  // Delivery totals
  const totalDelivered = useMemo(() => {
    if (!deliveries) return 0;
    return deliveries.reduce((sum, d) => sum + d.net_weight, 0);
  }, [deliveries]);

  function startEditing() {
    if (!purchase) return;
    reset({
      contact_id: purchase.contact_id,
      feed_type_id: purchase.feed_type_id,
      warehouse_id: purchase.warehouse_id || "",
      quantity: String(purchase.quantity),
      unit: purchase.unit,
      unit_price: String(purchase.unit_price),
      purchase_date: purchase.purchase_date,
      due_date: purchase.due_date || "",
      pricing_model: purchase.pricing_model || "nakliye_dahil",
      notes: purchase.notes || "",
    });
    setEditing(true);
  }

  async function onSubmit(values: PurchaseFormValues) {
    try {
      await updatePurchase.mutateAsync({
        id,
        contact_id: values.contact_id,
        feed_type_id: values.feed_type_id,
        warehouse_id: values.warehouse_id || null,
        quantity: Number(values.quantity),
        unit: values.unit,
        unit_price: Number(values.unit_price),
        purchase_date: values.purchase_date,
        due_date: values.due_date || null,
        pricing_model: values.pricing_model as "nakliye_dahil" | "tir_ustu",
        notes: values.notes || null,
      });
      toast.success("Alım güncellendi");
      setEditing(false);
    } catch {
      toast.error("Güncelleme sırasında hata oluştu");
    }
  }

  async function handleStatusChange(newStatus: PurchaseStatus) {
    try {
      await updatePurchase.mutateAsync({ id, status: newStatus });
      toast.success(`Durum güncellendi: ${STATUS_LABELS[newStatus]}`);
    } catch {
      toast.error("Durum güncellenirken hata oluştu");
    }
  }

  async function handleDelete() {
    try {
      await deletePurchase.mutateAsync(id);
      toast.success("Alım silindi");
      router.push("/purchases");
    } catch {
      toast.error("Silme sırasında hata oluştu");
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!purchase) {
    return (
      <div className="p-4 text-center text-muted-foreground">Alım bulunamadı.</div>
    );
  }

  const currentStatusIdx = STATUS_FLOW.indexOf(purchase.status);
  const nextStatus = currentStatusIdx >= 0 && currentStatusIdx < STATUS_FLOW.length - 1
    ? STATUS_FLOW[currentStatusIdx + 1]
    : null;

  const progress = purchase.quantity > 0 ? Math.min((totalDelivered / purchase.quantity) * 100, 100) : 0;

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/purchases">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold">{purchase.purchase_no}</h1>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className={STATUS_COLORS[purchase.status]}>
                {STATUS_LABELS[purchase.status]}
              </Badge>
              {purchase.pricing_model && (
                <Badge variant="outline">
                  {PRICING_MODEL_LABELS[purchase.pricing_model] || purchase.pricing_model}
                </Badge>
              )}
            </div>
          </div>
        </div>
        {!editing && purchase.status !== "cancelled" && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={startEditing}>
              <Pencil className="mr-1 h-3 w-3" />
              Düzenle
            </Button>
            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-3 w-3" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Alımı Sil</DialogTitle>
                  <DialogDescription>
                    &quot;{purchase.purchase_no}&quot; silinecek. Bu işlem geri alınamaz.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDeleteOpen(false)}>İptal</Button>
                  <Button
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={deletePurchase.isPending}
                  >
                    {deletePurchase.isPending ? "Siliniyor..." : "Sil"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {/* Status actions */}
      {!editing && purchase.status !== "cancelled" && (
        <div className="flex gap-2">
          {nextStatus && (
            <Button
              size="sm"
              onClick={() => handleStatusChange(nextStatus)}
              disabled={updatePurchase.isPending}
            >
              {STATUS_LABELS[nextStatus]} Olarak İşaretle
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleStatusChange("cancelled")}
            disabled={updatePurchase.isPending}
          >
            İptal Et
          </Button>
        </div>
      )}

      {editing ? (
        <Card>
          <CardHeader>
            <CardTitle>Alım Düzenle</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label>Üretici *</Label>
                <Select
                  defaultValue={purchase.contact_id}
                  onValueChange={(val) => setValue("contact_id", val)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {contacts?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.contact_id && (
                  <p className="text-sm text-destructive">{errors.contact_id.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Yem Türü *</Label>
                <Select
                  defaultValue={purchase.feed_type_id}
                  onValueChange={(val) => setValue("feed_type_id", val)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {feedTypes?.map((ft) => (
                      <SelectItem key={ft.id} value={ft.id}>{ft.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.feed_type_id && (
                  <p className="text-sm text-destructive">{errors.feed_type_id.message}</p>
                )}
              </div>

              {/* Pricing Model */}
              <div className="space-y-2">
                <Label>Fiyatlandırma Modeli</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setValue("pricing_model", "nakliye_dahil")}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      editPricingModel === "nakliye_dahil"
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-foreground hover:bg-muted"
                    }`}
                  >
                    Nakliye Dahil
                  </button>
                  <button
                    type="button"
                    onClick={() => setValue("pricing_model", "tir_ustu")}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      editPricingModel === "tir_ustu"
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-foreground hover:bg-muted"
                    }`}
                  >
                    Tır Üstü
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="quantity">Miktar *</Label>
                  <Input id="quantity" type="number" step="0.01" {...register("quantity")} />
                  {errors.quantity && (
                    <p className="text-sm text-destructive">{errors.quantity.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Birim</Label>
                  <Select
                    defaultValue={purchase.unit}
                    onValueChange={(val) => setValue("unit", val)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kg">kg</SelectItem>
                      <SelectItem value="ton">ton</SelectItem>
                      <SelectItem value="balya">balya</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit_price">Birim Fiyat *</Label>
                  <Input id="unit_price" type="number" step="0.01" {...register("unit_price")} />
                  {errors.unit_price && (
                    <p className="text-sm text-destructive">{errors.unit_price.message}</p>
                  )}
                </div>
              </div>

              <div className="rounded-lg bg-muted p-3 text-center">
                <p className="text-sm text-muted-foreground">Toplam Tutar</p>
                <p className="text-xl font-bold">{formatCurrency(editTotal)}</p>
              </div>

              <div className="space-y-2">
                <Label>Depo</Label>
                <Select
                  defaultValue={purchase.warehouse_id || ""}
                  onValueChange={(val) => setValue("warehouse_id", val)}
                >
                  <SelectTrigger><SelectValue placeholder="Depo seçiniz" /></SelectTrigger>
                  <SelectContent>
                    {warehouses?.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name} {w.location ? `(${w.location})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="purchase_date">Alım Tarihi *</Label>
                  <Input id="purchase_date" type="date" {...register("purchase_date")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="due_date">Ödeme Vadesi</Label>
                  <Input id="due_date" type="date" {...register("due_date")} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notlar</Label>
                <Textarea id="notes" {...register("notes")} rows={2} />
              </div>

              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setEditing(false)}>
                  İptal
                </Button>
                <Button type="submit" className="flex-1" disabled={updatePurchase.isPending}>
                  {updatePurchase.isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Kaydediliyor...</>
                  ) : "Kaydet"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Üretici</span>
                <Link href={`/contacts/${purchase.contact_id}`} className="text-sm font-medium text-primary">
                  {purchase.contact?.name || "—"}
                </Link>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Yem Türü</span>
                <span className="text-sm font-medium">{purchase.feed_type?.name || "—"}</span>
              </div>
              <Separator />
              {purchase.pricing_model && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Fiyatlandırma</span>
                    <Badge variant="outline">
                      {PRICING_MODEL_LABELS[purchase.pricing_model] || purchase.pricing_model}
                    </Badge>
                  </div>
                  <Separator />
                </>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Miktar</span>
                <span className="text-sm font-medium">{formatWeight(purchase.quantity)}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Birim Fiyat</span>
                <span className="text-sm font-medium">{formatCurrency(purchase.unit_price)}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Toplam Tutar</span>
                <span className="text-sm font-bold">{formatCurrency(purchase.total_amount)}</span>
              </div>
              <Separator />
              {purchase.warehouse && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Depo</span>
                    <span className="text-sm font-medium">{purchase.warehouse.name}</span>
                  </div>
                  <Separator />
                </>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Alım Tarihi</span>
                <span className="text-sm font-medium">{formatDate(purchase.purchase_date)}</span>
              </div>
              {purchase.due_date && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Ödeme Vadesi</span>
                    <span className="text-sm font-medium">{formatDate(purchase.due_date)}</span>
                  </div>
                </>
              )}
              {purchase.notes && (
                <>
                  <Separator />
                  <div className="flex flex-col gap-1">
                    <span className="text-sm text-muted-foreground">Notlar</span>
                    <span className="text-sm">{purchase.notes}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Progress Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Teslimat İlerlemesi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-center">
                <p className="text-2xl font-bold">{formatWeight(totalDelivered)}</p>
                <p className="text-sm text-muted-foreground">
                  / {formatWeight(purchase.quantity)} sipariş
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{formatPercent(progress)} tamamlandı</span>
                  <span>{formatWeight(purchase.quantity - totalDelivered)} kalan</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Deliveries */}
      {!editing && (
        <DeliverySection
          deliveries={deliveries}
          isLoading={deliveriesLoading}
          purchaseId={id}
        />
      )}
    </div>
  );
}
