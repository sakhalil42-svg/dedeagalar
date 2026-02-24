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
import { ArrowLeft, Loader2, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { formatCurrency, formatDateShort } from "@/lib/utils/format";

const REF_LABELS: Record<string, string> = {
  purchase: "Alım",
  sale: "Satış",
  payment: "Ödeme",
};

const REF_LINKS: Record<string, string> = {
  purchase: "/purchases",
  sale: "/sales",
};

export default function AccountDetailPage() {
  const { contactId } = useParams<{ contactId: string }>();
  const { data: contact, isLoading: contactLoading } = useContact(contactId);
  const { data: account, isLoading: accountLoading } = useAccountByContact(contactId);
  const { data: transactions, isLoading: txLoading } = useAccountTransactions(
    account?.id || ""
  );

  const isLoading = contactLoading || accountLoading;

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

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/finance">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold">{contact.name}</h1>
          <p className="text-sm text-muted-foreground">Hesap Hareketleri</p>
        </div>
      </div>

      {/* Balance summary */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Borç</p>
              <p className="text-sm font-bold text-red-600">
                {formatCurrency(account.total_debit)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Alacak</p>
              <p className="text-sm font-bold text-green-600">
                {formatCurrency(account.total_credit)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Bakiye</p>
              <p
                className={`text-sm font-bold ${
                  account.balance >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {formatCurrency(account.balance)}
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
      </div>

      {/* Transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hareketler</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0 p-0">
          {txLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : transactions && transactions.length > 0 ? (
            transactions.map((tx, i) => {
              const isDebit = tx.direction === "debit";
              const refLink =
                tx.reference_type && tx.reference_id && REF_LINKS[tx.reference_type]
                  ? `${REF_LINKS[tx.reference_type]}/${tx.reference_id}`
                  : null;

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
                            {REF_LABELS[tx.reference_type] || tx.reference_type}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatDateShort(tx.transaction_date)}</span>
                        <span>Bakiye: {formatCurrency(tx.balance_after)}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-sm font-bold ${
                          isDebit ? "text-red-600" : "text-green-600"
                        }`}
                      >
                        {isDebit ? "-" : "+"}
                        {formatCurrency(tx.amount)}
                      </p>
                      {refLink && (
                        <Link
                          href={refLink}
                          className="text-xs text-primary hover:underline"
                        >
                          Detay
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Henüz hareket yok.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
