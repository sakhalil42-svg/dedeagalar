import { z } from "zod";

export const feedTypeSchema = z.object({
  name: z.string().min(2, "İsim en az 2 karakter olmalıdır"),
  description: z.string().optional().or(z.literal("")),
  is_active: z.boolean(),
});

export type FeedTypeFormValues = z.infer<typeof feedTypeSchema>;
