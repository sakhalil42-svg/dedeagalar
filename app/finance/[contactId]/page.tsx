"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import {
  useAccountByContact,
  useAccountTransactions,
} from "@/lib/hooks/use-account-transactions";
import { useContact } from "@/lib/hooks/use-contacts";
import {
  useDeliveriesByContact,
  usePaymentsByContact,
} from "@/lib/hooks/use-deliveries-by-contact";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Loader2,
  ArrowUpRight,
  ArrowDownLeft,
  Download,
  Truck,
  Banknote,
  Building2,
  FileText,
  ScrollText,
} from "lucide-react";
import { formatCurrency, formatDateShort } from "@/lib/utils/format";
import { useBalanceVisibility } from "@/lib/contexts/balance-visibility";
import { generateContactPdf } from "@/lib/utils/pdf-export";

const FREIGHT_PAYER_LABELS: Record<string, string> = {
  customer: "Müşteri",
  supplier: "Üretici",
  me: "Firma",
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Nakit",
  bank_transfer: "Havale",
  check: "Çek",
  promissory_note: "Senet",
};

const METHOD_ICONS: Record<string, typeof Banknote> = {
  cash: Banknote,
  bank_transfer: Building2,
  check: FileText,
  promissory_note: ScrollText,
};

function safeNum(val: unknown): number {
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

export default function AccountDetailPage() {
  const { contactId } = useParams<{ contactId: string }>();
  const { data: contact, isLoading: contactLoading } = useContact(contactId);
  const { data: account, isLoading: accountLoading } =
    useAccountByContact(contactId);
  const { data: transactions, isLoading: txLoading } = useAccountTransactions(
    account?.id || ""
  );
  const { data: deliveries, isLoading: delLoading } =
    useDeliveriesByContact(contactId);
  const { data: payments, isLoading: payLoading } =
    usePaymentsByContact(contactId);

  const isLoading = contactLoading || accountLoading;
  const { isVisible } = useBalanceVisibility();
  const masked = (amount: number) =>
    isVisible ? formatCurrency(amount) : "••••••";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!contact || !account) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Hesap bulunamadı.
      </div>
    );
  }

  // ── Calculate Borç / Alacak from transactions (NaN-safe) ──
  const txList = transactions || [];
  const borc = txList.reduce((sum, t) => {
    const amt = safeNum(t.amount);
    return amt > 0 ? sum + amt : sum;
  }, 0);
  const alacak = txList.reduce((sum, t) => {
    const amt = safeNum(t.amount);
    return amt < 0 ? sum + Math.abs(amt) : sum;
  }, 0);
  const bakiye = borc - alacak;

  // ── Delivery summary ──
  const deliverySummary = (deliveries || []).reduce(
    (acc, d) => ({
      totalKg: acc.totalKg + safeNum(d.net_weight),
      totalAmount: acc.totalAmount + safeNum(d.total_amount),
      count: acc.count + 1,
    }),
    { totalKg: 0, totalAmount: 0, count: 0 }
  );

  const totalPaid = (payments || []).reduce(
    (acc, p) => acc + safeNum(p.amount),
    0
  );

  function handleDownloadPdf() {
    if (!contact || !account) return;
    generateContactPdf({
      contactName: contact.name,
      contactType: contact.type,
      deliveries: deliveries || [],
      payments: payments || [],
      balance: bakiye,
      totalDebit: borc,
      totalCredit: alacak,
    });
  }

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/finance">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold">{contact.name}</h1>
            <p className="text-sm text-muted-foreground">
              Cari Hesap Detayı
            </p>
          </div>
        </div>
      </div>

      {/* Balance summary — 3 columns */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Borç</p>
              <p className="text-sm font-bold text-red-600">
                {masked(borc)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Alacak</p>
              <p className="text-sm font-bold text-green-600">
                {masked(alacak)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Bakiye</p>
              <p
                className={`text-sm font-bold ${
                  bakiye > 0 ? "text-red-600" : "text-green-600"
                }`}
              >
                {masked(bakiye)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-2">
        <Button size="sm" asChild>
          <Link href={`/finance/payments/new?contact_id=${contactId}`}>
            Ödeme / Tahsilat Ekle
          </Link>
        </Button>
        <Button size="sm" variant="outline" onClick={handleDownloadPdf}>
          <Download className="mr-1 h-4 w-4" />
          PDF
        </Button>
      </div>

      {/* ── Sevkiyatlar ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Truck className="h-4 w-4" />
            Sevkiyatlar ({deliverySummary.count})
            {deliverySummary.totalKg > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                {deliverySummary.totalKg.toLocaleString("tr-TR")} kg
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-0 p-0">
          {delLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : deliveries && deliveries.length > 0 ? (
            deliveries.map((d, i) => (
              <div key={d.id}>
                {i > 0 && <Separator />}
                <div className="px-4 py-3">
                  {/* Row 1: Date + ticket + amount */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">
                        {formatDateShort(d.delivery_date)}
                      </span>
                      {d.ticket_no && (
                        <Badge variant="secondary" className="text-xs">
                          #{d.ticket_no}
                        </Badge>
                      )}
                    </div>
                    {d.total_amount > 0 && (
                      <p className="text-sm font-bold">
                        {masked(d.total_amount)}
                      </p>
                    )}
                  </div>
                  {/* Row 2: Details */}
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    {d.vehicle_plate && (
                      <span>{d.vehicle_plate}</span>
                    )}
                    {d.driver_name && (
                      <span>{d.driver_name}</span>
                    )}
                    <span>
                      {safeNum(d.net_weight).toLocaleString("tr-TR")} kg
                    </span>
                    {d.unit_price > 0 && (
                      <span>
                        {d.unit_price.toLocaleString("tr-TR", {
                          minimumFractionDigits: 2,
                        })}{" "}
                        ₺/kg
                      </span>
                    )}
                    {d.freight_cost && safeNum(d.freight_cost) > 0 && (
                      <span>
                        Nakliye: {formatCurrency(safeNum(d.freight_cost))} (
                        {FREIGHT_PAYER_LABELS[d.freight_payer || "me"]})
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Henüz sevkiyat yok.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Ödemeler ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Banknote className="h-4 w-4" />
            Ödemeler
            {totalPaid > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                Toplam: {masked(totalPaid)}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-0 p-0">
          {payLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : payments && payments.length > 0 ? (
            payments.map((p, i) => {
              const MethodIcon = METHOD_ICONS[p.method] || Banknote;
              return (
                <div key={p.id}>
                  {i > 0 && <Separator />}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                        p.direction === "inbound"
                          ? "bg-green-100 text-green-600"
                          : "bg-red-100 text-red-600"
                      }`}
                    >
                      <MethodIcon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">
                          {formatDateShort(p.payment_date)}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {PAYMENT_METHOD_LABELS[p.method] || p.method}
                        </Badge>
                      </div>
                      {p.description && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {p.description}
                        </p>
                      )}
                    </div>
                    <p
                      className={`text-sm font-bold ${
                        p.direction === "inbound"
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {p.direction === "inbound" ? "+" : "-"}
                      {masked(safeNum(p.amount))}
                    </p>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Henüz ödeme yok.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Hesap Hareketleri ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Hesap Hareketleri</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0 p-0">
          {txLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : txList.length > 0 ? (
            txList.map((tx, i) => {
              const amt = safeNum(tx.amount);
              const isDebit = tx.type === "debit" || amt > 0;
              return (
                <div key={tx.id}>
                  {i > 0 && <Separator />}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                        isDebit
                          ? "bg-red-100 text-red-600"
                          : "bg-green-100 text-green-600"
                      }`}
                    >
                      {isDebit ? (
                        <ArrowUpRight className="h-4 w-4" />
                      ) : (
                        <ArrowDownLeft className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">
                          {tx.description || (isDebit ? "Borç" : "Alacak")}
                        </p>
                        {tx.reference_type && (
                          <Badge variant="secondary" className="shrink-0 text-xs">
                            {tx.reference_type === "sale" ? "Satış" : tx.reference_type === "purchase" ? "Alım" : tx.reference_type === "payment" ? "Ödeme" : tx.reference_type}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatDateShort(tx.transaction_date)}</span>
                        <span>
                          Bakiye: {masked(safeNum(tx.balance_after))}
                        </span>
                      </div>
                    </div>
                    <p
                      className={`text-sm font-bold ${
                        isDebit ? "text-red-600" : "text-green-600"
                      }`}
                    >
                      {isDebit ? "" : "-"}
                      {masked(Math.abs(amt))}
                    </p>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Henüz hareket yok.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
