import { z } from "zod";

export const checkSchema = z.object({
  contact_id: z.string().min(1, "Kişi seçiniz"),
  check_type: z.enum(["check", "promissory_note"], { message: "Tür seçiniz" }),
  direction: z.enum(["received", "given"], { message: "Yön seçiniz" }),
  check_no: z.string().optional().or(z.literal("")),
  bank_name: z.string().optional().or(z.literal("")),
  branch_name: z.string().optional().or(z.literal("")),
  amount: z.string().min(1, "Tutar giriniz"),
  issue_date: z.string().min(1, "Düzenleme tarihi giriniz"),
  due_date: z.string().min(1, "Vade tarihi giriniz"),
  endorsed_to: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

export type CheckFormValues = z.infer<typeof checkSchema>;
