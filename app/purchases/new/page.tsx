"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { purchaseSchema, type PurchaseFormValues } from "@/lib/schemas/purchase";
import { useCreatePurchase } from "@/lib/hooks/use-purchases";
import { useContacts } from "@/lib/hooks/use-contacts";
import { useFeedTypes } from "@/lib/hooks/use-feed-types";
import { useWarehouses } from "@/lib/hooks/use-warehouses";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2, Save, Truck, Scale } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils/format";

export default function NewPurchasePage() {
  const router = useRouter();
  const createPurchase = useCreatePurchase();

  const { data: contacts } = useContacts("supplier");
  const { data: feedTypes } = useFeedTypes(true);
  const { data: warehouses } = useWarehouses(true);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    control,
    formState: { errors },
  } = useForm<PurchaseFormValues>({
    resolver: zodResolver(purchaseSchema),
    defaultValues: {
      contact_id: "",
      feed_type_id: "",
      warehouse_id: "",
      quantity: "",
      unit: "kg",
      unit_price: "",
      purchase_date: new Date().toISOString().split("T")[0],
      due_date: "",
      pricing_model: "nakliye_dahil",
      notes: "",
    },
  });

  const quantity = useWatch({ control, name: "quantity" });
  const unitPrice = useWatch({ control, name: "unit_price" });
  const pricingModel = watch("pricing_model");

  const totalAmount = useMemo(() => {
    const q = parseFloat(quantity || "0");
    const p = parseFloat(unitPrice || "0");
    return q * p;
  }, [quantity, unitPrice]);

  const handleClear = () => {
    reset({
      contact_id: "",
      feed_type_id: "",
      warehouse_id: "",
      quantity: "",
      unit: "kg",
      unit_price: "",
      purchase_date: new Date().toISOString().split("T")[0],
      due_date: "",
      pricing_model: "nakliye_dahil",
      notes: "",
    });
  };

  async function onSubmit(values: PurchaseFormValues) {
    try {
      await createPurchase.mutateAsync({
        contact_id: values.contact_id,
        feed_type_id: values.feed_type_id,
        warehouse_id: values.warehouse_id || null,
        quantity: Number(values.quantity),
        unit: values.unit,
        unit_price: Number(values.unit_price),
        purchase_date: values.purchase_date,
        due_date: values.due_date || null,
        pricing_model: values.pricing_model as "nakliye_dahil" | "tir_ustu",
        notes: values.notes || null,
      });
      toast.success("Alım kaydı oluşturuldu");
      router.push("/purchases");
    } catch {
      toast.error("Alım kaydı oluşturulurken hata oluştu");
    }
  }

  return (
    <div className="p-4 page-enter">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Link
            href="/purchases"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-xl font-bold">Yeni Alım</h1>
        </div>
        <button
          type="button"
          onClick={handleClear}
          className="text-sm text-primary font-medium"
        >
          Temizle
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        {/* Üretici */}
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Üretici Seçiniz *</label>
          <Select onValueChange={(val) => setValue("contact_id", val)}>
            <SelectTrigger className="rounded-xl bg-muted border-0 h-12">
              <SelectValue placeholder="Üretici seçiniz" />
            </SelectTrigger>
            <SelectContent>
              {contacts?.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.contact_id && (
            <p className="text-xs text-destructive mt-1">{errors.contact_id.message}</p>
          )}
        </div>

        {/* Yem Türü + Fiyat */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Yem Türü *</label>
            <Select onValueChange={(val) => setValue("feed_type_id", val)}>
              <SelectTrigger className="rounded-xl bg-muted border-0 h-12">
                <SelectValue placeholder="Yem türü" />
              </SelectTrigger>
              <SelectContent>
                {feedTypes?.map((ft) => (
                  <SelectItem key={ft.id} value={ft.id}>{ft.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.feed_type_id && (
              <p className="text-xs text-destructive mt-1">{errors.feed_type_id.message}</p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Birim Fiyat *</label>
            <Input
              type="number"
              step="0.01"
              {...register("unit_price")}
              placeholder="₺/kg"
              className="rounded-xl bg-muted border-0 h-12 text-right"
            />
            {errors.unit_price && (
              <p className="text-xs text-destructive mt-1">{errors.unit_price.message}</p>
            )}
          </div>
        </div>

        {/* Fiyatlandırma modeli toggle */}
        <div className="flex items-center justify-between rounded-xl bg-muted px-4 py-3">
          <div className="flex items-center gap-2">
            <Truck className="h-4.5 w-4.5 text-muted-foreground" />
            <span className="text-sm font-medium">Fiyatlandırma</span>
          </div>
          <div className="flex gap-1 rounded-xl bg-background p-1">
            <button
              type="button"
              onClick={() => setValue("pricing_model", "nakliye_dahil")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                pricingModel === "nakliye_dahil"
                  ? "bg-primary text-white"
                  : "text-muted-foreground"
              }`}
            >
              Nakliye Dahil
            </button>
            <button
              type="button"
              onClick={() => setValue("pricing_model", "tir_ustu")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                pricingModel === "tir_ustu"
                  ? "bg-primary text-white"
                  : "text-muted-foreground"
              }`}
            >
              Tır Üstü
            </button>
          </div>
        </div>

        <div className="border-t" />

        {/* Kantar Bilgileri */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Scale className="h-4.5 w-4.5 text-primary" />
            <span className="font-semibold text-sm">Kantar Bilgileri</span>
          </div>

          {/* Tarih + Miktar */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Tarih *</label>
              <Input
                type="date"
                {...register("purchase_date")}
                className="rounded-xl bg-muted border-0 h-12"
              />
              {errors.purchase_date && (
                <p className="text-xs text-destructive mt-1">{errors.purchase_date.message}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Ödeme Vadesi</label>
              <Input
                type="date"
                {...register("due_date")}
                className="rounded-xl bg-muted border-0 h-12"
              />
            </div>
          </div>

          {/* Miktar + Birim */}
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="col-span-2">
              <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Miktar *</label>
              <Input
                type="number"
                step="0.01"
                {...register("quantity")}
                placeholder="0"
                className="rounded-xl bg-muted border-0 h-12"
              />
              {errors.quantity && (
                <p className="text-xs text-destructive mt-1">{errors.quantity.message}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Birim</label>
              <Select defaultValue="kg" onValueChange={(val) => setValue("unit", val)}>
                <SelectTrigger className="rounded-xl bg-muted border-0 h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kg">kg</SelectItem>
                  <SelectItem value="ton">ton</SelectItem>
                  <SelectItem value="balya">balya</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Toplam tutar display */}
          <div className="rounded-2xl bg-primary/10 border-2 border-primary/20 p-5 text-center mb-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Toplam Tutar</p>
            <p className="text-4xl font-extrabold text-primary">{formatCurrency(totalAmount)}</p>
          </div>
        </div>

        {/* Depo */}
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Depo (Teslim Yeri)</label>
          <Select onValueChange={(val) => setValue("warehouse_id", val)}>
            <SelectTrigger className="rounded-xl bg-muted border-0 h-12">
              <SelectValue placeholder="Depo seçiniz (opsiyonel)" />
            </SelectTrigger>
            <SelectContent>
              {warehouses?.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name} {w.location ? `(${w.location})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Notlar */}
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Notlar</label>
          <Textarea
            {...register("notes")}
            placeholder="Ek notlar..."
            rows={2}
            className="rounded-xl bg-muted border-0"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={createPurchase.isPending}
          className="w-full rounded-xl bg-primary py-4 text-base font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {createPurchase.isPending ? (
            <>
              <Loader2 className="h-4.5 w-4.5 animate-spin" />
              Kaydediliyor...
            </>
          ) : (
            <>
              <Save className="h-4.5 w-4.5" />
              Kaydet
            </>
          )}
        </button>
      </form>
    </div>
  );
}
