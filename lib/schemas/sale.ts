import { z } from "zod";

export const saleSchema = z.object({
  contact_id: z.string().min(1, "Müşteri seçiniz"),
  feed_type_id: z.string().min(1, "Yem türü seçiniz"),
  quantity: z.string().min(1, "Miktar giriniz"),
  unit_price: z.string().min(1, "Birim fiyat giriniz"),
  sale_date: z.string().min(1, "Satış tarihi giriniz"),
  due_date: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

export type SaleFormValues = z.infer<typeof saleSchema>;
