"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  feedTypeSchema,
  type FeedTypeFormValues,
} from "@/lib/schemas/feed-type";
import {
  useFeedTypes,
  useCreateFeedType,
  useUpdateFeedType,
  useDeleteFeedType,
} from "@/lib/hooks/use-feed-types";
import type { FeedType } from "@/lib/types/database.types";
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
  Wheat,
} from "lucide-react";
import { toast } from "sonner";

export default function FeedTypesPage() {
  const { data: feedTypes, isLoading } = useFeedTypes();
  const createFeedType = useCreateFeedType();
  const updateFeedType = useUpdateFeedType();
  const deleteFeedType = useDeleteFeedType();

  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FeedType | null>(null);

  const addForm = useForm<FeedTypeFormValues>({
    resolver: zodResolver(feedTypeSchema),
    defaultValues: { name: "", description: "", is_active: true },
  });

  const editForm = useForm<FeedTypeFormValues>({
    resolver: zodResolver(feedTypeSchema),
  });

  async function onAdd(values: FeedTypeFormValues) {
    try {
      await createFeedType.mutateAsync({
        name: values.name,
        description: values.description || null,
        is_active: values.is_active,
      });
      toast.success("Yem türü eklendi");
      addForm.reset();
      setShowAdd(false);
    } catch {
      toast.error("Yem türü eklenirken hata oluştu");
    }
  }

  function startEdit(ft: FeedType) {
    editForm.reset({
      name: ft.name,
      description: ft.description || "",
      is_active: ft.is_active,
    });
    setEditingId(ft.id);
  }

  async function onEdit(values: FeedTypeFormValues) {
    if (!editingId) return;
    try {
      await updateFeedType.mutateAsync({
        id: editingId,
        name: values.name,
        description: values.description || null,
        is_active: values.is_active,
      });
      toast.success("Yem türü güncellendi");
      setEditingId(null);
    } catch {
      toast.error("Güncelleme sırasında hata oluştu");
    }
  }

  async function onDelete() {
    if (!deleteTarget) return;
    try {
      await deleteFeedType.mutateAsync(deleteTarget.id);
      toast.success("Yem türü silindi");
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
          <h1 className="text-xl font-bold">Yem Türleri</h1>
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
          <p className="text-sm font-semibold mb-3">Yeni Yem Türü</p>
          <form onSubmit={addForm.handleSubmit(onAdd)} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">İsim *</label>
              <Input
                {...addForm.register("name")}
                placeholder="örn. Yonca"
                className="rounded-xl bg-muted border-0 h-11"
              />
              {addForm.formState.errors.name && (
                <p className="text-xs text-destructive mt-1">
                  {addForm.formState.errors.name.message}
                </p>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Açıklama</label>
              <Input
                {...addForm.register("description")}
                placeholder="İsteğe bağlı açıklama"
                className="rounded-xl bg-muted border-0 h-11"
              />
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
                disabled={createFeedType.isPending}
                className="rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                {createFeedType.isPending ? (
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
      ) : feedTypes && feedTypes.length > 0 ? (
        <div className="space-y-2">
          {feedTypes.map((ft) =>
            editingId === ft.id ? (
              <div key={ft.id} className="rounded-xl bg-card p-4 shadow-sm">
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
                  <Input
                    {...editForm.register("description")}
                    placeholder="Açıklama"
                    className="rounded-xl bg-muted border-0 h-11"
                  />
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
                      disabled={updateFeedType.isPending}
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-60"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div key={ft.id} className="flex items-center justify-between rounded-xl bg-card p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-100">
                    <Wheat className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">{ft.name}</p>
                      {!ft.is_active && (
                        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">Pasif</span>
                      )}
                    </div>
                    {ft.description && (
                      <p className="text-xs text-muted-foreground">{ft.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => startEdit(ft)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(ft)}
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
          Henüz yem türü eklenmemiş.
        </div>
      )}

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Yem Türünü Sil</DialogTitle>
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
              disabled={deleteFeedType.isPending}
              className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-semibold text-white hover:bg-red-700 transition-colors disabled:opacity-60"
            >
              {deleteFeedType.isPending ? "Siliniyor..." : "Sil"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
