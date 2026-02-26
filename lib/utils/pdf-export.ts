import jsPDF from "jspdf";
import autoTable, { type Styles } from "jspdf-autotable";
import type { ContactType, AccountTransaction, Delivery } from "@/lib/types/database.types";
import { LOGO_BASE64 } from "./logo-base64";
import { ROBOTO_REGULAR, ROBOTO_BOLD } from "./roboto-fonts";

// ══════════════════════════════════════════════════════════
// SHARED HELPERS
// ══════════════════════════════════════════════════════════

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

function fmtKg(n: number): string {
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

function addPageNumbers(doc: jsPDF) {
  const totalPages = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("Roboto", "normal");
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 160);
    doc.text(
      `Sayfa ${i}/${totalPages}`,
      pageWidth - 14,
      pageHeight - 8,
      { align: "right" }
    );
  }
  doc.setTextColor(0, 0, 0);
}

function addHeader(
  doc: jsPDF,
  title: string,
  subtitle: string,
  dateRange?: string
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  doc.addImage(LOGO_BASE64, "JPEG", 14, y - 5, 55, 27);

  doc.setFont("Roboto", "bold");
  doc.setFontSize(14);
  doc.text(title, pageWidth - 14, y + 2, { align: "right" });

  doc.setFont("Roboto", "normal");
  doc.setFontSize(9);
  doc.text(subtitle, pageWidth - 14, y + 8, { align: "right" });

  if (dateRange) {
    doc.setFontSize(9);
    doc.text(dateRange, pageWidth - 14, y + 14, { align: "right" });
  }

  y += 30;
  return y;
}

function addFooter(doc: jsPDF) {
  const totalPages = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont("Roboto", "normal");
    doc.setTextColor(140, 140, 140);
    doc.text(
      "Bu belge Dedea\u011Falar Grup taraf\u0131ndan d\u00FCzenlenmi\u015Ftir.",
      pageWidth / 2,
      pageHeight - 12,
      { align: "center" }
    );
  }
  doc.setTextColor(0, 0, 0);
}

const GREEN = [22, 101, 52] as [number, number, number];
const ZEBRA = [248, 248, 248] as [number, number, number];
const TOTAL_BG = [220, 235, 220] as [number, number, number];

// ══════════════════════════════════════════════════════════
// 5.1 + 5.2 + 5.5 — CARİ HESAP EKSTRESİ (Gelişmiş)
// ══════════════════════════════════════════════════════════

export interface ContactPdfParams {
  contactName: string;
  contactPhone?: string | null;
  contactType: ContactType;
  sevkiyatlar: AccountTransaction[];
  odemeler: AccountTransaction[];
  deliveryMap?: Map<string, Delivery>;
  anaKalem: number;
  odenenKalem: number;
  bakiye: number;
  dateStart?: string;
  dateEnd?: string;
}

