import { z } from "zod";

const positiveNumber = (msg: string) =>
  z.string().min(1, msg).refine(
    (v) => { const n = parseFloat(v); return !isNaN(n) && n > 0; },
    "Geçerli bir pozitif sayı giriniz"
  );

const optionalPositiveNumber = z.string().optional().or(z.literal("")).refine(
  (v) => !v || (() => { const n = parseFloat(v); return !isNaN(n) && n > 0; })(),
  "Geçerli bir pozitif sayı giriniz"
);

export const deliverySchema = z.object({
  delivery_date: z.string().min(1, "Teslimat tarihi giriniz"),
  ticket_no: z.string().optional().or(z.literal("")),
  gross_weight: optionalPositiveNumber,
  tare_weight: optionalPositiveNumber,
  net_weight: positiveNumber("Net ağırlık giriniz"),
  vehicle_plate: z.string().optional().or(z.literal("")),
  driver_name: z.string().optional().or(z.literal("")),
  carrier_name: z.string().optional().or(z.literal("")),
  freight_cost: optionalPositiveNumber,
  freight_payer: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

export type DeliveryFormValues = z.infer<typeof deliverySchema>;
