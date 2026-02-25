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
    <div className="p-4">
      <div className="mb-4 flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/purchases">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-xl font-bold">Yeni Alım</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Alım Bilgileri</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Üretici *</Label>
              <Select onValueChange={(val) => setValue("contact_id", val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Üretici seçiniz" />
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

            {/* Pricing Model */}
            <div className="space-y-2">
              <Label>Fiyatlandırma Modeli</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setValue("pricing_model", "nakliye_dahil")}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    pricingModel === "nakliye_dahil"
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground hover:bg-muted"
                  }`}
                >
                  Nakliye Dahil
                </button>
                <button
                  type="button"
                  onClick={() => setValue("pricing_model", "tir_ustu")}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    pricingModel === "tir_ustu"
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground hover:bg-muted"
                  }`}
                >
                  Tır Üstü
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="quantity">Miktar *</Label>
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
                <Label>Birim</Label>
                <Select
                  defaultValue="kg"
                  onValueChange={(val) => setValue("unit", val)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="ton">ton</SelectItem>
                    <SelectItem value="balya">balya</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit_price">Birim Fiyat *</Label>
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

            <div className="space-y-2">
              <Label>Depo (Teslim Yeri)</Label>
              <Select onValueChange={(val) => setValue("warehouse_id", val)}>
                <SelectTrigger>
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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="purchase_date">Alım Tarihi *</Label>
                <Input
                  id="purchase_date"
                  type="date"
                  {...register("purchase_date")}
                />
                {errors.purchase_date && (
                  <p className="text-sm text-destructive">{errors.purchase_date.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="due_date">Ödeme Vadesi</Label>
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
              disabled={createPurchase.isPending}
            >
              {createPurchase.isPending ? (
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
