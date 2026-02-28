import { formatCurrency, formatDateShort } from "@/lib/utils/format";

// ═══════════════════════════════════════════════════════════
// WhatsApp Business İletişim Utility
// ═══════════════════════════════════════════════════════════

/**
 * Format a Turkish phone number for WhatsApp (wa.me) link.
 * 0532... → 90532...
 * 532...  → 90532...
 * 90532.. → 90532..
 */
export function formatPhoneForWhatsApp(phone: string | null | undefined): string {
  const cleaned = (phone || "").replace(/\D/g, "");
  if (!cleaned) return "";
  if (cleaned.startsWith("90")) return cleaned;
  if (cleaned.startsWith("0")) return "90" + cleaned.slice(1);
  return "90" + cleaned;
}

/**
 * Open WhatsApp with a pre-filled message.
 */
export function openWhatsAppMessage(phone: string | null | undefined, message: string) {
  const whatsappPhone = formatPhoneForWhatsApp(phone);
  if (!whatsappPhone) return;
  const url = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank");
}

/**
 * Open phone dialer.
 */
export function openPhoneDialer(phone: string | null | undefined) {
  if (!phone) return;
  window.open(`tel:${phone}`, "_self");
}

// ─── Message Template Keys ───

export type TemplateKey =
  | "sevkiyat_bildirimi"
  | "odeme_hatirlatma"
  | "cek_vade_hatirlatma"
  | "ekstre_paylasim"
  | "gunluk_ozet";

// ─── Default Templates ───

const DEFAULT_TEMPLATES: Record<TemplateKey, string> = {
  sevkiyat_bildirimi:
    "Sayın {müşteri},\n{tarih} tarihinde {tonaj} kg {yem_türü} yüklenmiştir.\nPlaka: {plaka}\n{şoför}Birim Fiyat: {birim_fiyat} ₺/kg\nTutar: {tutar} ₺\n{nakliye}Dedeağalar Grup",
  odeme_hatirlatma:
    "Sayın {kişi}, güncel bakiyeniz {bakiye} tutarındadır. Ödeme planlamanız için bilgilerinize sunarız. Dedeağalar Grup",
  cek_vade_hatirlatma:
    "Sayın {kişi}, {tutar} tutarındaki {tür} (No: {seri_no}) {vade_tarihi} tarihinde vadesi dolmaktadır. Dedeağalar Grup",
  ekstre_paylasim:
    "Sayın {kişi}, cari hesap ekstreniz hazırlanmıştır. Dedeağalar Grup",
  gunluk_ozet:
    "Sayın {kişi}, {tarih} tarihli hesap özetiniz:\n\n{sevkiyatlar}\nGüncel Bakiye: {bakiye}\n\nDedeağalar Grup",
};

/**
 * Get a message template (localStorage override or default).
 */
export function getTemplate(key: TemplateKey): string {
  if (typeof window === "undefined") return DEFAULT_TEMPLATES[key];
  const stored = localStorage.getItem(`wa_template_${key}`);
  return stored || DEFAULT_TEMPLATES[key];
}

/**
 * Save a message template to localStorage.
 */
export function saveTemplate(key: TemplateKey, value: string) {
  localStorage.setItem(`wa_template_${key}`, value);
}

/**
 * Reset a template to default.
 */
export function resetTemplate(key: TemplateKey) {
  localStorage.removeItem(`wa_template_${key}`);
}

/**
 * Get all templates (with stored overrides).
 */
export function getAllTemplates(): Record<TemplateKey, string> {
  return {
    sevkiyat_bildirimi: getTemplate("sevkiyat_bildirimi"),
    odeme_hatirlatma: getTemplate("odeme_hatirlatma"),
    cek_vade_hatirlatma: getTemplate("cek_vade_hatirlatma"),
    ekstre_paylasim: getTemplate("ekstre_paylasim"),
    gunluk_ozet: getTemplate("gunluk_ozet"),
  };
}

// ─── Pre-built message generators ───

