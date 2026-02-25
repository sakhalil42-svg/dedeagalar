import { z } from "zod";

export const purchaseSchema = z.object({
  contact_id: z.string().min(1, "Üretici seçiniz"),
  feed_type_id: z.string().min(1, "Yem türü seçiniz"),
  warehouse_id: z.string().optional().or(z.literal("")),
  quantity: z.string().min(1, "Miktar giriniz"),
  unit: z.string().min(1, "Birim seçiniz"),
  unit_price: z.string().min(1, "Birim fiyat giriniz"),
  purchase_date: z.string().min(1, "Alım tarihi giriniz"),
  due_date: z.string().optional().or(z.literal("")),
  pricing_model: z.enum(["nakliye_dahil", "tir_ustu"]),
  notes: z.string().optional().or(z.literal("")),
});

export type PurchaseFormValues = z.infer<typeof purchaseSchema>;
