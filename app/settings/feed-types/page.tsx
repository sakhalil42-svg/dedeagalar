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
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/settings">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-xl font-bold">Yem Türleri</h1>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Ekle
        </Button>
      </div>

      {showAdd && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Yeni Yem Türü</CardTitle>
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
                  placeholder="örn. Yonca"
                />
                {addForm.formState.errors.name && (
                  <p className="text-sm text-destructive">
                    {addForm.formState.errors.name.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-desc">Açıklama</Label>
                <Input
                  id="add-desc"
                  {...addForm.register("description")}
                  placeholder="İsteğe bağlı açıklama"
                />
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
                  disabled={createFeedType.isPending}
                >
                  {createFeedType.isPending ? (
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
      ) : feedTypes && feedTypes.length > 0 ? (
        <div className="space-y-2">
          {feedTypes.map((ft) =>
            editingId === ft.id ? (
              <Card key={ft.id}>
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
                    <Input
                      {...editForm.register("description")}
                      placeholder="Açıklama"
                    />
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
                        disabled={updateFeedType.isPending}
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            ) : (
              <Card key={ft.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{ft.name}</p>
                      {!ft.is_active && (
                        <Badge variant="secondary">Pasif</Badge>
                      )}
                    </div>
                    {ft.description && (
                      <p className="text-sm text-muted-foreground">
                        {ft.description}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEdit(ft)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteTarget(ft)}
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
          Henüz yem türü eklenmemiş.
        </div>
      )}

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yem Türünü Sil</DialogTitle>
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
              disabled={deleteFeedType.isPending}
            >
              {deleteFeedType.isPending ? "Siliniyor..." : "Sil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
