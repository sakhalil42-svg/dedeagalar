import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ContactType, AccountTransaction } from "@/lib/types/database.types";
import { LOGO_BASE64 } from "./logo-base64";
import { ROBOTO_REGULAR, ROBOTO_BOLD } from "./roboto-fonts";

interface PdfParams {
  contactName: string;
  contactType: ContactType;
  sevkiyatlar: AccountTransaction[];
  odemeler: AccountTransaction[];
  borc: number;
  alacak: number;
  bakiye: number;
}

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
  sevkiyatlar,
  odemeler,
  borc,
  alacak,
  bakiye,
}: PdfParams) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  setupFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const isCustomer = contactType === "customer" || contactType === "both";
  const today = new Date();
  let y = 15;

  // ══════════════════════════════════════════════════════════
  // HEADER
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

  // Contact info
  doc.setFontSize(11);
  doc.setFont("Roboto", "bold");
  const typeLabel = isCustomer ? "M\u00FC\u015Fteri" : "Tedarik\u00E7i";
  doc.text(`${typeLabel}: ${contactName}`, 14, y);
  y += 8;

  doc.setDrawColor(200, 200, 200);
  doc.line(14, y, pageWidth - 14, y);
  y += 6;

  // ══════════════════════════════════════════════════════════
  // SEVKIYATLAR TABLOSU (from account_transactions)
  // ══════════════════════════════════════════════════════════
  doc.setFontSize(12);
  doc.setFont("Roboto", "bold");
  doc.text("Sevkiyatlar / Al\u0131mlar", 14, y);
  y += 2;

  if (sevkiyatlar.length > 0) {
    const headers = ["Tarih", "A\u00E7\u0131klama", "Tutar (\u20BA)"];

    const rows = sevkiyatlar.map((tx) => [
      formatDateShortPdf(tx.transaction_date),
      tx.description || "-",
      fmt(safeNum(tx.amount)),
    ]);

    const sevkiyatTotal = sevkiyatlar.reduce(
      (s, tx) => s + safeNum(tx.amount),
      0
    );
    rows.push(["", "TOPLAM", fmt(sevkiyatTotal)]);

    autoTable(doc, {
      startY: y,
      head: [headers],
      body: rows,
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
        1: { halign: "left" },
      },
      alternateRowStyles: { fillColor: [245, 245, 245] },
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
    doc.text("Sevkiyat kayd\u0131 bulunmamaktad\u0131r.", 14, y + 3);
    y += 10;
  }

  // ══════════════════════════════════════════════════════════
  // ÖDEMELER TABLOSU (from account_transactions)
  // ══════════════════════════════════════════════════════════
  if (y > pageHeight - 80) {
    doc.addPage();
    y = 20;
  }

  doc.setFontSize(12);
  doc.setFont("Roboto", "bold");
  doc.text("\u00D6demeler", 14, y);
  y += 2;

  if (odemeler.length > 0) {
    const payHeaders = ["Tarih", "A\u00E7\u0131klama", "Tutar (\u20BA)"];
    const payRows = odemeler.map((tx) => [
      formatDateShortPdf(tx.transaction_date),
      tx.description || "-",
      fmt(safeNum(tx.amount)),
    ]);

    const odemeTotal = odemeler.reduce(
      (s, tx) => s + safeNum(tx.amount),
      0
    );
    payRows.push(["", "TOPLAM", fmt(odemeTotal)]);

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
        1: { halign: "left" },
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

  doc.setDrawColor(200, 200, 200);
  doc.line(14, y, pageWidth - 14, y);
  y += 6;

  const borcVal = safeNum(borc);
  const alacakVal = safeNum(alacak);
  const bakiyeVal = safeNum(bakiye);

  doc.setFontSize(11);
  doc.setFont("Roboto", "normal");
  doc.text("Toplam Bor\u00E7:", 14, y);
  doc.setFont("Roboto", "bold");
  doc.text(`${fmt(borcVal)} \u20BA`, pageWidth - 14, y, { align: "right" });
  y += 6;

  doc.setFont("Roboto", "normal");
  doc.text("Toplam \u00D6denen:", 14, y);
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
  const balanceLabel = bakiyeVal > 0 ? "KALAN BOR\u00C7" : "KALAN BAK\u0130YE";
  doc.text(`${balanceLabel}:`, 14, y);
  doc.text(`${fmt(Math.abs(bakiyeVal))} \u20BA`, pageWidth - 14, y, {
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

  // Save
  const safeFileName = contactName
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "_");
  const fileName = `ekstre_${safeFileName}_${today.toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}
