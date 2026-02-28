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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Loader2,
  Pencil,
  Trash2,
  Share2,
  CheckCircle2,
  Clock,
  XCircle,
  Calendar,
  User,
  Truck,
  Save,
  Phone,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { formatCurrency, formatDate, formatWeight, formatPercent } from "@/lib/utils/format";
import { DeliverySection } from "@/components/forms/delivery-section";

const STATUS_LABELS: Record<PurchaseStatus, string> = {
  pending: "Beklemede",
  draft: "Taslak",
  confirmed: "Onaylı",
  delivered: "Teslim Edildi",
  cancelled: "İptal",
};

const STATUS_BADGE_STYLES: Record<PurchaseStatus, { bg: string; icon: typeof CheckCircle2 }> = {
  pending: { bg: "bg-amber-500/20 text-amber-600 dark:text-amber-400", icon: Clock },
  draft: { bg: "bg-gray-500/20 text-gray-600 dark:text-gray-400", icon: Clock },
  confirmed: { bg: "bg-blue-500/20 text-blue-600 dark:text-blue-400", icon: CheckCircle2 },
  delivered: { bg: "bg-primary/20 text-primary", icon: CheckCircle2 },
  cancelled: { bg: "bg-destructive/20 text-destructive", icon: XCircle },
};

const PRICING_MODEL_LABELS: Record<string, string> = {
  nakliye_dahil: "Nakliye Dahil",
  tir_ustu: "Tır Üstü",
};

