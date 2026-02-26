import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ContactType } from "@/lib/types/database.types";
import type { DeliveryWithPrice } from "@/lib/hooks/use-deliveries-by-contact";
import { formatDateShort } from "./format";
import { LOGO_BASE64 } from "./logo-base64";

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
  check: "Cek",
  promissory_note: "Senet",
};

const FREIGHT_PAYER_LABELS: Record<string, string> = {
  customer: "Musteri",
  supplier: "Uretici",
  me: "Ben",
};

function fmt(n: number): string {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtInt(n: number): string {
  return n.toLocaleString("tr-TR", { maximumFractionDigits: 0 });
}

export function generateContactPdf({
  contactName,
  contactType,
  deliveries,
  payments,
  balance,
}: PdfParams) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  // ── Header with logo ──
  const logoWidth = 50;
  const logoHeight = 25;
  doc.addImage(LOGO_BASE64, "JPEG", 14, y - 5, logoWidth, logoHeight);

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text("Cari Hesap Ekstresi", pageWidth - 14, y + 5, { align: "right" });
  y += logoHeight + 5;

  // ── Contact info ──
  doc.setFontSize(10);
  const typeLabel =
    contactType === "customer"
      ? "Musteri"
      : contactType === "supplier"
        ? "Uretici"
        : "Musteri/Uretici";
  doc.text(`${typeLabel}: ${contactName}`, 14, y);
  y += 5;

  const today = new Date();
  doc.text(
    `Tarih: ${today.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" })}`,
    14,
    y
  );
  y += 8;

  // ── Sevkiyatlar tablosu ──
  if (deliveries.length > 0) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Sevkiyatlar:", 14, y);
    y += 2;

    // PRIVACY: Fiyat ve Tutar sütunları sadece BU kontağın fiyatını gösterir.
    // Karşı tarafın (üretici/müşteri) fiyatı, adı, kâr bilgisi KESİNLİKLE yok.
    const headers = [
      "Tarih",
      "Fis No",
      "Net (kg)",
      "Fiyat (TL/kg)",
      "Tutar (TL)",
      "Nakliye (TL)",
      "Nakliye Odeyen",
    ];

    const rows = deliveries.map((d) => [
      formatDateShort(d.delivery_date),
      d.ticket_no || "-",
      fmtInt(d.net_weight),
      fmt(d.unit_price),
      fmt(d.total_amount),
      d.freight_cost ? fmt(d.freight_cost) : "-",
      d.freight_payer
        ? FREIGHT_PAYER_LABELS[d.freight_payer] || d.freight_payer
        : "-",
    ]);

    autoTable(doc, {
      startY: y,
      head: [headers],
      body: rows,
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 2, halign: "right" },
      headStyles: { fillColor: [22, 101, 52], textColor: 255, halign: "center" },
      columnStyles: {
        0: { halign: "center" },
        1: { halign: "center" },
        6: { halign: "center" },
      },
      margin: { left: 14, right: 14 },
    });

    y =
      (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
        .finalY + 5;

    // ── Sevkiyat özeti ──
    const totalKg = deliveries.reduce((s, d) => s + d.net_weight, 0);
    const totalMalBedeli = deliveries.reduce((s, d) => s + d.total_amount, 0);
    // Müşteri nakliye ödüyorsa, müşteri faturasından nakliye düşülür
    // Üretici nakliye ödüyorsa, üretici faturasından nakliye düşülür (nakliye dahil modda)
    // PDF'de sadece bu kontağın nakliye düşümünü göster
    const isCustomer =
      contactType === "customer" || contactType === "both";
    const totalFreightDeduction = deliveries.reduce((s, d) => {
      const freight = d.freight_cost || 0;
      if (isCustomer && d.freight_payer === "customer") return s + freight;
      if (!isCustomer && d.freight_payer !== "supplier") return s + freight;
      return s;
    }, 0);
    const netAlacak = totalMalBedeli - totalFreightDeduction;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Toplam Tonaj: ${fmtInt(totalKg)} kg`, 14, y);
    y += 5;
    doc.text(`Toplam Mal Bedeli: ${fmt(totalMalBedeli)} TL`, 14, y);
    y += 5;
    if (totalFreightDeduction > 0) {
      doc.text(
        `Toplam Nakliye Dusumu: -${fmt(totalFreightDeduction)} TL`,
        14,
        y
      );
      y += 5;
    }
    doc.setFont("helvetica", "bold");
    doc.text(
      `Net ${isCustomer ? "Alacak" : "Borc"}: ${fmt(netAlacak)} TL`,
      14,
      y
    );
    y += 8;
  }

  // ── Ödemeler tablosu ──
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Odemeler:", 14, y);
  y += 2;

  if (payments.length > 0) {
    const payHeaders = ["Tarih", "Yontem", "Tutar (TL)"];
    const payRows = payments.map((p) => [
      formatDateShort(p.payment_date),
      PAYMENT_METHOD_LABELS[p.method] || p.method,
      fmt(p.amount),
    ]);

    autoTable(doc, {
      startY: y,
      head: [payHeaders],
      body: payRows,
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 2, halign: "right" },
      headStyles: { fillColor: [22, 101, 52], textColor: 255, halign: "center" },
      columnStyles: {
        0: { halign: "center" },
        1: { halign: "center" },
      },
      margin: { left: 14, right: 14 },
    });

    y =
      (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
        .finalY + 5;
  } else {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("(yok)", 14, y + 2);
    y += 7;
  }

  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Toplam Odenen: ${fmt(totalPaid)} TL`, 14, y);
  y += 10;

  // ── KALAN BAKİYE ──
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(
    `KALAN BAKIYE: ${fmt(Math.abs(balance))} TL`,
    14,
    y
  );

  // ── Save ──
  const fileName = `ekstre_${contactName.replace(/\s+/g, "_")}_${today.toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}
