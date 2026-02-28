"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { deliverySchema, type DeliveryFormValues } from "@/lib/schemas/delivery";
import {
  useCreateDelivery,
  useUpdateDelivery,
  useDeleteDelivery,
} from "@/lib/hooks/use-deliveries";
import type { Delivery, DeliveryInsert } from "@/lib/types/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";
import { Loader2, Plus, Pencil, Trash2, Truck } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatDateShort, formatWeight } from "@/lib/utils/format";

const FREIGHT_PAYER_LABELS: Record<string, string> = {
  customer: "Müşteri",
  me: "Ben",
  supplier: "Üretici",
};

// Auto-calculate net weight from gross - tare
function handleWeightChange(form: ReturnType<typeof useForm<DeliveryFormValues>>) {
  const gross = parseFloat(form.getValues("gross_weight") || "0");
  const tare = parseFloat(form.getValues("tare_weight") || "0");
  if (gross > 0 && tare > 0) {
    form.setValue("net_weight", String(gross - tare));
  }
}

function DeliveryForm({
  form,
  onSubmit,
  isPending,
  onCancel,
}: {
  form: ReturnType<typeof useForm<DeliveryFormValues>>;
  onSubmit: (v: DeliveryFormValues) => void;
  isPending: boolean;
  onCancel: () => void;
}) {
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Kantar Fişi No</Label>
          <Input {...form.register("ticket_no")} placeholder="Fiş no" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Teslimat Tarihi *</Label>
          <Input type="date" {...form.register("delivery_date")} />
          {form.formState.errors.delivery_date && (
            <p className="text-xs text-destructive">{form.formState.errors.delivery_date.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Brüt (kg)</Label>
          <Input
            type="number"
            step="0.01"
            {...form.register("gross_weight")}
            placeholder="0"
            onChange={(e) => {
              form.register("gross_weight").onChange(e);
              setTimeout(() => handleWeightChange(form), 0);
            }}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Dara (kg)</Label>
          <Input
            type="number"
            step="0.01"
            {...form.register("tare_weight")}
            placeholder="0"
            onChange={(e) => {
              form.register("tare_weight").onChange(e);
              setTimeout(() => handleWeightChange(form), 0);
            }}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Net (kg) *</Label>
          <Input
            type="number"
            step="0.01"
            {...form.register("net_weight")}
            placeholder="0"
            className="font-semibold"
          />
          {form.formState.errors.net_weight && (
            <p className="text-xs text-destructive">{form.formState.errors.net_weight.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Plaka</Label>
          <Input {...form.register("vehicle_plate")} placeholder="34 ABC 123" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Nakliyeci</Label>
          <Input {...form.register("carrier_name")} placeholder="Nakliyeci adı" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Nakliye Ücreti</Label>
          <Input type="number" step="0.01" {...form.register("freight_cost")} placeholder="0.00" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Nakliye Ödeyen</Label>
          <Select
            value={form.watch("freight_payer") || ""}
            onValueChange={(val) => form.setValue("freight_payer", val)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seçiniz" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="customer">Müşteri</SelectItem>
              <SelectItem value="me">Ben</SelectItem>
              <SelectItem value="supplier">Üretici</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Notlar</Label>
        <Textarea {...form.register("notes")} rows={2} placeholder="Ek notlar..." />
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          İptal
        </Button>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Kaydet"}
        </Button>
      </div>
    </form>
  );
}

interface DeliverySectionProps {
  deliveries: Delivery[] | undefined;
  isLoading: boolean;
  saleId?: string;
  purchaseId?: string;
}

export function DeliverySection({
  deliveries,
  isLoading,
  saleId,
  purchaseId,
}: DeliverySectionProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingDelivery, setEditingDelivery] = useState<Delivery | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Delivery | null>(null);

  const createDelivery = useCreateDelivery();
  const updateDelivery = useUpdateDelivery();
  const deleteDelivery = useDeleteDelivery();

  const addForm = useForm<DeliveryFormValues>({
    resolver: zodResolver(deliverySchema),
    defaultValues: {
      delivery_date: new Date().toISOString().split("T")[0],
      ticket_no: "",
      gross_weight: "",
      tare_weight: "",
      net_weight: "",
      vehicle_plate: "",
      driver_name: "",
      carrier_name: "",
      freight_cost: "",
      freight_payer: "",
      notes: "",
    },
  });

  const editForm = useForm<DeliveryFormValues>({
    resolver: zodResolver(deliverySchema),
  });

  function toPayload(values: DeliveryFormValues): DeliveryInsert {
    return {
      sale_id: saleId || null,
      purchase_id: purchaseId || null,
      delivery_date: values.delivery_date,
      ticket_no: values.ticket_no || null,
      gross_weight: values.gross_weight ? Number(values.gross_weight) : null,
      tare_weight: values.tare_weight ? Number(values.tare_weight) : null,
      net_weight: Number(values.net_weight),
      vehicle_plate: values.vehicle_plate || null,
      driver_name: values.driver_name || null,
      carrier_name: values.carrier_name || null,
      freight_cost: values.freight_cost ? Number(values.freight_cost) : null,
      freight_payer: (values.freight_payer as "customer" | "me" | "supplier") || null,
      notes: values.notes || null,
    };
  }

  async function onAdd(values: DeliveryFormValues) {
    try {
      await createDelivery.mutateAsync(toPayload(values));
      toast.success("Sevkiyat eklendi");
      addForm.reset({
        delivery_date: new Date().toISOString().split("T")[0],
        ticket_no: "",
        gross_weight: "",
        tare_weight: "",
        net_weight: "",
        vehicle_plate: "",
        driver_name: "",
        carrier_name: "",
        freight_cost: "",
        freight_payer: "",
        notes: "",
      });
      setShowAdd(false);
    } catch {
      toast.error("Sevkiyat eklenirken hata oluştu");
    }
  }

  function startEdit(d: Delivery) {
    editForm.reset({
      delivery_date: d.delivery_date,
      ticket_no: d.ticket_no || "",
      gross_weight: d.gross_weight != null ? String(d.gross_weight) : "",
      tare_weight: d.tare_weight != null ? String(d.tare_weight) : "",
      net_weight: String(d.net_weight),
      vehicle_plate: d.vehicle_plate || "",
      driver_name: d.driver_name || "",
      carrier_name: d.carrier_name || "",
      freight_cost: d.freight_cost != null ? String(d.freight_cost) : "",
      freight_payer: d.freight_payer || "",
      notes: d.notes || "",
    });
    setEditingDelivery(d);
  }

  async function onEdit(values: DeliveryFormValues) {
    if (!editingDelivery) return;
    try {
      await updateDelivery.mutateAsync({
        id: editingDelivery.id,
        ...toPayload(values),
      });
      toast.success("Sevkiyat güncellendi");
      setEditingDelivery(null);
    } catch {
      toast.error("Güncelleme sırasında hata oluştu");
    }
  }

  async function onDelete() {
    if (!deleteTarget) return;
    try {
      await deleteDelivery.mutateAsync(deleteTarget.id);
      toast.success("Sevkiyat silindi");
      setDeleteTarget(null);
    } catch {
      toast.error("Silme sırasında hata oluştu");
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Truck className="h-4 w-4" />
          Sevkiyatlar
        </CardTitle>
        {!showAdd && !editingDelivery && (
          <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}>
            <Plus className="mr-1 h-3 w-3" />
            Yeni Sevkiyat
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {showAdd && (
          <div className="rounded-lg border p-3">
            <p className="mb-3 text-sm font-medium">Yeni Sevkiyat Ekle</p>
            <DeliveryForm
              form={addForm}
              onSubmit={onAdd}
              isPending={createDelivery.isPending}
              onCancel={() => {
                setShowAdd(false);
                addForm.reset();
              }}
            />
          </div>
        )}

        {editingDelivery && (
          <div className="rounded-lg border p-3">
            <p className="mb-3 text-sm font-medium">Sevkiyat Düzenle</p>
            <DeliveryForm
              form={editForm}
              onSubmit={onEdit}
              isPending={updateDelivery.isPending}
              onCancel={() => setEditingDelivery(null)}
            />
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : deliveries && deliveries.length > 0 ? (
          <div className="space-y-2">
            {deliveries.map((d) => (
              <div
                key={d.id}
                className="rounded-lg border p-3 text-sm"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {d.ticket_no && (
                        <span className="font-mono text-xs text-muted-foreground">#{d.ticket_no}</span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formatDateShort(d.delivery_date)}
                      </span>
                    </div>
                    <p className="text-lg font-bold">{formatWeight(d.net_weight)}</p>
                    {(d.gross_weight || d.tare_weight) && (
                      <p className="text-xs text-muted-foreground">
                        Brüt: {d.gross_weight ? `${d.gross_weight.toLocaleString("tr-TR")} kg` : "—"} · Dara: {d.tare_weight ? `${d.tare_weight.toLocaleString("tr-TR")} kg` : "—"}
                      </p>
                    )}
                  </div>
                  {!editingDelivery && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEdit(d)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTarget(d)}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
                {(d.vehicle_plate || d.carrier_name || d.freight_cost != null) && (
                  <>
                    <Separator className="my-2" />
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      {d.vehicle_plate && (
                        <div>
                          <span className="text-muted-foreground">Plaka: </span>
                          <span className="font-medium">{d.vehicle_plate}</span>
                        </div>
                      )}
                      {d.carrier_name && (
                        <div>
                          <span className="text-muted-foreground">Nakliyeci: </span>
                          <span className="font-medium">{d.carrier_name}</span>
                        </div>
                      )}
                      {d.freight_cost != null && (
                        <div>
                          <span className="text-muted-foreground">Nakliye: </span>
                          <span className="font-medium">{formatCurrency(d.freight_cost)}</span>
                        </div>
                      )}
                      {d.freight_payer && (
                        <div>
                          <span className="text-muted-foreground">Ödeyen: </span>
                          <span className="font-medium">
                            {FREIGHT_PAYER_LABELS[d.freight_payer] || d.freight_payer}
                          </span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        ) : (
          !showAdd && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Henüz sevkiyat kaydı yok.
            </p>
          )
        )}
      </CardContent>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sevkiyatı Sil</DialogTitle>
            <DialogDescription>
              Bu sevkiyat kaydı silinecek. İşlem geri alınamaz.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              İptal
            </Button>
            <Button
              variant="destructive"
              onClick={onDelete}
              disabled={deleteDelivery.isPending}
            >
              {deleteDelivery.isPending ? "Siliniyor..." : "Sil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
