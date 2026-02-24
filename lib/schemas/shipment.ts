import { z } from "zod";

export const shipmentSchema = z.object({
  carrier_name: z.string().min(2, "Nakliyeci adı giriniz"),
  carrier_phone: z.string().optional().or(z.literal("")),
  vehicle_plate: z.string().optional().or(z.literal("")),
  origin: z.string().optional().or(z.literal("")),
  destination: z.string().optional().or(z.literal("")),
  distance_km: z.string().optional().or(z.literal("")),
  loaded_quantity: z.string().min(1, "Yüklenen miktar giriniz"),
  delivered_quantity: z.string().optional().or(z.literal("")),
  transport_cost: z.string().optional().or(z.literal("")),
  cost_payer: z.string().optional().or(z.literal("")),
  shipment_date: z.string().min(1, "Nakliye tarihi giriniz"),
  delivery_date: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

export type ShipmentFormValues = z.infer<typeof shipmentSchema>;