export function generateContactPdf(params: ContactPdfParams) {
  const {
    contactName,
    contactPhone,
    contactType,
    sevkiyatlar,
    odemeler,
    deliveryMap,
    anaKalem,
    odenenKalem,
    bakiye,
    dateStart,
    dateEnd,
  } = params;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  setupFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const isCustomer = contactType === "customer" || contactType === "both";
  const today = new Date();

  // Date range label
  let dateRange = `Tarih: ${formatDateLong(today)}`;
  if (dateStart && dateEnd) {
    dateRange = `D\u00F6nem: ${formatDateShortPdf(dateStart)} - ${formatDateShortPdf(dateEnd)}`;
  } else if (dateStart) {
    dateRange = `Ba\u015Flang\u0131\u00E7: ${formatDateShortPdf(dateStart)}`;
  }

  const typeLabel = isCustomer ? "M\u00FC\u015Fteri" : "Tedarik\u00E7i";
  let y = addHeader(doc, "Cari Hesap Ekstresi", `${typeLabel}: ${contactName}`, dateRange);

  // Contact phone
  if (contactPhone) {
    doc.setFont("Roboto", "normal");
    doc.setFontSize(9);
    doc.text(`Tel: ${contactPhone}`, 14, y);
    y += 4;
  }

  doc.setDrawColor(200, 200, 200);
  doc.line(14, y, pageWidth - 14, y);
  y += 5;

  // ── SEVKIYATLAR TABLOSU ──
  doc.setFontSize(11);
  doc.setFont("Roboto", "bold");
  doc.text(isCustomer ? "Sevkiyatlar" : "Al\u0131mlar", 14, y);
  y += 2;

  if (sevkiyatlar.length > 0) {
    // Build rows with delivery data
    const hasDeliveries = deliveryMap && deliveryMap.size > 0;

    let headers: string[];
    let rows: string[][];
    let colStyles: { [key: string]: Partial<Styles> };

    if (hasDeliveries && isCustomer) {
      // Müşteri: Tarih | Fiş No | Plaka | Net Kg | Birim Fiyat | Tutar | Nakliye | Net Tutar
      headers = ["Tarih", "Fi\u015F No", "Plaka", "Net Kg", "Birim Fiyat", "Tutar (\u20BA)", "Nakliye", "Net Tutar"];

      let totalKg = 0, totalAmount = 0, totalFreight = 0, totalNet = 0;

      rows = sevkiyatlar.map((tx) => {
        const del = tx.reference_id ? deliveryMap.get(tx.reference_id) : undefined;
        const amount = safeNum(tx.amount);
        const netKg = del ? safeNum(del.net_weight) : 0;
        const unitPrice = netKg > 0 ? amount / netKg : 0;
        const freight = del ? safeNum(del.freight_cost) : 0;
        const freightForMe = del?.freight_payer === "customer" ? 0 : freight;
        const netAmount = amount;

        totalKg += netKg;
        totalAmount += amount;
        totalFreight += freightForMe;
        totalNet += netAmount;

        return [
          formatDateShortPdf(tx.transaction_date),
          del?.ticket_no || "-",
          del?.vehicle_plate || "-",
          netKg > 0 ? fmtKg(netKg) : "-",
          unitPrice > 0 ? fmt(unitPrice) : "-",
          fmt(amount),
          freightForMe > 0 ? fmt(freightForMe) : "-",
          fmt(netAmount),
        ];
      });

      rows.push(["", "", "TOPLAM", fmtKg(totalKg), "", fmt(totalAmount), totalFreight > 0 ? fmt(totalFreight) : "-", fmt(totalNet)]);

      colStyles = {
        0: { halign: "center", cellWidth: 22 },
        1: { halign: "center", cellWidth: 16 },
        2: { halign: "center", cellWidth: 25 },
        3: { halign: "right", cellWidth: 22 },
        4: { halign: "right", cellWidth: 25 },
        5: { halign: "right", cellWidth: 28 },
        6: { halign: "right", cellWidth: 22 },
        7: { halign: "right", cellWidth: 28 },
      };
    } else if (hasDeliveries && !isCustomer) {
      // Tedarikçi: Tarih | Fiş No | Plaka | Yem Türü | Net Kg | Birim Fiyat | Mal Bedeli | Nakliye | Nakliye Ödeyen | Net Tutar
      headers = ["Tarih", "Fi\u015F No", "Plaka", "Net Kg", "Birim Fiyat", "Mal Bedeli", "Nakliye", "Nkl \u00D6d.", "Net Tutar"];

      let totalKg = 0, totalAmount = 0, totalFreight = 0, totalNet = 0;

      rows = sevkiyatlar.map((tx) => {
        const del = tx.reference_id ? deliveryMap.get(tx.reference_id) : undefined;
        const amount = safeNum(tx.amount);
        const netKg = del ? safeNum(del.net_weight) : 0;
        const unitPrice = netKg > 0 ? amount / netKg : 0;
        const freight = del ? safeNum(del.freight_cost) : 0;
        const freightPayer = del?.freight_payer === "customer" ? "M\u00FC\u015Ft." : del?.freight_payer === "supplier" ? "\u00DCrt." : "Biz";
        const netAmount = amount;

        totalKg += netKg;
        totalAmount += amount;
        totalFreight += freight;
        totalNet += netAmount;

        return [
          formatDateShortPdf(tx.transaction_date),
          del?.ticket_no || "-",
          del?.vehicle_plate || "-",
          netKg > 0 ? fmtKg(netKg) : "-",
          unitPrice > 0 ? fmt(unitPrice) : "-",
          fmt(amount),
          freight > 0 ? fmt(freight) : "-",
          freight > 0 ? freightPayer : "-",
          fmt(netAmount),
        ];
      });

      rows.push(["", "", "TOPLAM", fmtKg(totalKg), "", fmt(totalAmount), totalFreight > 0 ? fmt(totalFreight) : "-", "", fmt(totalNet)]);

      colStyles = {
        0: { halign: "center", cellWidth: 22 },
        1: { halign: "center", cellWidth: 15 },
        2: { halign: "center", cellWidth: 24 },
        3: { halign: "right", cellWidth: 20 },
        4: { halign: "right", cellWidth: 24 },
        5: { halign: "right", cellWidth: 26 },
        6: { halign: "right", cellWidth: 20 },
        7: { halign: "center", cellWidth: 16 },
        8: { halign: "right", cellWidth: 26 },
      };
    } else {
      // Fallback — no delivery data
      headers = ["Tarih", "A\u00E7\u0131klama", "Tutar (\u20BA)"];
      rows = sevkiyatlar.map((tx) => [
        formatDateShortPdf(tx.transaction_date),
        tx.description || "-",
        fmt(safeNum(tx.amount)),
      ]);
      const total = sevkiyatlar.reduce((s, tx) => s + safeNum(tx.amount), 0);
      rows.push(["", "TOPLAM", fmt(total)]);
      colStyles = {
        0: { halign: "center", cellWidth: 28 },
        1: { halign: "left" },
        2: { halign: "right", cellWidth: 35 },
      };
    }

    const lastRowIdx = rows.length - 1;

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
        fillColor: GREEN,
        textColor: 255,
        halign: "center",
        fontStyle: "bold",
        font: "Roboto",
        fontSize: 8,
      },
      columnStyles: colStyles,
      alternateRowStyles: { fillColor: ZEBRA },
      didParseCell: (data) => {
        if (data.section === "body" && data.row.index === lastRowIdx) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = TOTAL_BG;
        }
      },
      margin: { left: 14, right: 14 },
      showHead: "everyPage",
    });

    y = getTableFinalY(doc) + 8;
  } else {
    doc.setFontSize(9);
    doc.setFont("Roboto", "normal");
    doc.text("Sevkiyat kayd\u0131 bulunmamaktad\u0131r.", 14, y + 3);
    y += 10;
  }

  // ── ÖDEMELER TABLOSU ──
  if (y > pageHeight - 50) {
    doc.addPage();
    y = 20;
  }

  doc.setFontSize(11);
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
    const odemeTotal = odemeler.reduce((s, tx) => s + safeNum(tx.amount), 0);
    payRows.push(["", "TOPLAM", fmt(odemeTotal)]);
    const lastIdx = payRows.length - 1;

    autoTable(doc, {
      startY: y,
      head: [payHeaders],
      body: payRows,
      theme: "grid",
      styles: {
        fontSize: 8,
        cellPadding: 2,
        halign: "right",
        font: "Roboto",
      },
      headStyles: {
        fillColor: GREEN,
        textColor: 255,
        halign: "center",
        fontStyle: "bold",
        font: "Roboto",
        fontSize: 8,
      },
      columnStyles: {
        0: { halign: "center", cellWidth: 28 },
        1: { halign: "left" },
        2: { halign: "right", cellWidth: 35 },
      },
      alternateRowStyles: { fillColor: ZEBRA },
      didParseCell: (data) => {
        if (data.section === "body" && data.row.index === lastIdx) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = TOTAL_BG;
        }
      },
      margin: { left: 14, right: 14 },
      showHead: "everyPage",
    });

    y = getTableFinalY(doc) + 8;
  } else {
    doc.setFontSize(9);
    doc.setFont("Roboto", "normal");
    doc.text("\u00D6deme kayd\u0131 bulunmamaktad\u0131r.", 14, y + 3);
    y += 10;
  }

  // ── ÖZET ──
  if (y > pageHeight - 40) {
    doc.addPage();
    y = 20;
  }

  doc.setDrawColor(200, 200, 200);
  doc.line(14, y, pageWidth - 14, y);
  y += 6;

  const anaLabel = isCustomer ? "Toplam Alacak:" : "Toplam Bor\u00E7:";
  const odenenLabel = isCustomer ? "Toplam Tahsil Edilen:" : "Toplam \u00D6denen:";

  doc.setFontSize(11);
  doc.setFont("Roboto", "normal");
  doc.text(anaLabel, 14, y);
  doc.setFont("Roboto", "bold");
  doc.text(`${fmt(safeNum(anaKalem))} \u20BA`, pageWidth - 14, y, { align: "right" });
  y += 6;

  doc.setFont("Roboto", "normal");
  doc.text(odenenLabel, 14, y);
  doc.setFont("Roboto", "bold");
  doc.text(`${fmt(safeNum(odenenKalem))} \u20BA`, pageWidth - 14, y, { align: "right" });
  y += 8;

  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.5);
  doc.line(14, y, pageWidth - 14, y);
  y += 6;

  const bakiyeVal = safeNum(bakiye);
  doc.setFontSize(14);
  doc.setFont("Roboto", "bold");
  const balanceLabel = isCustomer
    ? (bakiyeVal > 0 ? "KALAN ALACAK" : "KALAN BAK\u0130YE")
    : (bakiyeVal > 0 ? "KALAN BOR\u00C7" : "KALAN BAK\u0130YE");
  doc.text(`${balanceLabel}:`, 14, y);
  doc.text(`${fmt(Math.abs(bakiyeVal))} \u20BA`, pageWidth - 14, y, { align: "right" });

  addFooter(doc);
  addPageNumbers(doc);

  const safeFileName = contactName.replace(/[^\w\s-]/g, "").replace(/\s+/g, "_");
  doc.save(`ekstre_${safeFileName}_${today.toISOString().slice(0, 10)}.pdf`);
}

