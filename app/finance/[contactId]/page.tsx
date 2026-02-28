"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  useAccountByContact,
  useAccountTransactions,
} from "@/lib/hooks/use-account-transactions";
import { useContact } from "@/lib/hooks/use-contacts";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowDownLeft,
  Download,
  Truck,
  Banknote,
  MessageCircle,
  FileText,
  Phone,
  CreditCard,
} from "lucide-react";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
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

function getInitials(name: string): string {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

type Tab = "sevkiyat" | "odeme" | "hepsi";

export default function AccountDetailPage() {
  const { contactId } = useParams<{ contactId: string }>();
  const { data: contact, isLoading: contactLoading } = useContact(contactId);
  const { data: account, isLoading: accountLoading } =
    useAccountByContact(contactId);
  const { data: transactions, isLoading: txLoading } = useAccountTransactions(
    account?.id || ""
  );

  const [activeTab, setActiveTab] = useState<Tab>("sevkiyat");

  const isLoading = contactLoading || accountLoading;
  const { isVisible } = useBalanceVisibility();
  const masked = (amount: number) =>
    isVisible ? formatCurrency(amount) : "••••••";

  const isCustomer = contact?.type === "customer" || contact?.type === "both";

  const txList = transactions || [];

  const sevkiyatTxs = useMemo(() => {
    const purchaseRefType = isCustomer ? "sale" : "purchase";
    return txList.filter((t) => t.reference_type === purchaseRefType);
  }, [txList, isCustomer]);

  const odemeTxs = useMemo(
    () => txList.filter((t) => t.reference_type === "payment"),
    [txList]
  );

  const { data: deliveryMap } = useDeliveriesForTransactions(sevkiyatTxs, isCustomer);

  const getDelivery = (tx: AccountTransaction): Delivery | undefined => {
    if (!deliveryMap || !tx.reference_id) return undefined;
    return deliveryMap.get(tx.reference_id);
  };

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

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-48" />
        <div className="rounded-2xl bg-card p-4 space-y-3 shadow-sm">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-10 w-full" />
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        </div>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (!contact || !account) {
    return (
      <EmptyState
        icon={FileText}
        title="Hesap bulunamadı"
        description="Bu kişiye ait bir cari hesap kaydı bulunamadı."
        actionLabel="Finansa Dön"
        actionHref="/finance"
      />
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

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "sevkiyat", label: "Sevkiyatlar", count: sevkiyatTxs.length },
    { key: "odeme", label: "Ödemeler", count: odemeTxs.length },
    { key: "hepsi", label: "Tümü", count: txList.length },
  ];

  return (
    <div className="p-4 page-enter">
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <Link
          href="/finance"
          className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white text-sm font-bold ${isCustomer ? "bg-emerald-500" : "bg-blue-500"}`}>
            {getInitials(contact.name)}
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold truncate">{contact.name}</h1>
            <p className="text-xs text-muted-foreground">Cari Hesap Detayı</p>
          </div>
        </div>
        {contact.phone && (
          <button
            onClick={() => window.open(`tel:${contact.phone}`, "_self")}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-600"
          >
            <Phone className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* KPI Scroll Cards */}
      <div className="flex gap-3 overflow-x-auto pb-2 mb-4 -mx-4 px-4 scrollbar-none">
        <div className="flex-none w-36 rounded-2xl bg-card p-4 shadow-sm text-center">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
            {isCustomer ? "Alacak" : "Borç"}
          </p>
          <p className="text-xl font-extrabold text-red-600">{masked(anaKalem)}</p>
        </div>
        <div className="flex-none w-36 rounded-2xl bg-card p-4 shadow-sm text-center">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
            {isCustomer ? "Tahsil Edilen" : "Ödenen"}
          </p>
          <p className="text-xl font-extrabold text-green-600">{masked(odenenKalem)}</p>
        </div>
        <div className="flex-none w-36 rounded-2xl bg-card p-4 shadow-sm text-center">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
            {isCustomer ? (bakiye > 0 ? "Kalan Alacak" : "Bakiye") : (bakiye > 0 ? "Kalan Borç" : "Bakiye")}
          </p>
          <p className={`text-xl font-extrabold ${bakiye > 0 ? "text-red-600" : "text-green-600"}`}>
            {masked(Math.abs(bakiye))}
          </p>
        </div>
        <div className="flex-none w-36 rounded-2xl bg-card p-4 shadow-sm text-center">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Sevkiyat</p>
          <p className="text-xl font-extrabold">{sevkiyatTxs.length}</p>
          <p className="text-[10px] text-muted-foreground">{masked(sevkiyatTotal)}</p>
        </div>
      </div>

      {/* Action Buttons Grid */}
      <div className="grid grid-cols-4 gap-2 mb-5">
        <Link
          href={`/finance/payments/new?contact_id=${contactId}`}
          className="flex flex-col items-center gap-1.5 rounded-xl bg-card p-3 shadow-sm text-center"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CreditCard className="h-4 w-4" />
          </div>
          <span className="text-[10px] font-medium">Ödeme Ekle</span>
        </Link>
        <button
          onClick={handleDownloadPdf}
          className="flex flex-col items-center gap-1.5 rounded-xl bg-card p-3 shadow-sm text-center"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-100 text-orange-600">
            <Download className="h-4 w-4" />
          </div>
          <span className="text-[10px] font-medium">PDF</span>
        </button>
        {contact.phone && isCustomer && bakiye > 0 ? (
          <button
            onClick={handleWhatsAppHatirlatma}
            className="flex flex-col items-center gap-1.5 rounded-xl bg-card p-3 shadow-sm text-center"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-600">
              <MessageCircle className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-medium">Hatırlat</span>
          </button>
        ) : (
          <div className="flex flex-col items-center gap-1.5 rounded-xl bg-card p-3 shadow-sm text-center opacity-30">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-600">
              <MessageCircle className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-medium">Hatırlat</span>
          </div>
        )}
        {contact.phone ? (
          <button
            onClick={handleWhatsAppEkstre}
            className="flex flex-col items-center gap-1.5 rounded-xl bg-card p-3 shadow-sm text-center"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100 text-green-600">
              <FileText className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-medium">Ekstre</span>
          </button>
        ) : (
          <div className="flex flex-col items-center gap-1.5 rounded-xl bg-card p-3 shadow-sm text-center opacity-30">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100 text-green-600">
              <FileText className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-medium">Ekstre</span>
          </div>
        )}
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 rounded-xl bg-muted p-1 mb-4">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
              activeTab === t.key
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground"
            }`}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {txLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <>
          {/* Sevkiyatlar */}
          {(activeTab === "sevkiyat" || activeTab === "hepsi") && (
            <>
              {activeTab === "hepsi" && sevkiyatTxs.length > 0 && (
                <div className="flex items-center gap-2 mb-2">
                  <Truck className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">Sevkiyatlar</span>
                  <span className="text-xs text-muted-foreground">({sevkiyatTxs.length})</span>
                </div>
              )}
              {(activeTab === "sevkiyat" ? sevkiyatTxs : sevkiyatTxs).length > 0 ? (
                <div className="space-y-2 mb-4">
                  {sevkiyatTxs.map((tx) => {
                    const del = getDelivery(tx);
                    return (
                      <div key={tx.id} className="rounded-xl bg-card p-4 shadow-sm">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">
                                {formatDateShort(tx.transaction_date || "")}
                              </span>
                              {del?.ticket_no && (
                                <span className="text-[10px] bg-muted rounded-md px-1.5 py-0.5 font-mono">
                                  #{del.ticket_no}
                                </span>
                              )}
                            </div>
                            {del ? (
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                                {del.vehicle_plate && (
                                  <span className="font-mono bg-muted rounded px-1.5 py-0.5">{del.vehicle_plate}</span>
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
                            <p className="text-sm font-extrabold">
                              {masked(safeNum(tx.amount))}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              Bakiye: {masked(safeNum(tx.balance_after))}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : activeTab === "sevkiyat" ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Henüz sevkiyat yok.
                </p>
              ) : null}
            </>
          )}

          {/* Ödemeler */}
          {(activeTab === "odeme" || activeTab === "hepsi") && (
            <>
              {activeTab === "hepsi" && odemeTxs.length > 0 && (
                <div className="flex items-center gap-2 mb-2">
                  <Banknote className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">Ödemeler</span>
                  <span className="text-xs text-muted-foreground">({odemeTxs.length})</span>
                </div>
              )}
              {(activeTab === "odeme" ? odemeTxs : odemeTxs).length > 0 ? (
                <div className="space-y-2 mb-4">
                  {odemeTxs.map((tx) => {
                    const isCredit = tx.type === "credit";
                    return (
                      <div key={tx.id} className="rounded-xl bg-card p-4 shadow-sm">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
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
                            <p className="text-sm font-medium">
                              {formatDateShort(tx.transaction_date || "")}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {tx.description || "Ödeme"}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`text-sm font-extrabold ${isCredit ? "text-red-600" : "text-green-600"}`}>
                              {masked(safeNum(tx.amount))}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              Bakiye: {masked(safeNum(tx.balance_after))}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : activeTab === "odeme" ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Henüz ödeme yok.
                </p>
              ) : null}
            </>
          )}

          {/* Hepsi tab - show all tx if selected but not sevkiyat/odeme split */}
          {activeTab === "hepsi" && txList.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Henüz hareket yok.
            </p>
          )}
        </>
      )}
    </div>
  );
}
