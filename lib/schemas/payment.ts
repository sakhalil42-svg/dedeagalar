import { z } from "zod";

export const paymentSchema = z.object({
  contact_id: z.string().min(1, "Kişi seçiniz"),
  direction: z.enum(["inbound", "outbound"], { message: "Yön seçiniz" }),
  method: z.enum(["cash", "transfer", "check", "promissory_note"], { message: "Yöntem seçiniz" }),
  amount: z.string().min(1, "Tutar giriniz"),
  payment_date: z.string().min(1, "Tarih giriniz"),
  description: z.string().optional().or(z.literal("")),
  reference_type: z.string().optional().or(z.literal("")),
  reference_id: z.string().optional().or(z.literal("")),
});

export type PaymentFormValues = z.infer<typeof paymentSchema>;
