import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ContactType } from "@/lib/types/database.types";
import type { DeliveryWithPrice } from "@/lib/hooks/use-deliveries-by-contact";
import { LOGO_BASE64 } from "./logo-base64";
import { ROBOTO_REGULAR, ROBOTO_BOLD } from "./roboto-fonts";

interface PdfParams {
  contactName: string;
  contactType: ContactType;
  deliveries: DeliveryWithPrice[];
  payments: Array<{
    id: string;
    direction: string;
    method: string;
    amount: number;
    payment_date: string;
    description: string | null;
  }>;
  balance: number;
  totalDebit: number;
  totalCredit: number;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Nakit",
  transfer: "Havale",
  check: "\u00C7ek",
  promissory_note: "Senet",
};

// PDF-only kurumsal etiketler
const PDF_FREIGHT_PAYER_LABELS: Record<string, string> = {
  customer: "Al\u0131c\u0131",
  supplier: "Tedarik\u00E7i",
  me: "Dedea\u011Falar Grup",
};

function fmt(n: number): string {
  return n.toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtInt(n: number): string {
  return n.toLocaleString("tr-TR", { maximumFractionDigits: 0 });
}

function formatDateLong(date: Date): string {
  return date.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDateShortPdf(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function setupFonts(doc: jsPDF) {
  doc.addFileToVFS("Roboto-Regular.ttf", ROBOTO_REGULAR);
  doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
  doc.addFileToVFS("Roboto-Bold.ttf", ROBOTO_BOLD);
  doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");
  doc.setFont("Roboto", "normal");
}

export function generateContactPdf({
  contactName,
  contactType,
  deliveries,
  payments,
}: PdfParams) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  setupFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const isCustomer = contactType === "customer" || contactType === "both";
  let y = 15;

  // ── Header: Logo + Ba\u015Fl\u0131k ──
  const logoWidth = 60;
  const logoHeight = 30;
  doc.addImage(LOGO_BASE64, "JPEG", 14, y - 5, logoWidth, logoHeight);

  doc.setFont("Roboto", "bold");
  doc.setFontSize(16);
  doc.text("Cari Hesap Ekstresi", pageWidth - 14, y + 5, { align: "right" });

  y += logoHeight + 5;

  // ── Ki\u015Fi bilgisi ──
  doc.setFontSize(11);
  doc.setFont("Roboto", "normal");
  const typeLabel = isCustomer ? "Say\u0131n" : "Tedarik\u00E7i";
  doc.text(`${typeLabel}: ${contactName}`, 14, y);
  y += 6;

  const today = new Date();
  doc.text(`Tarih: ${formatDateLong(today)}`, 14, y);
  y += 10;

  // ── Sevkiyatlar ──
  if (deliveries.length > 0) {
    doc.setFontSize(12);
    doc.setFont("Roboto", "bold");
    doc.text("Sevkiyatlar", 14, y);
    y += 2;

    const headers = [
      "Tarih",
      "Fi\u015F No",
      "Net (kg)",
      "Fiyat (\u20BA/kg)",
      "Tutar (\u20BA)",
      "Nakliye (\u20BA)",
      "Nakliye \u00D6deyen",
    ];

    const rows = deliveries.map((d) => [
      formatDateShortPdf(d.delivery_date),
      d.ticket_no || "-",
      fmtInt(d.net_weight),
      fmt(d.unit_price),
      fmt(d.total_amount),
      d.freight_cost ? fmt(d.freight_cost) : "-",
      d.freight_payer
        ? PDF_FREIGHT_PAYER_LABELS[d.freight_payer] || d.freight_payer
        : "-",
    ]);

    autoTable(doc, {
      startY: y,
      head: [headers],
      body: rows,
      theme: "grid",
      styles: {
        fontSize: 10,
        cellPadding: 2.5,
        halign: "right",
        font: "Roboto",
      },
      headStyles: {
        fillColor: [22, 101, 52],
        textColor: 255,
        halign: "center",
        fontStyle: "bold",
        font: "Roboto",
      },
      columnStyles: {
        0: { halign: "center" },
        1: { halign: "center" },
        6: { halign: "center" },
      },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: 14, right: 14 },
    });

    y =
      (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
        .finalY + 6;

    // ── Sevkiyat \u00F6zeti ──
    const totalKg = deliveries.reduce((s, d) => s + d.net_weight, 0);
    const totalMalBedeli = deliveries.reduce(
      (s, d) => s + d.total_amount,
      0
    );

    // Nakliye d\u00FC\u015F\u00FCm\u00FC hesab\u0131:
    // M\u00FC\u015Fteri ekstresi: sadece 'customer' (Al\u0131c\u0131) \u00F6dedi\u011Fi nakliyeler d\u00FC\u015F\u00FCl\u00FCr
    // \u00DCretici ekstresi: 'customer' + 'me' \u00F6dedi\u011Fi nakliyeler d\u00FC\u015F\u00FCl\u00FCr (tedarik\u00E7i \u00F6dedi\u011Finde d\u00FC\u015F\u00FCm yok, fiyata dahil)
    const totalFreightDeduction = deliveries.reduce((s, d) => {
      const freight = d.freight_cost || 0;
      if (isCustomer) {
        // M\u00FC\u015Fteri ekstresi: sadece m\u00FC\u015Fteri \u00F6dedi\u011Fi nakliye d\u00FC\u015F\u00FCl\u00FCr
        return d.freight_payer === "customer" ? s + freight : s;
      } else {
        // \u00DCretici ekstresi: tedarik\u00E7i hari\u00E7 hepsi d\u00FC\u015F\u00FCl\u00FCr
        return d.freight_payer !== "supplier" ? s + freight : s;
      }
    }, 0);
    const netAmount = totalMalBedeli - totalFreightDeduction;

    doc.setFontSize(10);
    doc.setFont("Roboto", "normal");
    doc.text(`Toplam Tonaj: ${fmtInt(totalKg)} kg`, 14, y);
    y += 5;
    doc.text(
      `Toplam Mal Bedeli: ${fmt(totalMalBedeli)} \u20BA`,
      14,
      y
    );
    y += 5;
    if (totalFreightDeduction > 0) {
      doc.text(
        `Nakliye D\u00FC\u015F\u00FCm\u00FC: -${fmt(totalFreightDeduction)} \u20BA`,
        14,
        y
      );
      y += 5;
    }
    doc.setFont("Roboto", "bold");
    doc.setFontSize(12);
    doc.text(
      `Net ${isCustomer ? "Alacak" : "Bor\u00E7"}: ${fmt(netAmount)} \u20BA`,
      14,
      y
    );
    y += 10;
  }

  // ── \u00D6demeler ──
  doc.setFontSize(12);
  doc.setFont("Roboto", "bold");
  doc.text("\u00D6demeler", 14, y);
  y += 2;

  if (payments.length > 0) {
    const payHeaders = ["Tarih", "Y\u00F6ntem", "Tutar (\u20BA)"];
    const payRows = payments.map((p) => [
      formatDateShortPdf(p.payment_date),
      PAYMENT_METHOD_LABELS[p.method] || p.method,
      fmt(p.amount),
    ]);

    autoTable(doc, {
      startY: y,
      head: [payHeaders],
      body: payRows,
      theme: "grid",
      styles: {
        fontSize: 10,
        cellPadding: 2.5,
        halign: "right",
        font: "Roboto",
      },
      headStyles: {
        fillColor: [22, 101, 52],
        textColor: 255,
        halign: "center",
        fontStyle: "bold",
        font: "Roboto",
      },
      columnStyles: {
        0: { halign: "center" },
        1: { halign: "center" },
      },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: 14, right: 14 },
    });

    y =
      (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
        .finalY + 6;
  } else {
    doc.setFontSize(10);
    doc.setFont("Roboto", "normal");
    doc.text("(yok)", 14, y + 3);
    y += 8;
  }

  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
  doc.setFontSize(10);
  doc.setFont("Roboto", "normal");
  doc.text(`Toplam \u00D6denen: ${fmt(totalPaid)} \u20BA`, 14, y);
  y += 10;

  // ── KALAN BAK\u0130YE ──
  // = Net Alacak/Bor\u00E7 - Toplam \u00D6denen
  const totalMalBedeli = deliveries.reduce(
    (s, d) => s + d.total_amount,
    0
  );
  const totalFreightDed = deliveries.reduce((s, d) => {
    const freight = d.freight_cost || 0;
    if (isCustomer) {
      return d.freight_payer === "customer" ? s + freight : s;
    } else {
      return d.freight_payer !== "supplier" ? s + freight : s;
    }
  }, 0);
  const remainingBalance = totalMalBedeli - totalFreightDed - totalPaid;

  doc.setFontSize(14);
  doc.setFont("Roboto", "bold");
  doc.text(
    `KALAN BAK\u0130YE: ${fmt(remainingBalance)} \u20BA`,
    14,
    y
  );

  // ── Footer ──
  doc.setFontSize(8);
  doc.setFont("Roboto", "normal");
  doc.setTextColor(128, 128, 128);
  doc.text(
    "Bu belge Dedea\u011Falar Grup taraf\u0131ndan d\u00FCzenlenmi\u015Ftir.",
    pageWidth / 2,
    pageHeight - 10,
    { align: "center" }
  );

  // ── Save ──
  const safeFileName = contactName
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "_");
  const fileName = `ekstre_${safeFileName}_${today.toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}
