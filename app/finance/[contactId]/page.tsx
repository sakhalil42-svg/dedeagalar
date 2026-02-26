"use client";

import { useMemo } from "react";
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
  MessageCircle,
} from "lucide-react";
import { formatCurrency, formatDateShort, formatWeight } from "@/lib/utils/format";
import { useBalanceVisibility } from "@/lib/contexts/balance-visibility";
import { generateContactPdf } from "@/lib/utils/pdf-export";
import { openWhatsAppMessage, buildOdemeHatirlatmaMessage, buildEkstreMessage } from "@/lib/utils/whatsapp";
import { useDeliveriesForTransactions } from "@/lib/hooks/use-deliveries-for-transactions";
import type { AccountTransaction, Delivery } from "@/lib/types/database.types";

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

  const isCustomer = contact?.type === "customer" || contact?.type === "both";

  const txList = transactions || [];

  // Split transactions by reference_type
  const sevkiyatTxs = useMemo(() => {
    const purchaseRefType = isCustomer ? "sale" : "purchase";
    return txList.filter((t) => t.reference_type === purchaseRefType);
  }, [txList, isCustomer]);

  const odemeTxs = useMemo(
    () => txList.filter((t) => t.reference_type === "payment"),
    [txList]
  );

  // ALL hooks must be called before any early return
  const { data: deliveryMap } = useDeliveriesForTransactions(sevkiyatTxs, isCustomer);

  const getDelivery = (tx: AccountTransaction): Delivery | undefined => {
    if (!deliveryMap || !tx.reference_id) return undefined;
    return deliveryMap.get(tx.reference_id);
  };

  // Borç/Alacak from transactions
  const anaKalem = useMemo(() => {
    const matchType = isCustomer ? "debit" : "credit";
    return txList.reduce(
      (sum, t) => (t.type === matchType ? sum + safeNum(t.amount) : sum),
      0
    );
  }, [txList, isCustomer]);

  const odenenKalem = useMemo(() => {
    const matchType = isCustomer ? "credit" : "debit";
    return txList.reduce(
      (sum, t) => (t.type === matchType ? sum + safeNum(t.amount) : sum),
      0
    );
  }, [txList, isCustomer]);

  const bakiye = safeNum(account?.balance);

  const sevkiyatTotal = useMemo(
    () => sevkiyatTxs.reduce((sum, t) => sum + safeNum(t.amount), 0),
    [sevkiyatTxs]
  );

  const odemeTotal = useMemo(
    () => odemeTxs.reduce((sum, t) => sum + safeNum(t.amount), 0),
    [odemeTxs]
  );

  // ── Early returns AFTER all hooks ──

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

  function handleDownloadPdf() {
    if (!contact || !account) return;
    generateContactPdf({
      contactName: contact.name,
      contactPhone: contact.phone,
      contactType: contact.type,
      sevkiyatlar: sevkiyatTxs,
      odemeler: odemeTxs,
      deliveryMap: deliveryMap || undefined,
      anaKalem,
      odenenKalem,
      bakiye,
    });
  }

  function handleWhatsAppEkstre() {
    if (!contact) return;
    openWhatsAppMessage(
      contact.phone,
      buildEkstreMessage({ contactName: contact.name })
    );
  }

  function handleWhatsAppHatirlatma() {
    if (!contact) return;
    openWhatsAppMessage(
      contact.phone,
      buildOdemeHatirlatmaMessage({
        contactName: contact.name,
        balance: bakiye,
      })
    );
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
            <h1 className="text-xl font-bold">{contact.name || ""}</h1>
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
              <p className="text-xs text-muted-foreground">
                {isCustomer ? "Alacak" : "Borç"}
              </p>
              <p className="text-sm font-bold text-red-600">
                {masked(anaKalem)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                {isCustomer ? "Tahsil Edilen" : "Ödenen"}
              </p>
              <p className="text-sm font-bold text-green-600">
                {masked(odenenKalem)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                {isCustomer
                  ? (bakiye > 0 ? "Kalan Alacak" : "Bakiye")
                  : (bakiye > 0 ? "Kalan Borç" : "Bakiye")}
              </p>
              <p
                className={`text-sm font-bold ${
                  bakiye > 0 ? "text-red-600" : "text-green-600"
                }`}
              >
                {masked(Math.abs(bakiye))}
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
        {contact.phone && bakiye > 0 && (
          <Button size="sm" variant="outline" onClick={handleWhatsAppHatirlatma} className="text-amber-600 border-amber-300 hover:bg-amber-50">
            <MessageCircle className="mr-1 h-4 w-4" />
            Hatırlat
          </Button>
        )}
        {contact.phone && (
          <Button size="sm" variant="outline" onClick={handleWhatsAppEkstre}>
            <MessageCircle className="mr-1 h-4 w-4" />
            Ekstre
          </Button>
        )}
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
            sevkiyatTxs.map((tx, i) => {
              const del = getDelivery(tx);
              return (
                <div key={tx.id}>
                  {i > 0 && <Separator />}
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">
                          {formatDateShort(tx.transaction_date || "")}
                        </p>
                        {del?.ticket_no && (
                          <Badge variant="outline" className="text-xs">
                            #{del.ticket_no}
                          </Badge>
                        )}
                      </div>
                      {del ? (
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                          {del.vehicle_plate && (
                            <span className="font-mono">{del.vehicle_plate}</span>
                          )}
                          <span>{formatWeight(safeNum(del.net_weight))}</span>
                          {del.carrier_name && (
                            <span>N: {del.carrier_name}</span>
                          )}
                          {del.freight_cost != null && safeNum(del.freight_cost) > 0 && (
                            <span>
                              Nakliye: {formatCurrency(safeNum(del.freight_cost))}
                              {del.freight_payer === "customer" ? " (müşt.)" : del.freight_payer === "supplier" ? " (ürt.)" : ""}
                            </span>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          {tx.description || "Sevkiyat"}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold">
                        {masked(safeNum(tx.amount))}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Bakiye: {masked(safeNum(tx.balance_after))}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
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
                      {formatDateShort(tx.transaction_date || "")}
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
                                  : String(tx.reference_type)}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatDateShort(tx.transaction_date || "")}</span>
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
