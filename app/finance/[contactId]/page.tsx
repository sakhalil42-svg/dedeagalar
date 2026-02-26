"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import {
  useAccountByContact,
  useAccountTransactions,
} from "@/lib/hooks/use-account-transactions";
import { useContact } from "@/lib/hooks/use-contacts";
import { useDeliveriesByContact, usePaymentsByContact, type DeliveryWithPrice } from "@/lib/hooks/use-deliveries-by-contact";
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

  const isCustomer =
    contact.type === "customer" || contact.type === "both";

  // Calculate totals from deliveries (now includes unit_price via DeliveryWithPrice)
  const deliverySummary = (deliveries || []).reduce(
    (acc, d) => {
      return {
        totalKg: acc.totalKg + d.net_weight,
        totalAmount: acc.totalAmount + d.total_amount,
        count: acc.count + 1,
      };
    },
    { totalKg: 0, totalAmount: 0, count: 0 }
  );

  const totalPaid = (payments || []).reduce(
    (acc, p) => acc + p.amount,
    0
  );

  function handleDownloadPdf() {
    if (!contact || !account) return;
    generateContactPdf({
      contactName: contact.name,
      contactType: contact.type,
      deliveries: deliveries || [],
      payments: payments || [],
      balance: account.balance,
      totalDebit: account.total_debit,
      totalCredit: account.total_credit,
    });
  }

  return (
    <div className="space-y-4 p-4">
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

      {/* Balance summary */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Borç</p>
              <p className="text-sm font-bold text-red-600">
                {masked(account.total_debit)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Alacak</p>
              <p className="text-sm font-bold text-green-600">
                {masked(account.total_credit)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Bakiye</p>
              <p
                className={`text-sm font-bold ${
                  account.balance >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {masked(account.balance)}
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
          PDF İndir
        </Button>
      </div>

      {/* Deliveries */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Sevkiyatlar ({deliverySummary.count})
            {deliverySummary.totalKg > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                Toplam:{" "}
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
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="space-y-0.5">
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
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>
                        {d.net_weight.toLocaleString("tr-TR")} kg
                      </span>
                      {d.unit_price > 0 && (
                        <span>
                          {d.unit_price.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺/kg
                        </span>
                      )}
                      {d.vehicle_plate && <span>{d.vehicle_plate}</span>}
                      {d.freight_cost && d.freight_cost > 0 && (
                        <span>
                          Nakliye: {formatCurrency(d.freight_cost)} (
                          {FREIGHT_PAYER_LABELS[d.freight_payer || "me"]})
                        </span>
                      )}
                    </div>
                  </div>
                  {d.total_amount > 0 && (
                    <p className="text-sm font-bold">
                      {masked(d.total_amount)}
                    </p>
                  )}
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

      {/* Payments */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Ödemeler
            {totalPaid > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
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
            payments.map((p, i) => (
              <div key={p.id}>
                {i > 0 && <Separator />}
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">
                      {formatDateShort(p.payment_date)}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary" className="text-xs">
                        {PAYMENT_METHOD_LABELS[p.method] || p.method}
                      </Badge>
                      {p.description && <span>{p.description}</span>}
                    </div>
                  </div>
                  <p
                    className={`text-sm font-bold ${
                      p.direction === "inbound"
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {p.direction === "inbound" ? "+" : "-"}
                    {masked(p.amount)}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Henüz ödeme yok.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Account Transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hesap Hareketleri</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0 p-0">
          {txLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : transactions && transactions.length > 0 ? (
            transactions.map((tx, i) => {
              const isDebit = tx.transaction_type === "debit";
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
                      <p className="truncate text-sm font-medium">
                        {tx.description || (isDebit ? "Borç" : "Alacak")}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatDateShort(tx.created_at)}</span>
                        <span>Bakiye: {masked(tx.balance_after)}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-sm font-bold ${
                          isDebit ? "text-red-600" : "text-green-600"
                        }`}
                      >
                        {isDebit ? "-" : "+"}
                        {masked(tx.amount)}
                      </p>
                    </div>
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
