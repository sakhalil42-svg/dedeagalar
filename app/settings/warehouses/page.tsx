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
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  MapPin,
  Warehouse as WarehouseIcon,
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
    <div className="p-4 page-enter">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Link
            href="/settings"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-xl font-bold">Depolar</h1>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Ekle
        </button>
      </div>

      {showAdd && (
        <div className="rounded-xl bg-card p-4 shadow-sm mb-4">
          <p className="text-sm font-semibold mb-3">Yeni Depo</p>
          <form onSubmit={addForm.handleSubmit(onAdd)} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">İsim *</label>
              <Input
                {...addForm.register("name")}
                placeholder="örn. Ana Depo"
                className="rounded-xl bg-muted border-0 h-11"
              />
              {addForm.formState.errors.name && (
                <p className="text-xs text-destructive mt-1">
                  {addForm.formState.errors.name.message}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Lokasyon</label>
                <Input
                  {...addForm.register("location")}
                  placeholder="Şehir / Adres"
                  className="rounded-xl bg-muted border-0 h-11"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Kapasite (ton)</label>
                <Input
                  type="number"
                  {...addForm.register("capacity")}
                  placeholder="0"
                  className="rounded-xl bg-muted border-0 h-11"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowAdd(false);
                  addForm.reset();
                }}
                className="rounded-xl border border-border px-4 py-2.5 text-xs font-semibold hover:bg-muted transition-colors"
              >
                İptal
              </button>
              <button
                type="submit"
                disabled={createWarehouse.isPending}
                className="rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                {createWarehouse.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Kaydet"
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : warehouses && warehouses.length > 0 ? (
        <div className="space-y-2">
          {warehouses.map((wh) =>
            editingId === wh.id ? (
              <div key={wh.id} className="rounded-xl bg-card p-4 shadow-sm">
                <form onSubmit={editForm.handleSubmit(onEdit)} className="space-y-3">
                  <Input
                    {...editForm.register("name")}
                    placeholder="İsim"
                    className="rounded-xl bg-muted border-0 h-11"
                  />
                  {editForm.formState.errors.name && (
                    <p className="text-xs text-destructive">
                      {editForm.formState.errors.name.message}
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      {...editForm.register("location")}
                      placeholder="Lokasyon"
                      className="rounded-xl bg-muted border-0 h-11"
                    />
                    <Input
                      type="number"
                      {...editForm.register("capacity")}
                      placeholder="Kapasite"
                      className="rounded-xl bg-muted border-0 h-11"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-border hover:bg-muted transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <button
                      type="submit"
                      disabled={updateWarehouse.isPending}
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-60"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div key={wh.id} className="flex items-center justify-between rounded-xl bg-card p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100">
                    <WarehouseIcon className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">{wh.name}</p>
                      {!wh.is_active && (
                        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">Pasif</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {wh.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {wh.location}
                        </span>
                      )}
                      {wh.capacity && <span>{wh.capacity} ton</span>}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => startEdit(wh)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(wh)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-destructive hover:bg-muted transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
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
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Depoyu Sil</DialogTitle>
            <DialogDescription>
              &quot;{deleteTarget?.name}&quot; silinecek. Bu işlem geri alınamaz.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <button
              onClick={() => setDeleteTarget(null)}
              className="flex-1 rounded-xl border border-border py-3 text-sm font-semibold hover:bg-muted transition-colors"
            >
              İptal
            </button>
            <button
              onClick={onDelete}
              disabled={deleteWarehouse.isPending}
              className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-semibold text-white hover:bg-red-700 transition-colors disabled:opacity-60"
            >
              {deleteWarehouse.isPending ? "Siliniyor..." : "Sil"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
