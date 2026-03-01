"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { saleSchema, type SaleFormValues } from "@/lib/schemas/sale";
import {
  useSale,
  useUpdateSale,
  useDeleteSale,
} from "@/lib/hooks/use-sales";
import { useDeliveriesBySale } from "@/lib/hooks/use-deliveries";
import { useContacts } from "@/lib/hooks/use-contacts";
import { useFeedTypes } from "@/lib/hooks/use-feed-types";
import type { SaleStatus } from "@/lib/types/database.types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ArrowLeft, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { formatCurrency, formatDate, formatWeight, formatPercent } from "@/lib/utils/format";
import { DeliverySection } from "@/components/forms/delivery-section";

const STATUS_LABELS: Record<SaleStatus, string> = {
  pending: "Beklemede",
  draft: "Taslak",
  confirmed: "Onaylı",
  delivered: "Teslim Edildi",
  cancelled: "İptal",
};

const STATUS_COLORS: Record<SaleStatus, string> = {
  pending: "bg-gray-100 text-gray-800",
  draft: "bg-amber-100 text-amber-800",
  confirmed: "bg-blue-100 text-blue-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const STATUS_FLOW: SaleStatus[] = ["pending", "draft", "confirmed", "delivered"];

export default function SaleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data: sale, isLoading } = useSale(id);
  const { data: deliveries, isLoading: deliveriesLoading } = useDeliveriesBySale(id);
  const updateSale = useUpdateSale();
  const deleteSale = useDeleteSale();

  const { data: contacts } = useContacts("customer");
  const { data: feedTypes } = useFeedTypes(true);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    control,
    formState: { errors },
  } = useForm<SaleFormValues>({
    resolver: zodResolver(saleSchema),
  });

  const quantity = useWatch({ control, name: "quantity" });
  const unitPrice = useWatch({ control, name: "unit_price" });
  const editTotal = (parseFloat(quantity || "0") * parseFloat(unitPrice || "0"));

  // Compute delivery totals
  const deliveryStats = useMemo(() => {
    if (!deliveries) return { totalDelivered: 0, totalFreight: 0, customerFreight: 0 };
    const totalDelivered = deliveries.reduce((sum, d) => sum + d.net_weight, 0);
    const totalFreight = deliveries.reduce((sum, d) => sum + (d.freight_cost || 0), 0);
    const customerFreight = deliveries
      .filter((d) => d.freight_payer === "customer")
      .reduce((sum, d) => sum + (d.freight_cost || 0), 0);
    return { totalDelivered, totalFreight, customerFreight };
  }, [deliveries]);

  function startEditing() {
    if (!sale) return;
    reset({
      contact_id: sale.contact_id,
      feed_type_id: sale.feed_type_id,
      quantity: String(sale.quantity),
      unit_price: String(sale.unit_price),
      sale_date: sale.sale_date,
      due_date: sale.due_date || "",
      notes: sale.notes || "",
    });
    setEditing(true);
  }

  async function onSubmit(values: SaleFormValues) {
    try {
      await updateSale.mutateAsync({
        id,
        contact_id: values.contact_id,
        feed_type_id: values.feed_type_id,
        quantity: Number(values.quantity),
        unit: "kg",
        unit_price: Number(values.unit_price),
        sale_date: values.sale_date,
        due_date: values.due_date || null,
        notes: values.notes || null,
      });
      toast.success("Satış güncellendi");
      setEditing(false);
    } catch {
      toast.error("Güncelleme sırasında hata oluştu");
    }
  }

  async function handleStatusChange(newStatus: SaleStatus) {
    try {
      await updateSale.mutateAsync({ id, status: newStatus });
      toast.success(`Durum güncellendi: ${STATUS_LABELS[newStatus]}`);
    } catch {
      toast.error("Durum güncellenirken hata oluştu");
    }
  }

  async function handleDelete() {
    try {
      await deleteSale.mutateAsync(id);
      toast.success("Satış silindi");
      router.push("/sales");
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

  if (!sale) {
    return (
      <div className="p-4 text-center text-muted-foreground">Satış bulunamadı.</div>
    );
  }

  const currentStatusIdx = STATUS_FLOW.indexOf(sale.status);
  const nextStatus = currentStatusIdx >= 0 && currentStatusIdx < STATUS_FLOW.length - 1
    ? STATUS_FLOW[currentStatusIdx + 1]
    : null;

  const deliveredQty = deliveryStats.totalDelivered || sale.delivered_quantity || 0;
  const progress = sale.quantity > 0 ? Math.min((deliveredQty / sale.quantity) * 100, 100) : 0;

  return (
    <div className="space-y-4 p-4 page-enter">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/sales"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold">{sale.sale_no}</h1>
            <span className={`inline-block rounded-lg px-2 py-1 text-[10px] font-semibold ${STATUS_COLORS[sale.status]}`}>
              {STATUS_LABELS[sale.status]}
            </span>
          </div>
        </div>
        {!editing && sale.status !== "cancelled" && (
          <div className="flex gap-2">
            <button
              onClick={startEditing}
              className="flex items-center gap-1 rounded-xl bg-muted px-3 py-2 text-sm font-medium hover:bg-muted/80 transition-colors"
            >
              <Pencil className="h-3 w-3" />
              Düzenle
            </button>
            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <DialogTrigger asChild>
                <button className="flex h-9 w-9 items-center justify-center rounded-xl bg-destructive text-white hover:bg-destructive/90 transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </DialogTrigger>
              <DialogContent className="rounded-2xl">
                <DialogHeader>
                  <DialogTitle>Satışı Sil</DialogTitle>
                  <DialogDescription>
                    &quot;{sale.sale_no}&quot; silinecek. Bu işlem geri alınamaz.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setDeleteOpen(false)}
                    className="flex-1 rounded-xl py-3 text-sm font-semibold bg-muted hover:bg-muted/80 transition-colors"
                  >
                    İptal
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleteSale.isPending}
                    className="flex-1 rounded-xl py-3 text-sm font-semibold bg-destructive text-white hover:bg-destructive/90 disabled:opacity-50 transition-colors"
                  >
                    {deleteSale.isPending ? "Siliniyor..." : "Sil"}
                  </button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {/* Status actions */}
      {!editing && sale.status !== "cancelled" && (
        <div className="flex gap-2">
          {nextStatus && (
            <button
              onClick={() => handleStatusChange(nextStatus)}
              disabled={updateSale.isPending}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {STATUS_LABELS[nextStatus]} Olarak İşaretle
            </button>
          )}
          <button
            onClick={() => handleStatusChange("cancelled")}
            disabled={updateSale.isPending}
            className="rounded-xl bg-muted px-4 py-2 text-sm font-semibold hover:bg-muted/80 disabled:opacity-50 transition-colors"
          >
            İptal Et
          </button>
        </div>
      )}

      {editing ? (
        /* Edit Form */
        <div className="rounded-xl bg-card p-4 shadow-sm">
          <h2 className="text-sm font-semibold mb-4">Satış Düzenle</h2>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Müşteri *
              </label>
              <Select
                defaultValue={sale.contact_id}
                onValueChange={(val) => setValue("contact_id", val)}
              >
                <SelectTrigger className="rounded-xl bg-muted border-0 h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {contacts?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.contact_id && (
                <p className="text-sm text-destructive mt-1">{errors.contact_id.message}</p>
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Yem Türü *
              </label>
              <Select
                defaultValue={sale.feed_type_id}
                onValueChange={(val) => setValue("feed_type_id", val)}
              >
                <SelectTrigger className="rounded-xl bg-muted border-0 h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {feedTypes?.map((ft) => (
                    <SelectItem key={ft.id} value={ft.id}>{ft.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.feed_type_id && (
                <p className="text-sm text-destructive mt-1">{errors.feed_type_id.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="quantity" className="text-xs font-medium text-muted-foreground mb-1 block">
                  Miktar (kg) *
                </label>
                <Input id="quantity" type="number" step="0.01" {...register("quantity")} className="rounded-xl bg-muted border-0 h-12" />
                {errors.quantity && (
                  <p className="text-sm text-destructive mt-1">{errors.quantity.message}</p>
                )}
              </div>
              <div>
                <label htmlFor="unit_price" className="text-xs font-medium text-muted-foreground mb-1 block">
                  Birim Fiyat (TL/kg) *
                </label>
                <Input id="unit_price" type="number" step="0.01" {...register("unit_price")} className="rounded-xl bg-muted border-0 h-12" />
                {errors.unit_price && (
                  <p className="text-sm text-destructive mt-1">{errors.unit_price.message}</p>
                )}
              </div>
            </div>

            <div className="rounded-xl bg-primary/10 p-4 text-center">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Toplam Tutar</p>
              <p className="text-2xl font-extrabold text-primary">{formatCurrency(editTotal)}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="sale_date" className="text-xs font-medium text-muted-foreground mb-1 block">
                  Satış Tarihi *
                </label>
                <Input id="sale_date" type="date" {...register("sale_date")} className="rounded-xl bg-muted border-0 h-12" />
              </div>
              <div>
                <label htmlFor="due_date" className="text-xs font-medium text-muted-foreground mb-1 block">
                  Tahsilat Vadesi
                </label>
                <Input id="due_date" type="date" {...register("due_date")} className="rounded-xl bg-muted border-0 h-12" />
              </div>
            </div>

            <div>
              <label htmlFor="notes" className="text-xs font-medium text-muted-foreground mb-1 block">
                Notlar
              </label>
              <Textarea id="notes" {...register("notes")} rows={2} className="rounded-xl bg-muted border-0" />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="flex-1 rounded-xl py-3 text-sm font-semibold bg-muted hover:bg-muted/80 transition-colors"
              >
                İptal
              </button>
              <button
                type="submit"
                disabled={updateSale.isPending}
                className="flex-1 rounded-xl py-3 text-sm font-semibold bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {updateSale.isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Kaydediliyor...
                  </span>
                ) : "Kaydet"}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <>
          {/* Sale Info */}
          <div className="rounded-xl bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Müşteri</span>
              <Link href={`/contacts/${sale.contact_id}`} className="text-sm font-medium text-primary">
                {sale.contact?.name || "\u2014"}
              </Link>
            </div>
            <div className="border-t border-border/50" />
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Yem Türü</span>
              <span className="text-sm font-medium">{sale.feed_type?.name || "\u2014"}</span>
            </div>
            <div className="border-t border-border/50" />
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Miktar</span>
              <span className="text-sm font-medium">{formatWeight(sale.quantity)}</span>
            </div>
            <div className="border-t border-border/50" />
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Birim Fiyat</span>
              <span className="text-sm font-medium">{formatCurrency(sale.unit_price)}</span>
            </div>
            <div className="border-t border-border/50" />
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Toplam Tutar</span>
              <span className="text-sm font-bold">{formatCurrency(sale.total_amount)}</span>
            </div>
            <div className="border-t border-border/50" />
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Satış Tarihi</span>
              <span className="text-sm font-medium">{formatDate(sale.sale_date)}</span>
            </div>
            {sale.due_date && (
              <>
                <div className="border-t border-border/50" />
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-muted-foreground">Tahsilat Vadesi</span>
                  <span className="text-sm font-medium">{formatDate(sale.due_date)}</span>
                </div>
              </>
            )}
            {sale.notes && (
              <>
                <div className="border-t border-border/50" />
                <div className="flex flex-col gap-1 py-2">
                  <span className="text-sm text-muted-foreground">Notlar</span>
                  <span className="text-sm">{sale.notes}</span>
                </div>
              </>
            )}
          </div>

          {/* Progress Card */}
          <div className="rounded-2xl bg-card p-4 shadow-sm">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-3">Teslimat İlerlemesi</p>
            <div className="text-center">
              <p className="text-2xl font-extrabold">{formatWeight(deliveredQty)}</p>
              <p className="text-sm text-muted-foreground">
                / {formatWeight(sale.quantity)} sipariş
              </p>
            </div>
            <div className="mt-3 space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{formatPercent(progress)} tamamlandı</span>
                <span>{formatWeight(sale.quantity - deliveredQty)} kalan</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>

          {/* Nakliye Ozeti */}
          {deliveries && deliveries.length > 0 && (
            <div className="rounded-xl bg-card p-4 shadow-sm">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-3">Nakliye Özeti</p>
              <div className="flex items-center justify-between text-sm py-1">
                <span className="text-muted-foreground">Toplam Nakliye</span>
                <span className="font-medium">{formatCurrency(deliveryStats.totalFreight)}</span>
              </div>
              {deliveryStats.customerFreight > 0 && (
                <div className="flex items-center justify-between text-sm py-1">
                  <span className="text-muted-foreground">Müşteri Ödediği</span>
                  <span className="font-medium">{formatCurrency(deliveryStats.customerFreight)}</span>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Deliveries */}
      {!editing && (
        <DeliverySection
          deliveries={deliveries}
          isLoading={deliveriesLoading}
          saleId={id}
        />
      )}
    </div>
  );
}
