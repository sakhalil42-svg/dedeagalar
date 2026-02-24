import { z } from "zod";

export const warehouseSchema = z.object({
  name: z.string().min(2, "İsim en az 2 karakter olmalıdır"),
  location: z.string().optional().or(z.literal("")),
  capacity: z.string().optional().or(z.literal("")),
  is_active: z.boolean(),
});

export type WarehouseFormValues = z.infer<typeof warehouseSchema>;
