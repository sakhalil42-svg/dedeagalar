/**
 * Sevkiyat şablonları — localStorage'da saklanır.
 */

const LS_KEY = "sevkiyat_sablonlari";
const RECENT_KEY = "sevkiyat_sablon_recent";
const MAX_RECENT = 5;

export interface ShipmentTemplate {
  id: string;
  name: string;
  customerId: string;
  supplierId: string;
  feedTypeId: string;
  customerPrice: string;
  supplierPrice: string;
  pricingModel: "nakliye_dahil" | "tir_ustu";
  carrierName: string;
  createdAt: number;
}

export function getTemplates(): ShipmentTemplate[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export function saveTemplate(template: Omit<ShipmentTemplate, "id" | "createdAt">): ShipmentTemplate {
  const templates = getTemplates();
  const newTemplate: ShipmentTemplate = {
    ...template,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  };
  templates.push(newTemplate);
  localStorage.setItem(LS_KEY, JSON.stringify(templates));
  return newTemplate;
}

export function deleteTemplate(id: string): void {
  const templates = getTemplates().filter((t) => t.id !== id);
  localStorage.setItem(LS_KEY, JSON.stringify(templates));
  // Also remove from recent
  const recent = getRecentTemplateIds().filter((rid) => rid !== id);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
}

export function getRecentTemplateIds(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export function markTemplateUsed(id: string): void {
  let recent = getRecentTemplateIds().filter((rid) => rid !== id);
  recent.unshift(id);
  if (recent.length > MAX_RECENT) recent = recent.slice(0, MAX_RECENT);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
}

export function getTemplatesSorted(): ShipmentTemplate[] {
  const templates = getTemplates();
  const recentIds = getRecentTemplateIds();

  // Sort: recent ones first (in order), then the rest by createdAt desc
  const recentSet = new Set(recentIds);
  const recentTemplates: ShipmentTemplate[] = [];
  const otherTemplates: ShipmentTemplate[] = [];

  for (const t of templates) {
    if (recentSet.has(t.id)) {
      recentTemplates.push(t);
    } else {
      otherTemplates.push(t);
    }
  }

  // Sort recent by their position in recentIds
  recentTemplates.sort((a, b) => recentIds.indexOf(a.id) - recentIds.indexOf(b.id));
  otherTemplates.sort((a, b) => b.createdAt - a.createdAt);

  return [...recentTemplates, ...otherTemplates];
}
