import { z } from "zod";

export const contactSchema = z.object({
  type: z.enum(["supplier", "customer", "both"], {
    message: "Kişi türü seçiniz",
  }),
  name: z.string().min(2, "İsim en az 2 karakter olmalıdır"),
  phone: z.string().optional().or(z.literal("")),
  email: z.string().email("Geçerli bir e-posta giriniz").optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  city: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

export type ContactFormValues = z.infer<typeof contactSchema>;
