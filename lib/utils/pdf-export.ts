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
  bank_transfer: "Havale/EFT",
  check: "\u00C7ek",
  promissory_note: "Senet",
};

const PDF_FREIGHT_PAYER_LABELS: Record<string, string> = {
  customer: "Al\u0131c\u0131",
  supplier: "Tedarik\u00E7i",
  me: "Dedea\u011Falar Grup",
};

function safeNum(val: unknown): number {
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

function fmt(n: number): string {
  return safeNum(n).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtInt(n: number): string {
  return safeNum(n).toLocaleString("tr-TR", { maximumFractionDigits: 0 });
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

function getTableFinalY(doc: jsPDF): number {
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
    .finalY;
}

export function generateContactPdf({
  contactName,
  contactType,
  deliveries,
  payments,
  totalDebit,
  totalCredit,
}: PdfParams) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  setupFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const isCustomer = contactType === "customer" || contactType === "both";
  const today = new Date();
  let y = 15;

  // ══════════════════════════════════════════════════════════
  // HEADER: Logo + Title
  // ══════════════════════════════════════════════════════════
  const logoWidth = 60;
  const logoHeight = 30;
  doc.addImage(LOGO_BASE64, "JPEG", 14, y - 5, logoWidth, logoHeight);

  doc.setFont("Roboto", "bold");
  doc.setFontSize(16);
  doc.text("Cari Hesap Ekstresi", pageWidth - 14, y + 2, { align: "right" });

  doc.setFont("Roboto", "normal");
  doc.setFontSize(10);
  doc.text(`Tarih: ${formatDateLong(today)}`, pageWidth - 14, y + 9, {
    align: "right",
  });

  y += logoHeight + 5;

  // ── Contact info ──
  doc.setFontSize(11);
  doc.setFont("Roboto", "bold");
  const typeLabel = isCustomer ? "M\u00FC\u015Fteri" : "Tedarik\u00E7i";
  doc.text(`${typeLabel}: ${contactName}`, 14, y);
  y += 8;

  // Draw separator line
  doc.setDrawColor(200, 200, 200);
  doc.line(14, y, pageWidth - 14, y);
  y += 6;

  // ══════════════════════════════════════════════════════════
  // SEVKIYATLAR TABLOSU
  // ══════════════════════════════════════════════════════════
  if (deliveries.length > 0) {
    doc.setFontSize(12);
    doc.setFont("Roboto", "bold");
    doc.text("Sevkiyatlar", 14, y);
    y += 2;

    const headers = [
      "Tarih",
      "Fi\u015F No",
      "Plaka",
      "Net Kg",
      "Fiyat (\u20BA/kg)",
      "Mal Bedeli",
      "Nakliye",
      "Nakliye \u00D6d.",
      "Net Tutar",
    ];

    const totalKg = deliveries.reduce((s, d) => s + safeNum(d.net_weight), 0);
    const totalMalBedeli = deliveries.reduce(
      (s, d) => s + safeNum(d.total_amount),
      0
    );
    const totalFreight = deliveries.reduce(
      (s, d) => s + safeNum(d.freight_cost),
      0
    );

    // Nakliye düşümü
    const totalFreightDeduction = deliveries.reduce((s, d) => {
      const freight = safeNum(d.freight_cost);
      if (isCustomer) {
        return d.freight_payer === "customer" ? s + freight : s;
      } else {
        return d.freight_payer !== "supplier" ? s + freight : s;
      }
    }, 0);

    const rows = deliveries.map((d) => {
      const freight = safeNum(d.freight_cost);
      let netTutar = safeNum(d.total_amount);
      if (isCustomer && d.freight_payer === "customer") {
        netTutar -= freight;
      } else if (!isCustomer && d.freight_payer !== "supplier") {
        netTutar -= freight;
      }
      return [
        formatDateShortPdf(d.delivery_date),
        d.ticket_no || "-",
        d.vehicle_plate || "-",
        fmtInt(safeNum(d.net_weight)),
        fmt(safeNum(d.unit_price)),
        fmt(safeNum(d.total_amount)),
        freight > 0 ? fmt(freight) : "-",
        d.freight_payer
          ? PDF_FREIGHT_PAYER_LABELS[d.freight_payer] || d.freight_payer
          : "-",
        fmt(netTutar),
      ];
    });

    // Summary row
    const totalNet = totalMalBedeli - totalFreightDeduction;
    rows.push([
      "",
      "",
      "TOPLAM",
      fmtInt(totalKg),
      "",
      fmt(totalMalBedeli),
      totalFreight > 0 ? fmt(totalFreight) : "-",
      "",
      fmt(totalNet),
    ]);

    autoTable(doc, {
      startY: y,
      head: [headers],
      body: rows,
      theme: "grid",
      styles: {
        fontSize: 8,
        cellPadding: 2,
        halign: "right",
        font: "Roboto",
      },
      headStyles: {
        fillColor: [22, 101, 52],
        textColor: 255,
        halign: "center",
        fontStyle: "bold",
        font: "Roboto",
        fontSize: 8,
      },
      columnStyles: {
        0: { halign: "center", cellWidth: 20 },
        1: { halign: "center", cellWidth: 16 },
        2: { halign: "center", cellWidth: 20 },
        7: { halign: "center", cellWidth: 18 },
      },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      // Bold the last (summary) row
      didParseCell: (data) => {
        if (data.section === "body" && data.row.index === rows.length - 1) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [220, 230, 220];
        }
      },
      margin: { left: 14, right: 14 },
    });

    y = getTableFinalY(doc) + 8;
  } else {
    doc.setFontSize(10);
    doc.setFont("Roboto", "normal");
    doc.text("Sevkiyat kayd\u0131 bulunmamaktad\u0131r.", 14, y);
    y += 8;
  }

  // ══════════════════════════════════════════════════════════
  // ÖDEMELER TABLOSU
  // ══════════════════════════════════════════════════════════
  // Check if we need a new page
  if (y > pageHeight - 80) {
    doc.addPage();
    y = 20;
  }

  doc.setFontSize(12);
  doc.setFont("Roboto", "bold");
  doc.text("\u00D6demeler", 14, y);
  y += 2;

  if (payments.length > 0) {
    const payHeaders = ["Tarih", "Y\u00F6ntem", "A\u00E7\u0131klama", "Tutar (\u20BA)"];
    const payRows = payments.map((p) => [
      formatDateShortPdf(p.payment_date),
      PAYMENT_METHOD_LABELS[p.method] || p.method,
      p.description || "-",
      fmt(safeNum(p.amount)),
    ]);

    const totalPaid = payments.reduce((s, p) => s + safeNum(p.amount), 0);

    // Summary row
    payRows.push(["", "", "TOPLAM", fmt(totalPaid)]);

    autoTable(doc, {
      startY: y,
      head: [payHeaders],
      body: payRows,
      theme: "grid",
      styles: {
        fontSize: 9,
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
        0: { halign: "center", cellWidth: 25 },
        1: { halign: "center", cellWidth: 25 },
        2: { halign: "left" },
      },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      didParseCell: (data) => {
        if (data.section === "body" && data.row.index === payRows.length - 1) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [220, 230, 220];
        }
      },
      margin: { left: 14, right: 14 },
    });

    y = getTableFinalY(doc) + 8;
  } else {
    doc.setFontSize(10);
    doc.setFont("Roboto", "normal");
    doc.text("\u00D6deme kayd\u0131 bulunmamaktad\u0131r.", 14, y + 3);
    y += 10;
  }

  // ══════════════════════════════════════════════════════════
  // ÖZET
  // ══════════════════════════════════════════════════════════
  if (y > pageHeight - 50) {
    doc.addPage();
    y = 20;
  }

  // Separator
  doc.setDrawColor(200, 200, 200);
  doc.line(14, y, pageWidth - 14, y);
  y += 6;

  const borcVal = safeNum(totalDebit);
  const alacakVal = safeNum(totalCredit);
  const kalanBakiye = borcVal - alacakVal;

  doc.setFontSize(11);
  doc.setFont("Roboto", "normal");
  doc.text(`Toplam Bor\u00E7:`, 14, y);
  doc.setFont("Roboto", "bold");
  doc.text(`${fmt(borcVal)} \u20BA`, pageWidth - 14, y, { align: "right" });
  y += 6;

  doc.setFont("Roboto", "normal");
  doc.text(`Toplam \u00D6denen:`, 14, y);
  doc.setFont("Roboto", "bold");
  doc.text(`${fmt(alacakVal)} \u20BA`, pageWidth - 14, y, { align: "right" });
  y += 8;

  // Big balance line
  doc.setDrawColor(22, 101, 52);
  doc.setLineWidth(0.5);
  doc.line(14, y, pageWidth - 14, y);
  y += 6;

  doc.setFontSize(14);
  doc.setFont("Roboto", "bold");
  const balanceLabel = kalanBakiye > 0 ? "KALAN BOR\u00C7" : "KALAN BAK\u0130YE";
  doc.text(`${balanceLabel}:`, 14, y);
  doc.text(`${fmt(Math.abs(kalanBakiye))} \u20BA`, pageWidth - 14, y, {
    align: "right",
  });

  // ══════════════════════════════════════════════════════════
  // FOOTER
  // ══════════════════════════════════════════════════════════
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
