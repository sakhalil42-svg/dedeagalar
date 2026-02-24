"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { shipmentSchema, type ShipmentFormValues } from "@/lib/schemas/shipment";
import {
  useCreateShipment,
  useUpdateShipment,
  useDeleteShipment,
} from "@/lib/hooks/use-shipments";
import type { Shipment, ShipmentInsert } from "@/lib/types/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";
import { Loader2, Plus, Pencil, Trash2, Truck } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatDateShort } from "@/lib/utils/format";

const STATUS_LABELS: Record<string, string> = {
  pending: "Bekliyor",
  in_transit: "Yolda",
  delivered: "Teslim Edildi",
  cancelled: "İptal",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  in_transit: "bg-blue-100 text-blue-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const COST_PAYER_LABELS: Record<string, string> = {
  buyer: "Alıcı",
  seller: "Satıcı",
  shared: "Paylaşımlı",
};

interface ShipmentSectionProps {
  shipments: Shipment[] | undefined;
  isLoading: boolean;
  purchaseId?: string;
  saleId?: string;
}

export function ShipmentSection({
  shipments,
  isLoading,
  purchaseId,
  saleId,
}: ShipmentSectionProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingShipment, setEditingShipment] = useState<Shipment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Shipment | null>(null);

  const createShipment = useCreateShipment();
  const updateShipment = useUpdateShipment();
  const deleteShipment = useDeleteShipment();

  const addForm = useForm<ShipmentFormValues>({
    resolver: zodResolver(shipmentSchema),
    defaultValues: {
      carrier_name: "",
      carrier_phone: "",
      vehicle_plate: "",
      origin: "",
      destination: "",
      distance_km: "",
      loaded_quantity: "",
      delivered_quantity: "",
      transport_cost: "",
      cost_payer: "",
      shipment_date: new Date().toISOString().split("T")[0],
      delivery_date: "",
      notes: "",
    },
  });

  const editForm = useForm<ShipmentFormValues>({
    resolver: zodResolver(shipmentSchema),
  });

  function toPayload(values: ShipmentFormValues): ShipmentInsert {
    return {
      purchase_id: purchaseId || null,
      sale_id: saleId || null,
      carrier_name: values.carrier_name,
      carrier_phone: values.carrier_phone || null,
      vehicle_plate: values.vehicle_plate || null,
      origin: values.origin || null,
      destination: values.destination || null,
      distance_km: values.distance_km ? Number(values.distance_km) : null,
      loaded_quantity: Number(values.loaded_quantity),
      delivered_quantity: values.delivered_quantity ? Number(values.delivered_quantity) : null,
      transport_cost: values.transport_cost ? Number(values.transport_cost) : null,
      cost_payer: values.cost_payer || null,
      shipment_date: values.shipment_date,
      delivery_date: values.delivery_date || null,
      notes: values.notes || null,
    };
  }

  async function onAdd(values: ShipmentFormValues) {
    try {
      await createShipment.mutateAsync(toPayload(values));
      toast.success("Nakliye eklendi");
      addForm.reset();
      setShowAdd(false);
    } catch {
      toast.error("Nakliye eklenirken hata oluştu");
    }
  }

  function startEdit(s: Shipment) {
    editForm.reset({
      carrier_name: s.carrier_name,
      carrier_phone: s.carrier_phone || "",
      vehicle_plate: s.vehicle_plate || "",
      origin: s.origin || "",
      destination: s.destination || "",
      distance_km: s.distance_km != null ? String(s.distance_km) : "",
      loaded_quantity: String(s.loaded_quantity),
      delivered_quantity: s.delivered_quantity != null ? String(s.delivered_quantity) : "",
      transport_cost: s.transport_cost != null ? String(s.transport_cost) : "",
      cost_payer: s.cost_payer || "",
      shipment_date: s.shipment_date,
      delivery_date: s.delivery_date || "",
      notes: s.notes || "",
    });
    setEditingShipment(s);
  }

  async function onEdit(values: ShipmentFormValues) {
    if (!editingShipment) return;
    try {
      await updateShipment.mutateAsync({
        id: editingShipment.id,
        ...toPayload(values),
      });
      toast.success("Nakliye güncellendi");
      setEditingShipment(null);
    } catch {
      toast.error("Güncelleme sırasında hata oluştu");
    }
  }

  async function onDelete() {
    if (!deleteTarget) return;
    try {
      await deleteShipment.mutateAsync(deleteTarget.id);
      toast.success("Nakliye silindi");
      setDeleteTarget(null);
    } catch {
      toast.error("Silme sırasında hata oluştu");
    }
  }

  function ShipmentForm({
    form,
    onSubmit,
    isPending,
    onCancel,
  }: {
    form: ReturnType<typeof useForm<ShipmentFormValues>>;
    onSubmit: (v: ShipmentFormValues) => void;
    isPending: boolean;
    onCancel: () => void;
  }) {
    return (
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Nakliyeci *</Label>
            <Input {...form.register("carrier_name")} placeholder="Nakliyeci adı" />
            {form.formState.errors.carrier_name && (
              <p className="text-xs text-destructive">{form.formState.errors.carrier_name.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Telefon</Label>
            <Input {...form.register("carrier_phone")} placeholder="05XX..." />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Plaka</Label>
            <Input {...form.register("vehicle_plate")} placeholder="34 ABC 123" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Mesafe (km)</Label>
            <Input type="number" {...form.register("distance_km")} placeholder="0" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Çıkış</Label>
            <Input {...form.register("origin")} placeholder="Çıkış noktası" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Varış</Label>
            <Input {...form.register("destination")} placeholder="Varış noktası" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Yüklenen Miktar *</Label>
            <Input type="number" step="0.01" {...form.register("loaded_quantity")} placeholder="0" />
            {form.formState.errors.loaded_quantity && (
              <p className="text-xs text-destructive">{form.formState.errors.loaded_quantity.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Teslim Miktarı</Label>
            <Input type="number" step="0.01" {...form.register("delivered_quantity")} placeholder="0" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Nakliye Ücreti</Label>
            <Input type="number" step="0.01" {...form.register("transport_cost")} placeholder="0.00" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Ödeyen Taraf</Label>
            <Select
              value={form.watch("cost_payer") || ""}
              onValueChange={(val) => form.setValue("cost_payer", val)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seçiniz" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="buyer">Alıcı</SelectItem>
                <SelectItem value="seller">Satıcı</SelectItem>
                <SelectItem value="shared">Paylaşımlı</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Nakliye Tarihi *</Label>
            <Input type="date" {...form.register("shipment_date")} />
            {form.formState.errors.shipment_date && (
              <p className="text-xs text-destructive">{form.formState.errors.shipment_date.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Teslim Tarihi</Label>
            <Input type="date" {...form.register("delivery_date")} />
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

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Truck className="h-4 w-4" />
          Nakliye
        </CardTitle>
        {!showAdd && !editingShipment && (
          <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}>
            <Plus className="mr-1 h-3 w-3" />
            Ekle
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {showAdd && (
          <div className="rounded-lg border p-3">
            <p className="mb-3 text-sm font-medium">Yeni Nakliye</p>
            <ShipmentForm
              form={addForm}
              onSubmit={onAdd}
              isPending={createShipment.isPending}
              onCancel={() => {
                setShowAdd(false);
                addForm.reset();
              }}
            />
          </div>
        )}

        {editingShipment && (
          <div className="rounded-lg border p-3">
            <p className="mb-3 text-sm font-medium">Nakliye Düzenle</p>
            <ShipmentForm
              form={editForm}
              onSubmit={onEdit}
              isPending={updateShipment.isPending}
              onCancel={() => setEditingShipment(null)}
            />
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : shipments && shipments.length > 0 ? (
          <div className="space-y-2">
            {shipments.map((s) => {
              const fire =
                s.delivered_quantity != null
                  ? s.loaded_quantity - s.delivered_quantity
                  : null;
              return (
                <div
                  key={s.id}
                  className="rounded-lg border p-3 text-sm"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{s.carrier_name}</span>
                        <Badge
                          variant="secondary"
                          className={STATUS_COLORS[s.status] || ""}
                        >
                          {STATUS_LABELS[s.status] || s.status}
                        </Badge>
                      </div>
                      {s.vehicle_plate && (
                        <p className="text-muted-foreground">{s.vehicle_plate}</p>
                      )}
                      <p className="text-muted-foreground">
                        {formatDateShort(s.shipment_date)}
                        {s.origin && s.destination && ` | ${s.origin} → ${s.destination}`}
                      </p>
                    </div>
                    {!editingShipment && (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEdit(s)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTarget(s)}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <Separator className="my-2" />
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Yüklenen</span>
                      <p className="font-medium">{s.loaded_quantity} kg</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Teslim</span>
                      <p className="font-medium">
                        {s.delivered_quantity != null ? `${s.delivered_quantity} kg` : "-"}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Fire</span>
                      <p className={`font-medium ${fire && fire > 0 ? "text-red-600" : ""}`}>
                        {fire != null ? `${fire.toFixed(2)} kg` : "-"}
                      </p>
                    </div>
                  </div>
                  {(s.transport_cost != null || s.cost_payer) && (
                    <div className="mt-2 flex gap-4 text-xs">
                      {s.transport_cost != null && (
                        <div>
                          <span className="text-muted-foreground">Ücret: </span>
                          <span className="font-medium">{formatCurrency(s.transport_cost)}</span>
                        </div>
                      )}
                      {s.cost_payer && (
                        <div>
                          <span className="text-muted-foreground">Ödeyen: </span>
                          <span className="font-medium">
                            {COST_PAYER_LABELS[s.cost_payer] || s.cost_payer}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          !showAdd && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Henüz nakliye kaydı yok.
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
            <DialogTitle>Nakliyeyi Sil</DialogTitle>
            <DialogDescription>
              Bu nakliye kaydı silinecek. İşlem geri alınamaz.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              İptal
            </Button>
            <Button
              variant="destructive"
              onClick={onDelete}
              disabled={deleteShipment.isPending}
            >
              {deleteShipment.isPending ? "Siliniyor..." : "Sil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