// ══════════════════════════════════════════════════════════
// 5.3 — ÖDEME MAKBUZU PDF
// ══════════════════════════════════════════════════════════

export interface ReceiptPdfParams {
  receiptNo: string;
  direction: "inbound" | "outbound";
  contactName: string;
  contactPhone?: string | null;
  amount: number;
  method: string;
  paymentDate: string;
  description?: string | null;
}

function numberToTurkishWords(n: number): string {
  if (n === 0) return "s\u0131f\u0131r";
  const birler = ["", "bir", "iki", "\u00FC\u00E7", "d\u00F6rt", "be\u015F", "alt\u0131", "yedi", "sekiz", "dokuz"];
  const onlar = ["", "on", "yirmi", "otuz", "k\u0131rk", "elli", "altm\u0131\u015F", "yetmi\u015F", "seksen", "doksan"];

  const integer = Math.floor(Math.abs(n));
  const decimal = Math.round((Math.abs(n) - integer) * 100);

  let result = "";

  if (integer >= 1000000) {
    const m = Math.floor(integer / 1000000);
    result += (m > 1 ? birler[m] + " " : "") + "milyon ";
  }
  const afterMillion = integer % 1000000;

  if (afterMillion >= 1000) {
    const k = Math.floor(afterMillion / 1000);
    if (k > 1) {
      const kHundreds = Math.floor(k / 100);
      const kTens = Math.floor((k % 100) / 10);
      const kOnes = k % 10;
      if (kHundreds > 0) result += (kHundreds > 1 ? birler[kHundreds] + " " : "") + "y\u00FCz ";
      if (kTens > 0) result += onlar[kTens] + " ";
      if (kOnes > 0) result += birler[kOnes] + " ";
    }
    result += "bin ";
  }

  const remainder = afterMillion % 1000;
  const hundreds = Math.floor(remainder / 100);
  const tens = Math.floor((remainder % 100) / 10);
  const ones = remainder % 10;

  if (hundreds > 0) result += (hundreds > 1 ? birler[hundreds] + " " : "") + "y\u00FCz ";
  if (tens > 0) result += onlar[tens] + " ";
  if (ones > 0) result += birler[ones] + " ";

  result = result.trim();
  if (result) result += " TL";

  if (decimal > 0) {
    const dTens = Math.floor(decimal / 10);
    const dOnes = decimal % 10;
    let decStr = "";
    if (dTens > 0) decStr += onlar[dTens] + " ";
    if (dOnes > 0) decStr += birler[dOnes] + " ";
    result += " " + decStr.trim() + " Kuru\u015F";
  }

  return result.charAt(0).toUpperCase() + result.slice(1);
}

