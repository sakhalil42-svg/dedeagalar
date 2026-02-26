import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/client";

// CSV export for a single table
export function downloadCSV(data: Record<string, unknown>[], filename: string) {
  if (!data || data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(","),
    ...data.map((row) =>
      headers
        .map((h) => {
          const val = row[h];
          if (val === null || val === undefined) return "";
          const str = String(val);
          // Escape commas and quotes
          if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(",")
    ),
  ];

  const blob = new Blob(["\uFEFF" + csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Full Excel export with multiple sheets
export async function exportAllToExcel() {
  const supabase = createClient();
  const wb = XLSX.utils.book_new();

  // Sheet 1: Contacts
  const { data: contacts } = await supabase
    .from("contacts")
    .select("name, type, phone, city, address, notes")
    .order("name");
  if (contacts && contacts.length > 0) {
    const ws = XLSX.utils.json_to_sheet(
      contacts.map((c) => ({
        Ad: c.name,
        Tür: c.type === "customer" ? "Müşteri" : c.type === "supplier" ? "Üretici" : "Her İkisi",
        Telefon: c.phone || "",
        Şehir: c.city || "",
        Adres: c.address || "",
        Not: c.notes || "",
      }))
    );
    XLSX.utils.book_append_sheet(wb, ws, "Kişiler");
  }

  // Sheet 2: Deliveries
  const { data: deliveries } = await supabase
    .from("deliveries")
    .select("delivery_date, net_weight, vehicle_plate, ticket_no, driver_name, carrier_name, freight_cost, freight_payer, sale_id")
    .is("deleted_at", null)
    .order("delivery_date", { ascending: false });
  if (deliveries && deliveries.length > 0) {
    const ws = XLSX.utils.json_to_sheet(
      deliveries.map((d) => ({
        Tarih: d.delivery_date,
        "Net Ağırlık (kg)": d.net_weight,
        Plaka: d.vehicle_plate || "",
        "Fiş No": d.ticket_no || "",
        Şoför: d.driver_name || "",
        Nakliyeci: d.carrier_name || "",
        "Nakliye Ücreti": d.freight_cost || 0,
        "Nakliye Ödeyen": d.freight_payer === "customer" ? "Müşteri" : d.freight_payer === "supplier" ? "Üretici" : d.freight_payer === "me" ? "Ben" : "",
      }))
    );
    XLSX.utils.book_append_sheet(wb, ws, "Sevkiyatlar");
  }

  // Sheet 3: Account Transactions
  const { data: accTx } = await supabase
    .from("account_transactions")
    .select("transaction_date, type, amount, description, reference_type")
    .is("deleted_at", null)
    .order("transaction_date", { ascending: false });
  if (accTx && accTx.length > 0) {
    const ws = XLSX.utils.json_to_sheet(
      accTx.map((t) => ({
        Tarih: t.transaction_date,
        Tür: t.type === "debit" ? "Borç" : "Alacak",
        Tutar: t.amount,
        Açıklama: t.description || "",
        Referans: t.reference_type || "",
      }))
    );
    XLSX.utils.book_append_sheet(wb, ws, "Hesap İşlemleri");
  }

  // Sheet 4: Checks
  const { data: checks } = await supabase
    .from("checks")
    .select("type, serial_no, bank_name, amount, due_date, status, direction")
    .is("deleted_at", null)
    .order("due_date", { ascending: false });
  if (checks && checks.length > 0) {
    const ws = XLSX.utils.json_to_sheet(
      checks.map((c) => ({
        Tür: c.type === "check" ? "Çek" : "Senet",
        "Seri No": c.serial_no || "",
        Banka: c.bank_name || "",
        Tutar: c.amount,
        "Vade Tarihi": c.due_date,
        Durum: c.status,
        Yön: c.direction === "received" ? "Alınan" : "Verilen",
      }))
    );
    XLSX.utils.book_append_sheet(wb, ws, "Çek-Senet");
  }

  // Sheet 5: Carriers
  const { data: carriers } = await supabase
    .from("carriers")
    .select("name, phone")
    .eq("is_active", true)
    .order("name");
  if (carriers && carriers.length > 0) {
    const ws = XLSX.utils.json_to_sheet(
      carriers.map((c) => ({
        Ad: c.name,
        Telefon: c.phone || "",
      }))
    );
    XLSX.utils.book_append_sheet(wb, ws, "Nakliyeciler");
  }

  // Sheet 6: Carrier Transactions
  const { data: carrierTx } = await supabase
    .from("carrier_transactions")
    .select("transaction_date, type, amount, description")
    .is("deleted_at", null)
    .order("transaction_date", { ascending: false });
  if (carrierTx && carrierTx.length > 0) {
    const ws = XLSX.utils.json_to_sheet(
      carrierTx.map((t) => ({
        Tarih: t.transaction_date,
        Tür: t.type === "freight_charge" ? "Nakliye Borcu" : "Ödeme",
        Tutar: t.amount,
        Açıklama: t.description || "",
      }))
    );
    XLSX.utils.book_append_sheet(wb, ws, "Nakliyeci İşlemleri");
  }

  // Sheet 7: Vehicles
  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("plate, driver_name, driver_phone, carrier_id")
    .neq("is_active", false)
    .order("plate");
  if (vehicles && vehicles.length > 0) {
    const ws = XLSX.utils.json_to_sheet(
      vehicles.map((v) => ({
        Plaka: v.plate,
        Şoför: v.driver_name || "",
        "Şoför Tel": v.driver_phone || "",
      }))
    );
    XLSX.utils.book_append_sheet(wb, ws, "Araçlar");
  }

  // Generate filename with date
  const today = new Date().toISOString().split("T")[0];
  const filename = `Dedeagalar_Yedek_${today}.xlsx`;

  XLSX.writeFile(wb, filename);
  return filename;
}

// Single table CSV exports
export async function exportContactsCSV() {
  const supabase = createClient();
  const { data } = await supabase.from("contacts").select("name, type, phone, city, address, notes").order("name");
  if (data) downloadCSV(data, "Kisiler.csv");
}

export async function exportDeliveriesCSV() {
  const supabase = createClient();
  const { data } = await supabase.from("deliveries").select("delivery_date, net_weight, vehicle_plate, ticket_no, driver_name, carrier_name, freight_cost, freight_payer").is("deleted_at", null).order("delivery_date", { ascending: false });
  if (data) downloadCSV(data, "Sevkiyatlar.csv");
}

export async function exportChecksCSV() {
  const supabase = createClient();
  const { data } = await supabase.from("checks").select("type, serial_no, bank_name, amount, due_date, status, direction").is("deleted_at", null).order("due_date", { ascending: false });
  if (data) downloadCSV(data, "Cek_Senet.csv");
}

export async function exportCarriersCSV() {
  const supabase = createClient();
  const { data } = await supabase.from("carriers").select("name, phone").eq("is_active", true).order("name");
  if (data) downloadCSV(data, "Nakliyeciler.csv");
}

export async function exportVehiclesCSV() {
  const supabase = createClient();
  const { data } = await supabase.from("vehicles").select("plate, driver_name, driver_phone").neq("is_active", false).order("plate");
  if (data) downloadCSV(data, "Araclar.csv");
}
