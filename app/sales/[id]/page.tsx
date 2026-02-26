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
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/sales">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold">{sale.sale_no}</h1>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className={STATUS_COLORS[sale.status]}>
                {STATUS_LABELS[sale.status]}
              </Badge>
            </div>
          </div>
        </div>
        {!editing && sale.status !== "cancelled" && (
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
                  <DialogTitle>Satışı Sil</DialogTitle>
                  <DialogDescription>
                    &quot;{sale.sale_no}&quot; silinecek. Bu işlem geri alınamaz.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDeleteOpen(false)}>İptal</Button>
                  <Button
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={deleteSale.isPending}
                  >
                    {deleteSale.isPending ? "Siliniyor..." : "Sil"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {/* Status actions */}
      {!editing && sale.status !== "cancelled" && (
        <div className="flex gap-2">
          {nextStatus && (
            <Button
              size="sm"
              onClick={() => handleStatusChange(nextStatus)}
              disabled={updateSale.isPending}
            >
              {STATUS_LABELS[nextStatus]} Olarak İşaretle
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleStatusChange("cancelled")}
            disabled={updateSale.isPending}
          >
            İptal Et
          </Button>
        </div>
      )}

      {editing ? (
        <Card>
          <CardHeader>
            <CardTitle>Satış Düzenle</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label>Müşteri *</Label>
                <Select
                  defaultValue={sale.contact_id}
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
                  defaultValue={sale.feed_type_id}
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

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="quantity">Miktar (kg) *</Label>
                  <Input id="quantity" type="number" step="0.01" {...register("quantity")} />
                  {errors.quantity && (
                    <p className="text-sm text-destructive">{errors.quantity.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit_price">Birim Fiyat (₺/kg) *</Label>
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

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="sale_date">Satış Tarihi *</Label>
                  <Input id="sale_date" type="date" {...register("sale_date")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="due_date">Tahsilat Vadesi</Label>
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
                <Button type="submit" className="flex-1" disabled={updateSale.isPending}>
                  {updateSale.isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Kaydediliyor...</>
                  ) : "Kaydet"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Sale Info */}
          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Müşteri</span>
                <Link href={`/contacts/${sale.contact_id}`} className="text-sm font-medium text-primary">
                  {sale.contact?.name || "—"}
                </Link>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Yem Türü</span>
                <span className="text-sm font-medium">{sale.feed_type?.name || "—"}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Miktar</span>
                <span className="text-sm font-medium">{formatWeight(sale.quantity)}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Birim Fiyat</span>
                <span className="text-sm font-medium">{formatCurrency(sale.unit_price)}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Toplam Tutar</span>
                <span className="text-sm font-bold">{formatCurrency(sale.total_amount)}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Satış Tarihi</span>
                <span className="text-sm font-medium">{formatDate(sale.sale_date)}</span>
              </div>
              {sale.due_date && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Tahsilat Vadesi</span>
                    <span className="text-sm font-medium">{formatDate(sale.due_date)}</span>
                  </div>
                </>
              )}
              {sale.notes && (
                <>
                  <Separator />
                  <div className="flex flex-col gap-1">
                    <span className="text-sm text-muted-foreground">Notlar</span>
                    <span className="text-sm">{sale.notes}</span>
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
                <p className="text-2xl font-bold">{formatWeight(deliveredQty)}</p>
                <p className="text-sm text-muted-foreground">
                  / {formatWeight(sale.quantity)} sipariş
                </p>
              </div>
              <div className="space-y-1">
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
            </CardContent>
          </Card>

          {/* Nakliye Özeti */}
          {deliveries && deliveries.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Nakliye Özeti</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Toplam Nakliye</span>
                  <span className="font-medium">{formatCurrency(deliveryStats.totalFreight)}</span>
                </div>
                {deliveryStats.customerFreight > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Müşteri Ödediği</span>
                    <span className="font-medium">{formatCurrency(deliveryStats.customerFreight)}</span>
                  </div>
                )}
              </CardContent>
            </Card>
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