const METHOD_LABELS_PDF: Record<string, string> = {
  cash: "Nakit",
  bank_transfer: "Havale/EFT",
  check: "\u00C7ek",
  promissory_note: "Senet",
};

export function generateReceiptPdf(params: ReceiptPdfParams) {
  const { receiptNo, direction, contactName, amount, method, paymentDate, description } = params;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  setupFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const isInbound = direction === "inbound";
  const title = isInbound ? "TAHS\u0130LAT MAKBUZU" : "\u00D6DEME MAKBUZU";

  let y = addHeader(doc, title, `Makbuz No: ${receiptNo}`, `Tarih: ${formatDateShortPdf(paymentDate)}`);

  y += 5;
  doc.setDrawColor(200, 200, 200);
  doc.line(14, y, pageWidth - 14, y);
  y += 8;

  // Receipt details
  const leftX = 20;
  const valueX = 70;

  function addRow(label: string, value: string) {
    doc.setFont("Roboto", "normal");
    doc.setFontSize(10);
    doc.text(label, leftX, y);
    doc.setFont("Roboto", "bold");
    doc.text(value, valueX, y);
    y += 7;
  }

  addRow("Ki\u015Fi:", contactName);
  addRow("\u0130\u015Flem:", isInbound ? "Tahsilat" : "\u00D6deme");
  addRow("\u00D6deme Y\u00F6ntemi:", METHOD_LABELS_PDF[method] || method);
  addRow("Tutar:", `${fmt(amount)} \u20BA`);
  addRow("Yaz\u0131 ile:", numberToTurkishWords(amount));

  if (description) {
    addRow("A\u00E7\u0131klama:", description);
  }

  y += 10;
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.3);
  doc.line(14, y, pageWidth - 14, y);
  y += 15;

  // Signature areas
  const col1 = 50;
  const col2 = pageWidth - 50;

  doc.setFont("Roboto", "normal");
  doc.setFontSize(9);
  doc.text(isInbound ? "Tahsil Eden" : "\u00D6deyen", col1, y, { align: "center" });
  doc.text(isInbound ? "\u00D6deyen" : "Alan", col2, y, { align: "center" });

  y += 20;
  doc.setDrawColor(180, 180, 180);
  doc.line(col1 - 30, y, col1 + 30, y);
  doc.line(col2 - 30, y, col2 + 30, y);

  y += 5;
  doc.setFontSize(8);
  doc.text("\u0130mza", col1, y, { align: "center" });
  doc.text("\u0130mza", col2, y, { align: "center" });

  addFooter(doc);

  doc.save(`makbuz_${receiptNo}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ══════════════════════════════════════════════════════════
// 5.4 — KÂR/ZARAR RAPORU PDF
// ══════════════════════════════════════════════════════════

export interface ProfitPdfParams {
  dateLabel: string;
  totalSales: number;
  totalPurchases: number;
  totalFreight: number;
  grossProfit: number;
  netProfit: number;
  totalTonnage: number;
  deliveryCount: number;
}

export function generateProfitPdf(params: ProfitPdfParams) {
  const {
    dateLabel,
    totalSales,
    totalPurchases,
    totalFreight,
    grossProfit,
    netProfit,
    totalTonnage,
    deliveryCount,
  } = params;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  setupFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();

  let y = addHeader(doc, "K\u00C2R / ZARAR RAPORU", dateLabel);

  y += 5;
  doc.setDrawColor(200, 200, 200);
  doc.line(14, y, pageWidth - 14, y);
  y += 5;

  // Summary table
  const summaryRows = [
    ["Toplam Sat\u0131\u015F", `${fmt(totalSales)} \u20BA`],
    ["Toplam Al\u0131m", `${fmt(totalPurchases)} \u20BA`],
    ["Nakliye Gideri", `${fmt(totalFreight)} \u20BA`],
    ["", ""],
    ["Br\u00FCt K\u00E2r (Sat\u0131\u015F - Al\u0131m)", `${fmt(grossProfit)} \u20BA`],
    ["Net K\u00E2r (Br\u00FCt - Nakliye)", `${fmt(netProfit)} \u20BA`],
    ["", ""],
    ["Toplam Tonaj", `${(totalTonnage / 1000).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} ton`],
    ["Sevkiyat Adedi", String(deliveryCount)],
  ];

  if (totalSales > 0) {
    summaryRows.push(
      ["Br\u00FCt Marj", `%${((grossProfit / totalSales) * 100).toFixed(1)}`],
      ["Net Marj", `%${((netProfit / totalSales) * 100).toFixed(1)}`]
    );
    if (totalTonnage > 0) {
      summaryRows.push(["Ton Ba\u015F\u0131 K\u00E2r", `${fmt(netProfit / (totalTonnage / 1000))} \u20BA`]);
    }
  }

  autoTable(doc, {
    startY: y,
    body: summaryRows,
    theme: "plain",
    styles: {
      fontSize: 11,
      cellPadding: 4,
      font: "Roboto",
    },
    columnStyles: {
      0: { halign: "left", fontStyle: "normal", cellWidth: 100 },
      1: { halign: "right", fontStyle: "bold", cellWidth: 80 },
    },
    didParseCell: (data) => {
      if (data.section === "body") {
        const text = String(data.cell.raw);
        // Highlight profit rows
        if (text.includes("K\u00E2r") || text.includes("Marj")) {
          data.cell.styles.fillColor = TOTAL_BG;
        }
        // Empty separator rows
        if (!text) {
          data.cell.styles.cellPadding = 1;
        }
      }
    },
    margin: { left: 14, right: 14 },
  });

  addFooter(doc);
  addPageNumbers(doc);

  doc.save(`kar_zarar_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ══════════════════════════════════════════════════════════
// 5.6 — WHATSAPP PAYLAŞIM HELPER
// ══════════════════════════════════════════════════════════

export function openWhatsApp(phone: string | null | undefined, contactName: string) {
  const message = `Say\u0131n ${contactName}, cari hesap ekstreniz haz\u0131rlanm\u0131\u015Ft\u0131r. Dedea\u011Falar Grup`;
  const cleanPhone = (phone || "").replace(/\D/g, "");
  // Add Turkey country code if not present
  const fullPhone = cleanPhone.startsWith("90") ? cleanPhone : cleanPhone.startsWith("0") ? "90" + cleanPhone.slice(1) : "90" + cleanPhone;
  const url = `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank");
}
