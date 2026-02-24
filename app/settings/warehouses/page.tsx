"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  warehouseSchema,
  type WarehouseFormValues,
} from "@/lib/schemas/warehouse";
import {
  useWarehouses,
  useCreateWarehouse,
  useUpdateWarehouse,
  useDeleteWarehouse,
} from "@/lib/hooks/use-warehouses";
import type { Warehouse } from "@/lib/types/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";

export default function WarehousesPage() {
  const { data: warehouses, isLoading } = useWarehouses();
  const createWarehouse = useCreateWarehouse();
  const updateWarehouse = useUpdateWarehouse();
  const deleteWarehouse = useDeleteWarehouse();

  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Warehouse | null>(null);

  const addForm = useForm<WarehouseFormValues>({
    resolver: zodResolver(warehouseSchema),
    defaultValues: { name: "", location: "", capacity: "", is_active: true },
  });

  const editForm = useForm<WarehouseFormValues>({
    resolver: zodResolver(warehouseSchema),
  });

  async function onAdd(values: WarehouseFormValues) {
    try {
      await createWarehouse.mutateAsync({
        name: values.name,
        location: values.location || null,
        capacity: values.capacity ? Number(values.capacity) : null,
        is_active: values.is_active,
      });
      toast.success("Depo eklendi");
      addForm.reset();
      setShowAdd(false);
    } catch {
      toast.error("Depo eklenirken hata oluştu");
    }
  }

  function startEdit(wh: Warehouse) {
    editForm.reset({
      name: wh.name,
      location: wh.location || "",
      capacity: wh.capacity != null ? String(wh.capacity) : "",
      is_active: wh.is_active,
    });
    setEditingId(wh.id);
  }

  async function onEdit(values: WarehouseFormValues) {
    if (!editingId) return;
    try {
      await updateWarehouse.mutateAsync({
        id: editingId,
        name: values.name,
        location: values.location || null,
        capacity: values.capacity ? Number(values.capacity) : null,
        is_active: values.is_active,
      });
      toast.success("Depo güncellendi");
      setEditingId(null);
    } catch {
      toast.error("Güncelleme sırasında hata oluştu");
    }
  }

  async function onDelete() {
    if (!deleteTarget) return;
    try {
      await deleteWarehouse.mutateAsync(deleteTarget.id);
      toast.success("Depo silindi");
      setDeleteTarget(null);
    } catch {
      toast.error("Silme sırasında hata oluştu");
    }
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/settings">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-xl font-bold">Depolar</h1>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Ekle
        </Button>
      </div>

      {showAdd && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Yeni Depo</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={addForm.handleSubmit(onAdd)}
              className="space-y-3"
            >
              <div className="space-y-2">
                <Label htmlFor="add-name">İsim *</Label>
                <Input
                  id="add-name"
                  {...addForm.register("name")}
                  placeholder="örn. Ana Depo"
                />
                {addForm.formState.errors.name && (
                  <p className="text-sm text-destructive">
                    {addForm.formState.errors.name.message}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="add-loc">Lokasyon</Label>
                  <Input
                    id="add-loc"
                    {...addForm.register("location")}
                    placeholder="Şehir / Adres"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-cap">Kapasite (ton)</Label>
                  <Input
                    id="add-cap"
                    type="number"
                    {...addForm.register("capacity")}
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowAdd(false);
                    addForm.reset();
                  }}
                >
                  İptal
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={createWarehouse.isPending}
                >
                  {createWarehouse.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Kaydet"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : warehouses && warehouses.length > 0 ? (
        <div className="space-y-2">
          {warehouses.map((wh) =>
            editingId === wh.id ? (
              <Card key={wh.id}>
                <CardContent className="p-4">
                  <form
                    onSubmit={editForm.handleSubmit(onEdit)}
                    className="space-y-3"
                  >
                    <Input
                      {...editForm.register("name")}
                      placeholder="İsim"
                    />
                    {editForm.formState.errors.name && (
                      <p className="text-sm text-destructive">
                        {editForm.formState.errors.name.message}
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        {...editForm.register("location")}
                        placeholder="Lokasyon"
                      />
                      <Input
                        type="number"
                        {...editForm.register("capacity")}
                        placeholder="Kapasite"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingId(null)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                      <Button
                        type="submit"
                        size="sm"
                        disabled={updateWarehouse.isPending}
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            ) : (
              <Card key={wh.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{wh.name}</p>
                      {!wh.is_active && (
                        <Badge variant="secondary">Pasif</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      {wh.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {wh.location}
                        </span>
                      )}
                      {wh.capacity && <span>{wh.capacity} ton</span>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEdit(wh)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteTarget(wh)}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          )}
        </div>
      ) : (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Henüz depo eklenmemiş.
        </div>
      )}

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Depoyu Sil</DialogTitle>
            <DialogDescription>
              &quot;{deleteTarget?.name}&quot; silinecek. Bu işlem geri
              alınamaz.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              İptal
            </Button>
            <Button
              variant="destructive"
              onClick={onDelete}
              disabled={deleteWarehouse.isPending}
            >
              {deleteWarehouse.isPending ? "Siliniyor..." : "Sil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
