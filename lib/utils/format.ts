import { format, parseISO } from "date-fns";
import { tr } from "date-fns/locale";

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  return format(parseISO(dateStr), "dd MMM yyyy", { locale: tr });
}

export function formatDateShort(dateStr: string): string {
  return format(parseISO(dateStr), "dd.MM.yyyy", { locale: tr });
}

export function formatWeight(kg: number): string {
  if (kg >= 1000) {
    return `${(kg / 1000).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} ton`;
  }
  return `${kg.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} kg`;
}

export function formatPercent(value: number): string {
  return `%${Math.round(value)}`;
}
