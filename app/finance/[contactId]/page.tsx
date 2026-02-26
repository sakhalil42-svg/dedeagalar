"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import {
  useAccountByContact,
  useAccountTransactions,
} from "@/lib/hooks/use-account-transactions";
import { useContact } from "@/lib/hooks/use-contacts";
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
} from "lucide-react";
import { formatCurrency, formatDateShort } from "@/lib/utils/format";
import { useBalanceVisibility } from "@/lib/contexts/balance-visibility";
import { generateContactPdf } from "@/lib/utils/pdf-export";
import type { AccountTransaction } from "@/lib/types/database.types";

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

  const txList = transactions || [];

  // ── Split transactions by reference_type ──
  const isCustomer = contact.type === "customer" || contact.type === "both";
  const purchaseRefType = isCustomer ? "sale" : "purchase";

  const sevkiyatTxs = txList.filter(
    (t) => t.reference_type === purchaseRefType
  );
  const odemeTxs = txList.filter((t) => t.reference_type === "payment");

  // ── Borç/Alacak from transactions ──
  // credit = tedarikçiye borcumuz (alım)
  // debit = ödediğimiz (ödeme)
  const borc = txList.reduce((sum, t) => {
    return t.type === "credit" ? sum + safeNum(t.amount) : sum;
  }, 0);
  const alacak = txList.reduce((sum, t) => {
    return t.type === "debit" ? sum + safeNum(t.amount) : sum;
  }, 0);
  // Bakiye from accounts table (always correct, DB trigger updates it)
  const bakiye = safeNum(account.balance);

  const sevkiyatTotal = sevkiyatTxs.reduce(
    (sum, t) => sum + safeNum(t.amount),
    0
  );
  const odemeTotal = odemeTxs.reduce(
    (sum, t) => sum + safeNum(t.amount),
    0
  );

  function handleDownloadPdf() {
    if (!contact || !account) return;
    generateContactPdf({
      contactName: contact.name,
      contactType: contact.type,
      sevkiyatlar: sevkiyatTxs,
      odemeler: odemeTxs,
      borc,
      alacak,
      bakiye,
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
              <p className="text-xs text-muted-foreground">Ödenen</p>
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

      {/* ── Sevkiyatlar (from account_transactions) ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Truck className="h-4 w-4" />
            Sevkiyatlar ({sevkiyatTxs.length})
            {sevkiyatTotal > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                Toplam: {masked(sevkiyatTotal)}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-0 p-0">
          {txLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : sevkiyatTxs.length > 0 ? (
            sevkiyatTxs.map((tx, i) => (
              <div key={tx.id}>
                {i > 0 && <Separator />}
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">
                      {formatDateShort(tx.transaction_date)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {tx.description || "Sevkiyat"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">
                      {masked(safeNum(tx.amount))}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Bakiye: {masked(safeNum(tx.balance_after))}
                    </p>
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

      {/* ── Ödemeler (from account_transactions) ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Banknote className="h-4 w-4" />
            Ödemeler ({odemeTxs.length})
            {odemeTotal > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                Toplam: {masked(odemeTotal)}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-0 p-0">
          {txLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : odemeTxs.length > 0 ? (
            odemeTxs.map((tx, i) => (
              <div key={tx.id}>
                {i > 0 && <Separator />}
                <div className="flex items-center gap-3 px-4 py-3">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600"
                  >
                    <ArrowDownLeft className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {formatDateShort(tx.transaction_date)}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {tx.description || "Ödeme"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-green-600">
                      {masked(safeNum(tx.amount))}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Bakiye: {masked(safeNum(tx.balance_after))}
                    </p>
                  </div>
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

      {/* ── Tüm Hesap Hareketleri ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Tüm Hareketler</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0 p-0">
          {txLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : txList.length > 0 ? (
            txList.map((tx, i) => {
              const isCredit = tx.type === "credit";
              return (
                <div key={tx.id}>
                  {i > 0 && <Separator />}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                        isCredit
                          ? "bg-red-100 text-red-600"
                          : "bg-green-100 text-green-600"
                      }`}
                    >
                      {isCredit ? (
                        <ArrowUpRight className="h-4 w-4" />
                      ) : (
                        <ArrowDownLeft className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">
                          {tx.description || (isCredit ? "Borç" : "Ödeme")}
                        </p>
                        {tx.reference_type && (
                          <Badge variant="secondary" className="shrink-0 text-xs">
                            {tx.reference_type === "sale"
                              ? "Satış"
                              : tx.reference_type === "purchase"
                                ? "Alım"
                                : tx.reference_type === "payment"
                                  ? "Ödeme"
                                  : tx.reference_type}
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
                        isCredit ? "text-red-600" : "text-green-600"
                      }`}
                    >
                      {isCredit ? "+" : "-"}
                      {masked(safeNum(tx.amount))}
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