const STATUS_FLOW: PurchaseStatus[] = ["pending", "draft", "confirmed", "delivered"];

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

  const statusStyle = STATUS_BADGE_STYLES[purchase.status] || STATUS_BADGE_STYLES.pending;
  const StatusIcon = statusStyle.icon;

  return (
    <div className="space-y-5 p-4 page-enter">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link
            href="/purchases"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-xl font-bold">Alım Detayı</h1>
        </div>
        {!editing && purchase.status !== "cancelled" && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={startEditing}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted transition-colors"
            >
              <Pencil className="h-4.5 w-4.5" />
            </button>
            <button
              onClick={() => setDeleteOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted transition-colors"
            >
              <Trash2 className="h-4.5 w-4.5" />
            </button>
          </div>
        )}
      </div>

      {/* Status badge (centered) */}
      <div className="flex justify-center">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium ${statusStyle.bg}`}>
          <StatusIcon className="h-4 w-4" />
          {STATUS_LABELS[purchase.status]}
        </span>
      </div>

      {editing ? (
        /* ═══ EDIT MODE ═══ */
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Üretici *</label>
            <Select defaultValue={purchase.contact_id} onValueChange={(val) => setValue("contact_id", val)}>
              <SelectTrigger className="rounded-xl bg-muted border-0 h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {contacts?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.contact_id && <p className="text-xs text-destructive mt-1">{errors.contact_id.message}</p>}
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Yem Türü *</label>
            <Select defaultValue={purchase.feed_type_id} onValueChange={(val) => setValue("feed_type_id", val)}>
              <SelectTrigger className="rounded-xl bg-muted border-0 h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {feedTypes?.map((ft) => (
                  <SelectItem key={ft.id} value={ft.id}>{ft.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.feed_type_id && <p className="text-xs text-destructive mt-1">{errors.feed_type_id.message}</p>}
          </div>

          {/* Pricing model */}
          <div className="flex items-center justify-between rounded-xl bg-muted px-4 py-3">
            <div className="flex items-center gap-2">
              <Truck className="h-4.5 w-4.5 text-muted-foreground" />
              <span className="text-sm font-medium">Fiyatlandırma</span>
            </div>
            <div className="flex gap-1 rounded-xl bg-background p-1">
              <button
                type="button"
                onClick={() => setValue("pricing_model", "nakliye_dahil")}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  editPricingModel === "nakliye_dahil" ? "bg-primary text-white" : "text-muted-foreground"
                }`}
              >
                Nakliye Dahil
              </button>
              <button
                type="button"
                onClick={() => setValue("pricing_model", "tir_ustu")}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  editPricingModel === "tir_ustu" ? "bg-primary text-white" : "text-muted-foreground"
                }`}
              >
                Tır Üstü
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Miktar *</label>
              <Input type="number" step="0.01" {...register("quantity")} className="rounded-xl bg-muted border-0 h-12" />
              {errors.quantity && <p className="text-xs text-destructive mt-1">{errors.quantity.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Birim</label>
              <Select defaultValue={purchase.unit} onValueChange={(val) => setValue("unit", val)}>
                <SelectTrigger className="rounded-xl bg-muted border-0 h-12"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="kg">kg</SelectItem>
                  <SelectItem value="ton">ton</SelectItem>
                  <SelectItem value="balya">balya</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Birim Fiyat *</label>
            <Input type="number" step="0.01" {...register("unit_price")} className="rounded-xl bg-muted border-0 h-12 text-right" />
            {errors.unit_price && <p className="text-xs text-destructive mt-1">{errors.unit_price.message}</p>}
          </div>

          <div className="rounded-2xl bg-primary/10 border-2 border-primary/20 p-5 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Toplam Tutar</p>
            <p className="text-4xl font-extrabold text-primary">{formatCurrency(editTotal)}</p>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Depo</label>
            <Select defaultValue={purchase.warehouse_id || ""} onValueChange={(val) => setValue("warehouse_id", val)}>
              <SelectTrigger className="rounded-xl bg-muted border-0 h-12"><SelectValue placeholder="Depo seçiniz" /></SelectTrigger>
              <SelectContent>
                {warehouses?.map((w) => (
                  <SelectItem key={w.id} value={w.id}>{w.name} {w.location ? `(${w.location})` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Alım Tarihi *</label>
              <Input type="date" {...register("purchase_date")} className="rounded-xl bg-muted border-0 h-12" />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Ödeme Vadesi</label>
              <Input type="date" {...register("due_date")} className="rounded-xl bg-muted border-0 h-12" />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Notlar</label>
            <Textarea {...register("notes")} rows={2} className="rounded-xl bg-muted border-0" />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="flex-1 rounded-xl border py-3.5 text-sm font-semibold transition-colors hover:bg-muted"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={updatePurchase.isPending}
              className="flex-1 rounded-xl bg-primary py-3.5 text-sm font-semibold text-white disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {updatePurchase.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Kaydediliyor...</>
              ) : (
                <><Save className="h-4 w-4" />Kaydet</>
              )}
            </button>
          </div>
        </form>
      ) : (
        /* ═══ VIEW MODE ═══ */
        <>
          {/* Net Weight Card */}
          <div className="rounded-2xl bg-card p-6 text-center shadow-sm">
            <p className="text-sm text-muted-foreground mb-1">Net Ağırlık</p>
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-5xl font-extrabold">{Math.round(purchase.quantity).toLocaleString("tr-TR")}</span>
              <span className="text-lg text-muted-foreground">{purchase.unit}</span>
            </div>
            <div className="flex items-center justify-center gap-2 mt-2 text-sm text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>{formatDate(purchase.purchase_date)}</span>
              <span>·</span>
              <span className="font-mono">#{purchase.purchase_no}</span>
            </div>
          </div>

          {/* Status actions */}
          {purchase.status !== "cancelled" && (
            <div className="flex gap-2">
              {nextStatus && (
                <button
                  onClick={() => handleStatusChange(nextStatus)}
                  disabled={updatePurchase.isPending}
                  className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {STATUS_LABELS[nextStatus]} Olarak İşaretle
                </button>
              )}
              <button
                onClick={() => handleStatusChange("cancelled")}
                disabled={updatePurchase.isPending}
                className="rounded-xl border px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-60"
              >
                İptal Et
              </button>
            </div>
          )}

          {/* Taraflar */}
          <section>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">TARAFLAR</p>
            <div className="space-y-2">
              {/* Tedarikçi */}
              <div className="rounded-xl bg-card p-4 shadow-sm flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                  <User className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Tedarikçi</p>
                  <Link href={`/contacts/${purchase.contact_id}`} className="text-sm font-semibold text-primary truncate block">
                    {purchase.contact?.name || "—"}
                  </Link>
                </div>
                {purchase.contact?.phone && (
                  <a
                    href={`tel:${purchase.contact.phone}`}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary"
                  >
                    <Phone className="h-4 w-4" />
                  </a>
                )}
              </div>

              {/* Depo */}
              {purchase.warehouse && (
                <div className="rounded-xl bg-card p-4 shadow-sm flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                    <Truck className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Depo</p>
                    <p className="text-sm font-semibold truncate">{purchase.warehouse.name}</p>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Finansal Özet */}
          <section>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">FİNANSAL ÖZET</p>
            <div className="rounded-2xl bg-card p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Yem Türü</span>
                <span className="text-sm font-semibold">{purchase.feed_type?.name || "—"}</span>
              </div>
              {purchase.pricing_model && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Fiyatlandırma</span>
                  <Badge variant="outline" className="rounded-full">
                    {PRICING_MODEL_LABELS[purchase.pricing_model] || purchase.pricing_model}
                  </Badge>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Birim Fiyat</span>
                <span className="text-sm font-semibold">{formatCurrency(purchase.unit_price)} / {purchase.unit}</span>
              </div>
              {purchase.due_date && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Ödeme Vadesi</span>
                  <span className="text-sm font-medium">{formatDate(purchase.due_date)}</span>
                </div>
              )}
              <div className="border-t-2 border-dashed my-1" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Toplam Tutar</span>
                <span className="text-xl font-extrabold text-primary">{formatCurrency(purchase.total_amount)}</span>
              </div>
            </div>
          </section>

          {/* Progress Card */}
          <section>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">TESLİMAT İLERLEMESİ</p>
            <div className="rounded-2xl bg-card p-5 shadow-sm space-y-3">
              <div className="text-center">
                <p className="text-3xl font-extrabold">{formatWeight(totalDelivered)}</p>
                <p className="text-sm text-muted-foreground">
                  / {formatWeight(purchase.quantity)} sipariş
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{formatPercent(progress)} tamamlandı</span>
                  <span>{formatWeight(purchase.quantity - totalDelivered)} kalan</span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Notes */}
          {purchase.notes && (
            <section>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">NOTLAR</p>
              <div className="rounded-xl bg-card p-4 shadow-sm">
                <p className="text-sm">{purchase.notes}</p>
              </div>
            </section>
          )}
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

      {/* Delete confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alımı Sil</DialogTitle>
            <DialogDescription>
              &quot;{purchase.purchase_no}&quot; silinecek. Bu işlem geri alınamaz.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} className="rounded-xl">İptal</Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deletePurchase.isPending}
              className="rounded-xl"
            >
              {deletePurchase.isPending ? "Siliniyor..." : "Sil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
