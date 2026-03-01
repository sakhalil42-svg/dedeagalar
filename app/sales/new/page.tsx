"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { saleSchema, type SaleFormValues } from "@/lib/schemas/sale";
import { useCreateSale } from "@/lib/hooks/use-sales";
import { useContacts } from "@/lib/hooks/use-contacts";
import { useFeedTypes } from "@/lib/hooks/use-feed-types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
    <div className="p-4 page-enter">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/sales"
          className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold">Yeni Satış</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Musteri */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            Müşteri *
          </label>
          <Select onValueChange={(val) => setValue("contact_id", val)}>
            <SelectTrigger className="rounded-xl bg-muted border-0 h-12">
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
            <p className="text-sm text-destructive mt-1">{errors.contact_id.message}</p>
          )}
        </div>

        {/* Yem Turu */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            Yem Türü *
          </label>
          <Select onValueChange={(val) => setValue("feed_type_id", val)}>
            <SelectTrigger className="rounded-xl bg-muted border-0 h-12">
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
            <p className="text-sm text-destructive mt-1">{errors.feed_type_id.message}</p>
          )}
        </div>

        {/* Miktar & Birim Fiyat */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="quantity" className="text-xs font-medium text-muted-foreground mb-1 block">
              Miktar (kg) *
            </label>
            <Input
              id="quantity"
              type="number"
              step="0.01"
              {...register("quantity")}
              placeholder="0"
              className="rounded-xl bg-muted border-0 h-12"
            />
            {errors.quantity && (
              <p className="text-sm text-destructive mt-1">{errors.quantity.message}</p>
            )}
          </div>
          <div>
            <label htmlFor="unit_price" className="text-xs font-medium text-muted-foreground mb-1 block">
              Birim Fiyat (TL/kg) *
            </label>
            <Input
              id="unit_price"
              type="number"
              step="0.01"
              {...register("unit_price")}
              placeholder="0.00"
              className="rounded-xl bg-muted border-0 h-12"
            />
            {errors.unit_price && (
              <p className="text-sm text-destructive mt-1">{errors.unit_price.message}</p>
            )}
          </div>
        </div>

        {/* Toplam Tutar */}
        <div className="rounded-xl bg-primary/10 p-4 text-center">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Toplam Tutar</p>
          <p className="text-2xl font-extrabold text-primary">{formatCurrency(totalAmount)}</p>
        </div>

        {/* Tarihler */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="sale_date" className="text-xs font-medium text-muted-foreground mb-1 block">
              Satış Tarihi *
            </label>
            <Input
              id="sale_date"
              type="date"
              {...register("sale_date")}
              className="rounded-xl bg-muted border-0 h-12"
            />
            {errors.sale_date && (
              <p className="text-sm text-destructive mt-1">{errors.sale_date.message}</p>
            )}
          </div>
          <div>
            <label htmlFor="due_date" className="text-xs font-medium text-muted-foreground mb-1 block">
              Tahsilat Vadesi
            </label>
            <Input
              id="due_date"
              type="date"
              {...register("due_date")}
              className="rounded-xl bg-muted border-0 h-12"
            />
          </div>
        </div>

        {/* Notlar */}
        <div>
          <label htmlFor="notes" className="text-xs font-medium text-muted-foreground mb-1 block">
            Notlar
          </label>
          <Textarea
            id="notes"
            {...register("notes")}
            placeholder="Ek notlar..."
            rows={2}
            className="rounded-xl bg-muted border-0"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={createSale.isPending}
          className="bg-primary rounded-xl py-4 w-full text-sm font-semibold text-white disabled:opacity-50 transition-colors"
        >
          {createSale.isPending ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Kaydediliyor...
            </span>
          ) : (
            "Kaydet"
          )}
        </button>
      </form>
    </div>
  );
}
