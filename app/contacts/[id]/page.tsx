"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { contactSchema, type ContactFormValues } from "@/lib/schemas/contact";
import {
  useContact,
  useUpdateContact,
  useDeleteContact,
} from "@/lib/hooks/use-contacts";
import type { ContactType } from "@/lib/types/database.types";
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
import { ArrowLeft, Loader2, Pencil, Trash2, Phone, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { formatPhoneForWhatsApp, openPhoneDialer } from "@/lib/utils/whatsapp";

const TYPE_LABELS: Record<ContactType, string> = {
  supplier: "Üretici",
  customer: "Müşteri",
  both: "Üretici/Müşteri",
};

const TYPE_COLORS: Record<ContactType, string> = {
  supplier: "bg-blue-100 text-blue-800",
  customer: "bg-green-100 text-green-800",
  both: "bg-purple-100 text-purple-800",
};

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data: contact, isLoading } = useContact(id);
  const updateContact = useUpdateContact();
  const deleteContact = useDeleteContact();

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
  });

  function startEditing() {
    if (!contact) return;
    reset({
      type: contact.type,
      name: contact.name,
      phone: contact.phone || "",
      email: contact.email || "",
      address: contact.address || "",
      city: contact.city || "",
      notes: contact.notes || "",
    });
    setEditing(true);
  }

  async function onSubmit(values: ContactFormValues) {
    try {
      const payload = {
        id,
        ...values,
        phone: values.phone || null,
        email: values.email || null,
        address: values.address || null,
        city: values.city || null,
        notes: values.notes || null,
      };
      await updateContact.mutateAsync(payload);
      toast.success("Kişi güncellendi");
      setEditing(false);
    } catch {
      toast.error("Güncelleme sırasında hata oluştu");
    }
  }

  async function handleDelete() {
    try {
      await deleteContact.mutateAsync(id);
      toast.success("Kişi silindi");
      router.push("/contacts");
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

  if (!contact) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Kişi bulunamadı.
      </div>
    );
  }

  const account = contact.accounts?.[0];

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/contacts">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-xl font-bold">{contact.name}</h1>
        </div>
        {!editing && (
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
                  <DialogTitle>Kişiyi Sil</DialogTitle>
                  <DialogDescription>
                    &quot;{contact.name}&quot; silinecek. Bu işlem geri alınamaz.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setDeleteOpen(false)}
                  >
                    İptal
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={deleteContact.isPending}
                  >
                    {deleteContact.isPending ? "Siliniyor..." : "Sil"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {editing ? (
        <Card>
          <CardHeader>
            <CardTitle>Kişi Düzenle</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label>Kişi Türü</Label>
                <Select
                  defaultValue={contact.type}
                  onValueChange={(val) =>
                    setValue("type", val as ContactFormValues["type"])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="supplier">Üretici</SelectItem>
                    <SelectItem value="customer">Müşteri</SelectItem>
                    <SelectItem value="both">Üretici/Müşteri</SelectItem>
                  </SelectContent>
                </Select>
                {errors.type && (
                  <p className="text-sm text-destructive">
                    {errors.type.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">İsim *</Label>
                <Input id="name" {...register("name")} />
                {errors.name && (
                  <p className="text-sm text-destructive">
                    {errors.name.message}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefon</Label>
                  <Input id="phone" {...register("phone")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">Şehir</Label>
                  <Input id="city" {...register("city")} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">E-posta</Label>
                <Input id="email" type="email" {...register("email")} />
                {errors.email && (
                  <p className="text-sm text-destructive">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Adres</Label>
                <Textarea id="address" {...register("address")} rows={2} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notlar</Label>
                <Textarea id="notes" {...register("notes")} rows={2} />
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setEditing(false)}
                >
                  İptal
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={updateContact.isPending}
                >
                  {updateContact.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Kaydediliyor...
                    </>
                  ) : (
                    "Kaydet"
                  )}
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
                <span className="text-sm text-muted-foreground">Tür</span>
                <Badge
                  variant="secondary"
                  className={TYPE_COLORS[contact.type]}
                >
                  {TYPE_LABELS[contact.type]}
                </Badge>
              </div>
              <Separator />
              {contact.phone && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Telefon
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{contact.phone}</span>
                      <button
                        onClick={() => openPhoneDialer(contact.phone)}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors"
                      >
                        <Phone className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          const wp = formatPhoneForWhatsApp(contact.phone);
                          if (wp) window.open(`https://wa.me/${wp}`, "_blank");
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600 hover:bg-green-200 transition-colors"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <Separator />
                </>
              )}
              {contact.email && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      E-posta
                    </span>
                    <a
                      href={`mailto:${contact.email}`}
                      className="text-sm font-medium text-primary"
                    >
                      {contact.email}
                    </a>
                  </div>
                  <Separator />
                </>
              )}
              {contact.city && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Şehir</span>
                    <span className="text-sm font-medium">{contact.city}</span>
                  </div>
                  <Separator />
                </>
              )}
              {contact.address && (
                <>
                  <div className="flex flex-col gap-1">
                    <span className="text-sm text-muted-foreground">Adres</span>
                    <span className="text-sm">{contact.address}</span>
                  </div>
                  <Separator />
                </>
              )}
              {contact.notes && (
                <div className="flex flex-col gap-1">
                  <span className="text-sm text-muted-foreground">Notlar</span>
                  <span className="text-sm">{contact.notes}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {account && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cari Hesap</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 p-4 pt-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Bakiye</span>
                  <span
                    className={`text-sm font-bold ${
                      account.balance >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {new Intl.NumberFormat("tr-TR", {
                      style: "currency",
                      currency: "TRY",
                    }).format(account.balance)}
                  </span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Toplam Borç
                  </span>
                  <span className="text-sm font-medium">
                    {new Intl.NumberFormat("tr-TR", {
                      style: "currency",
                      currency: "TRY",
                    }).format(account.total_debit)}
                  </span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Toplam Alacak
                  </span>
                  <span className="text-sm font-medium">
                    {new Intl.NumberFormat("tr-TR", {
                      style: "currency",
                      currency: "TRY",
                    }).format(account.total_credit)}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
