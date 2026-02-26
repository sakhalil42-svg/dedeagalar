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

// ─── Number Input Helpers (binlik nokta + ondalık virgül) ───

/**
 * Format a raw numeric string for display in inputs.
 * Uses Turkish convention: dot as thousands separator, comma as decimal.
 *
 *   formatNumberInput("20000")    → "20.000"
 *   formatNumberInput("4.7")      → "4,7"
 *   formatNumberInput("1500000")  → "1.500.000"
 *   formatNumberInput("4,7")      → "4,7"
 *   formatNumberInput("")         → ""
 */
export function formatNumberInput(value: string): string {
  if (!value) return "";

  // Normalize: replace comma with dot for internal handling
  let normalized = value.replace(/\./g, "").replace(",", ".");

  // Remove non-numeric chars except dot
  normalized = normalized.replace(/[^0-9.]/g, "");

  // Only allow one dot
  const parts = normalized.split(".");
  if (parts.length > 2) {
    normalized = parts[0] + "." + parts.slice(1).join("");
  }

  const intPart = parts[0] || "0";
  const decPart = parts.length > 1 ? parts[1] : null;

  // Add thousands separators to integer part
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  if (decPart !== null) {
    return formatted + "," + decPart;
  }
  return formatted;
}

/**
 * Parse a formatted Turkish number string back to a JS number.
 *
 *   parseNumberInput("20.000")    → 20000
 *   parseNumberInput("4,7")       → 4.7
 *   parseNumberInput("1.500.000") → 1500000
 *   parseNumberInput("")          → 0
 */
export function parseNumberInput(formatted: string): number {
  if (!formatted) return 0;
  // Remove thousand separators (dots), replace decimal comma with dot
  const cleaned = formatted.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

/**
 * Filter input to only allow digits, comma, and dot.
 * Replaces dot with comma (Turkish decimal convention).
 * Only allows one comma.
 */
export function sanitizeNumberInput(raw: string, allowDecimal: boolean = true): string {
  // Only keep digits, comma, dot
  let filtered = raw.replace(/[^0-9.,]/g, "");

  if (!allowDecimal) {
    // Remove all commas and dots, only digits
    return filtered.replace(/[.,]/g, "");
  }

  // Replace dots with commas (user typing on English keyboard)
  // But only if it looks like a decimal separator, not thousands
  // Strategy: the last comma/dot is the decimal separator
  // For input, we just normalize any dot to comma and allow only one
  filtered = filtered.replace(/\./g, ",");

  // Only keep one comma (the first one)
  const firstComma = filtered.indexOf(",");
  if (firstComma !== -1) {
    filtered =
      filtered.slice(0, firstComma + 1) +
      filtered.slice(firstComma + 1).replace(/,/g, "");
  }

  return filtered;
}
