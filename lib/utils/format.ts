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

// ─── Turkish Name Capitalization ───

/**
 * Capitalize the first letter of each word using Turkish locale rules.
 * "türkcan kardeşler" → "Türkcan Kardeşler"
 * Handles i → İ and ı → I correctly.
 */
export function capitalizeWords(text: string): string {
  return text
    .toLocaleLowerCase("tr-TR")
    .replace(/(?:^|\s)\S/g, (char) => char.toLocaleUpperCase("tr-TR"));
}

// ─── Number Input Helpers (binlik nokta + ondalık virgül) ───

/**
 * Format a raw JS numeric string (decimal dot) for Turkish display in inputs.
 * Adds thousand separators (dot) and uses comma for decimal.
 *
 *   formatNumberInput("20000")    → "20.000"
 *   formatNumberInput("4.7")      → "4,7"
 *   formatNumberInput("1500000")  → "1.500.000"
 *   formatNumberInput("")         → ""
 */
export function formatNumberInput(value: string): string {
  if (!value) return "";

  // Value is stored with JS decimal dot (e.g. "4.7", "20000")
  // Remove any non-numeric except dot
  const cleaned = value.replace(/[^0-9.]/g, "");
  if (!cleaned) return "";

  const dotIdx = cleaned.indexOf(".");
  const intPart = dotIdx >= 0 ? cleaned.slice(0, dotIdx) : cleaned;
  const decPart = dotIdx >= 0 ? cleaned.slice(dotIdx + 1) : null;

  // Add thousand separators to integer part
  const formatted = (intPart || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ".");

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
 * Handle onChange for Turkish-formatted number inputs.
 * Takes raw input value (which is the formatted display string),
 * sanitizes it, and returns the JS numeric string (dot decimal).
 *
 * User types "4,7" → returns "4.7"
 * User types "4.7" (English keyboard) → returns "4.7"
 * User types "20.000" (thousand sep) → returns "20000"
 * User types "abc" → returns ""
 */
export function handleNumberChange(displayValue: string, allowDecimal: boolean = true): string {
  // Step 1: Keep only digits, dots, commas
  const filtered = displayValue.replace(/[^0-9.,]/g, "");
  if (!filtered) return "";

  if (!allowDecimal) {
    // Integer only: strip all separators
    return filtered.replace(/[.,]/g, "");
  }

  // Step 2: Find the decimal separator.
  // In Turkish formatted display, dots are thousands and comma is decimal.
  // But user might also type a dot as decimal (English keyboard).
  // Strategy: the LAST comma or dot is the decimal separator IF it has <= 2 digits after it.
  // Otherwise, treat all as thousand separators.

  // Simple approach: find if there's a comma — that's always decimal in TR
  const commaIdx = filtered.lastIndexOf(",");
  if (commaIdx >= 0) {
    // Comma is decimal separator
    const intRaw = filtered.slice(0, commaIdx).replace(/[.,]/g, "");
    const decRaw = filtered.slice(commaIdx + 1).replace(/[.,]/g, "");
    return intRaw + "." + decRaw;
  }

  // No comma — check dots
  const dots = filtered.split(".");
  if (dots.length === 1) {
    // No separators at all, plain number
    return dots[0];
  }

  // Multiple parts split by dots. The last part could be decimal.
  // Heuristic: if last part has exactly 1-2 chars AND there's only one dot,
  // treat as decimal. Otherwise all dots are thousands.
  if (dots.length === 2 && dots[1].length <= 2) {
    // Could be "4.7" or "4.70" — decimal
    return dots[0] + "." + dots[1];
  }

  // All dots are thousand separators (e.g. "20.000" or "1.500.000")
  return dots.join("");
}
