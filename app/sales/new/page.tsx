"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { saleSchema, type SaleFormValues } from "@/lib/schemas/sale";
import { useCreateSale } from "@/lib/hooks/use-sales";
import { useContacts } from "@/lib/hooks/use-contacts";
import { useFeedTypes } from "@/lib/hooks/use-feed-types";
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
import { formatCurrency } from "@/lib/utils/format";

export default function NewSalePage() {
  const router = useRouter();
  const createSale = useCreateSale();

  const { data: contacts } = useContacts("customer");
  const { data: feedTypes } = useFeedTypes(true);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<SaleFormValues>({
    resolver: zodResolver(saleSchema),
    defaultValues: {
      contact_id: "",
      feed_type_id: "",
      quantity: "",
      unit_price: "",
      sale_date: new Date().toISOString().split("T")[0],
      due_date: "",
      notes: "",
    },
  });

  const quantity = useWatch({ control, name: "quantity" });
  const unitPrice = useWatch({ control, name: "unit_price" });

  const totalAmount = useMemo(() => {
    const q = parseFloat(quantity || "0");
    const p = parseFloat(unitPrice || "0");
    return q * p;
  }, [quantity, unitPrice]);

  async function onSubmit(values: SaleFormValues) {
    try {
      await createSale.mutateAsync({
        contact_id: values.contact_id,
        feed_type_id: values.feed_type_id,
        quantity: Number(values.quantity),
        unit: "kg",
        unit_price: Number(values.unit_price),
        sale_date: values.sale_date,
        due_date: values.due_date || null,
        notes: values.notes || null,
      });
      toast.success("Satış kaydı oluşturuldu");
      router.push("/sales");
    } catch {
      toast.error("Satış kaydı oluşturulurken hata oluştu");
    }
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/sales">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-xl font-bold">Yeni Satış</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Satış Bilgileri</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Müşteri *</Label>
              <Select onValueChange={(val) => setValue("contact_id", val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Müşteri seçiniz" />
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
              <Label>Yem Türü *</Label>
              <Select onValueChange={(val) => setValue("feed_type_id", val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Yem türü seçiniz" />
                </SelectTrigger>
                <SelectContent>
                  {feedTypes?.map((ft) => (
                    <SelectItem key={ft.id} value={ft.id}>
                      {ft.name}
                    </SelectItem>
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
                <Input
                  id="quantity"
                  type="number"
                  step="0.01"
                  {...register("quantity")}
                  placeholder="0"
                />
                {errors.quantity && (
                  <p className="text-sm text-destructive">{errors.quantity.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit_price">Birim Fiyat (₺/kg) *</Label>
                <Input
                  id="unit_price"
                  type="number"
                  step="0.01"
                  {...register("unit_price")}
                  placeholder="0.00"
                />
                {errors.unit_price && (
                  <p className="text-sm text-destructive">{errors.unit_price.message}</p>
                )}
              </div>
            </div>

            <div className="rounded-lg bg-muted p-3 text-center">
              <p className="text-sm text-muted-foreground">Toplam Tutar</p>
              <p className="text-xl font-bold">{formatCurrency(totalAmount)}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="sale_date">Satış Tarihi *</Label>
                <Input
                  id="sale_date"
                  type="date"
                  {...register("sale_date")}
                />
                {errors.sale_date && (
                  <p className="text-sm text-destructive">{errors.sale_date.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="due_date">Tahsilat Vadesi</Label>
                <Input
                  id="due_date"
                  type="date"
                  {...register("due_date")}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notlar</Label>
              <Textarea
                id="notes"
                {...register("notes")}
                placeholder="Ek notlar..."
                rows={2}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={createSale.isPending}
            >
              {createSale.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Kaydediliyor...
                </>
              ) : (
                "Kaydet"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
