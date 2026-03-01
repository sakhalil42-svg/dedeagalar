import type { ContactType } from "@/lib/types/database.types";

export const TYPE_LABELS: Record<ContactType, string> = {
  supplier: "Üretici",
  customer: "Müşteri",
  both: "Üretici/Müşteri",
};

export const TYPE_COLORS: Record<ContactType, string> = {
  supplier: "bg-blue-100 text-blue-700",
  customer: "bg-emerald-100 text-emerald-700",
  both: "bg-purple-100 text-purple-700",
};

export const AVATAR_COLORS: Record<ContactType, string> = {
  supplier: "bg-blue-500",
  customer: "bg-emerald-500",
  both: "bg-purple-500",
};
