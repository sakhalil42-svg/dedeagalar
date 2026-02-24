"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { paymentSchema, type PaymentFormValues } from "@/lib/schemas/payment";
import { useCreatePayment } from "@/lib/hooks/use-payments";
import { useContacts } from "@/lib/hooks/use-contacts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function NewPaymentPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
      <NewPaymentForm />
    </Suspense>
  );
}

function NewPaymentForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedContactId = searchParams.get("contact_id") || "";
  const createPayment = useCreatePayment();
  const { data: contacts } = useContacts();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      contact_id: preselectedContactId,
      direction: "outbound",
      method: "cash",
      amount: "",
      payment_date: new Date().toISOString().split("T")[0],
      description: "",
      reference_type: "",
      reference_id: "",
    },
  });

  const direction = watch("direction");

  async function onSubmit(values: PaymentFormValues) {
    try {
      await createPayment.mutateAsync({
        contact_id: values.contact_id,
        direction: values.direction,
        method: values.method,
        amount: Number(values.amount),
        payment_date: values.payment_date,
        description: values.description || null,
        reference_type: values.reference_type || null,
        reference_id: values.reference_id || null,
      });
      toast.success(
        values.direction === "inbound"
          ? "Tahsilat kaydedildi"
          : "Ödeme kaydedildi"
      );
      router.push("/finance/payments");
    } catch {
      toast.error("Kayıt sırasında hata oluştu");
    }
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/finance/payments">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-xl font-bold">Yeni Ödeme / Tahsilat</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ödeme Bilgileri</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Yön *</Label>
              <Select
                defaultValue="outbound"
                onValueChange={(val) =>
                  setValue("direction", val as PaymentFormValues["direction"])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="outbound">Ödeme (Biz ödüyoruz)</SelectItem>
                  <SelectItem value="inbound">Tahsilat (Bize ödeniyor)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>
                {direction === "inbound" ? "Tahsilat Yapılan Kişi *" : "Ödeme Yapılan Kişi *"}
              </Label>
              <Select
                defaultValue={preselectedContactId}
                onValueChange={(val) => setValue("contact_id", val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Kişi seçiniz" />
                </SelectTrigger>
                <SelectContent>
                  {contacts?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.contact_id && (
                <p className="text-sm text-destructive">{errors.contact_id.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Yöntem *</Label>
              <Select
                defaultValue="cash"
                onValueChange={(val) =>
                  setValue("method", val as PaymentFormValues["method"])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Nakit</SelectItem>
                  <SelectItem value="transfer">Havale / EFT</SelectItem>
                  <SelectItem value="check">Çek</SelectItem>
                  <SelectItem value="promissory_note">Senet</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="amount">Tutar (TL) *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  {...register("amount")}
                  placeholder="0.00"
                />
                {errors.amount && (
                  <p className="text-sm text-destructive">{errors.amount.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment_date">Tarih *</Label>
                <Input
                  id="payment_date"
                  type="date"
                  {...register("payment_date")}
                />
                {errors.payment_date && (
                  <p className="text-sm text-destructive">{errors.payment_date.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Açıklama</Label>
              <Textarea
                id="description"
                {...register("description")}
                placeholder="Ödeme açıklaması..."
                rows={2}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={createPayment.isPending}
            >
              {createPayment.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Kaydediliyor...
                </>
              ) : direction === "inbound" ? (
                "Tahsilat Kaydet"
              ) : (
                "Ödeme Kaydet"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
