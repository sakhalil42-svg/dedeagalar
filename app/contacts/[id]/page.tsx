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
import { formatPhoneForWhatsApp, openPhoneDialer, openWhatsAppMessage, buildGunlukOzetMessage, buildOdemeHatirlatmaMessage } from "@/lib/utils/whatsapp";
import { useBalanceVisibility } from "@/lib/contexts/balance-visibility";
import { formatCurrency, capitalizeWords } from "@/lib/utils/format";
import { useDeliveriesByContact } from "@/lib/hooks/use-deliveries-by-contact";
import { Copy, Send } from "lucide-react";

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
  const { isVisible } = useBalanceVisibility();
  const masked = (amount: number) => isVisible ? formatCurrency(amount) : "••••••";
  const { data: deliveries } = useDeliveriesByContact(id);

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
      credit_limit: contact.credit_limit != null ? String(contact.credit_limit) : "",
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
        credit_limit: values.credit_limit ? Number(values.credit_limit) : null,
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

  // Today's deliveries for this contact
  const today = new Date().toISOString().split("T")[0];
  const todayDeliveries = (deliveries || []).filter(
    (d) => d.delivery_date === today
  );

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
                <Input id="name" {...register("name", { onBlur: (e) => setValue("name", capitalizeWords(e.target.value)) })} />
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
                <Label htmlFor="credit_limit">Kredi Limiti (₺)</Label>
                <Input
                  id="credit_limit"
                  type="number"
                  step="0.01"
                  {...register("credit_limit")}
                  placeholder="Boş = sınırsız, 0 = peşin"
                />
                <p className="text-[10px] text-muted-foreground">Boş bırakılırsa limit uygulanmaz</p>
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
                    <span className="text-sm break-words">{contact.address}</span>
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
                {contact.credit_limit != null && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Kredi Limiti</span>
                      <span className="text-sm font-medium">{masked(contact.credit_limit)}</span>
                    </div>
                    {account.balance > 0 && contact.credit_limit > 0 && (
                      <div className="w-full">
                        {(() => {
                          const ratio = (account.balance / contact.credit_limit) * 100;
                          const barColor = ratio >= 100 ? "bg-red-500" : ratio >= 80 ? "bg-yellow-500" : "bg-green-500";
                          return (
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-[10px]">
                                <span className={ratio >= 100 ? "text-red-600 font-bold" : ratio >= 80 ? "text-yellow-600 font-medium" : "text-green-600"}>
                                  %{Math.min(ratio, 999).toFixed(0)} kullanım
                                </span>
                                {ratio >= 100 && (
                                  <Badge variant="secondary" className="bg-red-100 text-red-800 text-[9px] px-1 py-0">
                                    LİMİT AŞIMI
                                  </Badge>
                                )}
                              </div>
                              <div className="h-1.5 w-full rounded-full bg-muted">
                                <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(ratio, 100)}%` }} />
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                    <Separator />
                  </>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Bakiye</span>
                  <span
                    className={`text-sm font-bold ${
                      account.balance > 0
                        ? "text-red-600"
                        : account.balance < 0
                          ? "text-green-600"
                          : ""
                    }`}
                  >
                    {masked(Math.abs(account.balance))}
                  </span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Toplam Borç
                  </span>
                  <span className="text-sm font-medium">
                    {masked(account.total_debit)}
                  </span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Toplam Alacak
                  </span>
                  <span className="text-sm font-medium">
                    {masked(account.total_credit)}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* WhatsApp Mesaj Gönder */}
          {contact.phone && account && (
            <Card>
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <MessageCircle className="h-4 w-4 text-green-600" />
                  WhatsApp Mesaj Gönder
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-2">
                {/* Günlük Özet */}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-green-700 border-green-200 hover:bg-green-50"
                    onClick={() => {
                      const msg = buildGunlukOzetMessage({
                        contactName: contact.name,
                        date: today,
                        deliveries: todayDeliveries.map((d) => ({
                          netWeight: d.net_weight,
                          plate: d.vehicle_plate || undefined,
                        })),
                        balance: account.balance,
                      });
                      openWhatsAppMessage(contact.phone, msg);
                    }}
                  >
                    <Send className="mr-1 h-3 w-3" />
                    Günlük Özet
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-green-700 border-green-200 hover:bg-green-50"
                    onClick={() => {
                      const msg = buildGunlukOzetMessage({
                        contactName: contact.name,
                        date: today,
                        deliveries: todayDeliveries.map((d) => ({
                          netWeight: d.net_weight,
                          plate: d.vehicle_plate || undefined,
                        })),
                        balance: account.balance,
                      });
                      navigator.clipboard.writeText(msg);
                      toast.success("Mesaj kopyalandı");
                    }}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                {/* Ödeme Hatırlatma */}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-green-700 border-green-200 hover:bg-green-50"
                    onClick={() => {
                      const msg = buildOdemeHatirlatmaMessage({
                        contactName: contact.name,
                        balance: account.balance,
                      });
                      openWhatsAppMessage(contact.phone, msg);
                    }}
                  >
                    <Send className="mr-1 h-3 w-3" />
                    Ödeme Hatırlatma
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-green-700 border-green-200 hover:bg-green-50"
                    onClick={() => {
                      const msg = buildOdemeHatirlatmaMessage({
                        contactName: contact.name,
                        balance: account.balance,
                      });
                      navigator.clipboard.writeText(msg);
                      toast.success("Mesaj kopyalandı");
                    }}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