export function buildSevkiyatMessage(params: {
  customerName: string;
  date: string;
  netWeight: number;
  feedType?: string;
  plate?: string;
  driverName?: string | null;
  driverPhone?: string | null;
  unitPrice?: number;
  freightCost?: number | null;
}): string {
  const total = params.unitPrice ? params.netWeight * params.unitPrice : 0;

  // Build driver line
  let driverLine = "";
  if (params.driverName) {
    driverLine = params.driverPhone
      ? `Şoför: ${params.driverName} - ${params.driverPhone}\n`
      : `Şoför: ${params.driverName}\n`;
  }

  // Build freight line
  const freightLine = params.freightCost
    ? `Nakliye: ${params.freightCost.toLocaleString("tr-TR")} ₺\n`
    : "";

  return getTemplate("sevkiyat_bildirimi")
    .replace("{müşteri}", params.customerName)
    .replace("{tarih}", formatDateShort(params.date))
    .replace("{tonaj}", params.netWeight.toLocaleString("tr-TR"))
    .replace("{yem_türü}", params.feedType || "yem")
    .replace("{plaka}", params.plate || "-")
    .replace("{şoför}", driverLine)
    .replace("{birim_fiyat}", params.unitPrice ? params.unitPrice.toLocaleString("tr-TR") : "-")
    .replace("{tutar}", total ? total.toLocaleString("tr-TR") : "-")
    .replace("{nakliye}", freightLine);
}

export function buildOdemeHatirlatmaMessage(params: {
  contactName: string;
  balance: number;
}): string {
  return getTemplate("odeme_hatirlatma")
    .replace("{kişi}", params.contactName)
    .replace("{bakiye}", formatCurrency(Math.abs(params.balance)));
}

export function buildCekVadeMessage(params: {
  contactName: string;
  amount: number;
  type: string;
  serialNo?: string;
  dueDate: string;
}): string {
  return getTemplate("cek_vade_hatirlatma")
    .replace("{kişi}", params.contactName)
    .replace("{tutar}", formatCurrency(params.amount))
    .replace("{tür}", params.type === "check" ? "çek" : "senet")
    .replace("{seri_no}", params.serialNo || "-")
    .replace("{vade_tarihi}", formatDateShort(params.dueDate));
}

export function buildEkstreMessage(params: {
  contactName: string;
}): string {
  return getTemplate("ekstre_paylasim")
    .replace("{kişi}", params.contactName);
}

export function buildGunlukOzetMessage(params: {
  contactName: string;
  date: string;
  deliveries: { netWeight: number; feedType?: string; plate?: string }[];
  balance: number;
}): string {
  const sevkiyatLines = params.deliveries.length > 0
    ? params.deliveries.map((d, i) =>
        `${i + 1}. ${d.feedType || "Yem"} - ${d.netWeight.toLocaleString("tr-TR")} kg${d.plate ? ` (${d.plate})` : ""}`
      ).join("\n")
    : "Bugün sevkiyat yok.";

  return getTemplate("gunluk_ozet")
    .replace("{kişi}", params.contactName)
    .replace("{tarih}", formatDateShort(params.date))
    .replace("{sevkiyatlar}", sevkiyatLines)
    .replace("{bakiye}", formatCurrency(Math.abs(params.balance)));
}

/**
 * Generate a wa.me link for a given phone and message (for copy/share).
 */
export function getWhatsAppLink(phone: string | null | undefined, message: string): string {
  const whatsappPhone = formatPhoneForWhatsApp(phone);
  if (!whatsappPhone) return "";
  return `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`;
}

// ─── Template metadata for settings page ───

export const TEMPLATE_META: {
  key: TemplateKey;
  label: string;
  description: string;
  variables: string[];
}[] = [
  {
    key: "sevkiyat_bildirimi",
    label: "Sevkiyat Bildirimi",
    description: "Yeni sevkiyat kaydedildikten sonra müşteriye gönderilir",
    variables: ["{müşteri}", "{tarih}", "{tonaj}", "{yem_türü}", "{plaka}", "{şoför}", "{birim_fiyat}", "{tutar}", "{nakliye}"],
  },
  {
    key: "odeme_hatirlatma",
    label: "Ödeme Hatırlatma",
    description: "Cari hesap detayından bakiye hatırlatması için",
    variables: ["{kişi}", "{bakiye}"],
  },
  {
    key: "cek_vade_hatirlatma",
    label: "Çek/Senet Vade Hatırlatma",
    description: "Vadesi yaklaşan çek/senet için hatırlatma",
    variables: ["{kişi}", "{tutar}", "{tür}", "{seri_no}", "{vade_tarihi}"],
  },
  {
    key: "ekstre_paylasim",
    label: "Ekstre Paylaşım",
    description: "Cari hesap ekstresi ile birlikte gönderilir",
    variables: ["{kişi}"],
  },
  {
    key: "gunluk_ozet",
    label: "Günlük Hesap Özeti",
    description: "Günlük sevkiyat ve bakiye özeti mesajı",
    variables: ["{kişi}", "{tarih}", "{sevkiyatlar}", "{bakiye}"],
  },
];
