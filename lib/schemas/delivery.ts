import { z } from "zod";

export const deliverySchema = z.object({
  delivery_date: z.string().min(1, "Teslimat tarihi giriniz"),
  ticket_no: z.string().optional().or(z.literal("")),
  gross_weight: z.string().optional().or(z.literal("")),
  tare_weight: z.string().optional().or(z.literal("")),
  net_weight: z.string().min(1, "Net ağırlık giriniz"),
  vehicle_plate: z.string().optional().or(z.literal("")),
  driver_name: z.string().optional().or(z.literal("")),
  carrier_name: z.string().optional().or(z.literal("")),
  freight_cost: z.string().optional().or(z.literal("")),
  freight_payer: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

export type DeliveryFormValues = z.infer<typeof deliverySchema>;
