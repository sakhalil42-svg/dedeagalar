"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useCarriers } from "@/lib/hooks/use-carriers";
import {
  useCarrierTransactions,
  useCarrierBalances,
  useCreateCarrierTransaction,
} from "@/lib/hooks/use-carrier-transactions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Loader2,
  Truck,
  Banknote,
  Plus,
} from "lucide-react";
import { formatCurrency, formatDateShort } from "@/lib/utils/format";
import { toast } from "sonner";

export default function CarrierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: carriers, isLoading: carriersLoading } = useCarriers();
  const { data: balances } = useCarrierBalances();
  const { data: transactions, isLoading: txLoading } = useCarrierTransactions(id);
  const createTx = useCreateCarrierTransaction();

  const [showPayment, setShowPayment] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(new Date().toISOString().split("T")[0]);
  const [payMethod, setPayMethod] = useState("nakit");
  const [payNote, setPayNote] = useState("");

  const carrier = carriers?.find((c) => c.id === id);
  const balance = balances?.find((b) => b.id === id);

  if (carriersLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!carrier) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Nakliyeci bulunamadı.
      </div>
    );
  }

  async function handlePayment() {
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) {
      toast.error("Geçerli tutar giriniz");
      return;
    }
    try {
      await createTx.mutateAsync({
        carrier_id: id,
        type: "payment",
        amount,
        description: `Ödeme - ${payMethod}${payNote ? ` (${payNote})` : ""}`,
        transaction_date: payDate,
        payment_method: payMethod,
      });
      toast.success("Ödeme kaydedildi");
      setShowPayment(false);
      setPayAmount("");
      setPayNote("");
    } catch {
      toast.error("Ödeme kaydedilemedi");
    }
  }

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/settings/carriers">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold">{carrier.name}</h1>
          <p className="text-sm text-muted-foreground">Nakliyeci Cari Hesap</p>
        </div>
      </div>

      {/* Balance Summary */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Toplam Nakliye</p>
              <p className="text-sm font-bold text-red-600">
                {formatCurrency(balance?.total_freight || 0)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ödenen</p>
              <p className="text-sm font-bold text-green-600">
                {formatCurrency(balance?.total_paid || 0)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Kalan Borç</p>
              <p
                className={`text-sm font-bold ${
                  (balance?.balance || 0) > 0 ? "text-red-600" : "text-green-600"
                }`}
              >
                {formatCurrency(Math.abs(balance?.balance || 0))}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <Button size="sm" onClick={() => setShowPayment(true)}>
        <Plus className="mr-1 h-4 w-4" />
        Ödeme Yap
      </Button>

      {/* Transactions */}
      <TransactionList transactions={transactions || []} isLoading={txLoading} />

      {/* Payment Dialog */}
      <Dialog open={showPayment} onOpenChange={setShowPayment}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nakliyeciye Ödeme</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tutar *</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label>Tarih</Label>
              <Input
                type="date"
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Yöntem</Label>
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="nakit">Nakit</option>
                <option value="havale">Havale/EFT</option>
              </select>
            </div>
            <div>
              <Label>Not (opsiyonel)</Label>
              <Input
                value={payNote}
                onChange={(e) => setPayNote(e.target.value)}
                placeholder="Ek açıklama..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPayment(false)}>
              İptal
            </Button>
            <Button onClick={handlePayment} disabled={createTx.isPending}>
              {createTx.isPending ? "Kaydediliyor..." : "Ödeme Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Transaction List with Running Balance ───
function TransactionList({
  transactions,
  isLoading,
}: {
  transactions: { id: string; type: string; amount: number; description: string | null; transaction_date: string; payment_method: string | null }[];
  isLoading: boolean;
}) {
  // Sort chronologically (oldest first) to compute running balance, then reverse for display
  const withBalance = useMemo(() => {
    if (!transactions || transactions.length === 0) return [];
    const sorted = [...transactions].sort(
      (a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()
    );
    let running = 0;
    const items = sorted.map((tx) => {
      if (tx.type === "freight_charge") running += Number(tx.amount);
      else running -= Number(tx.amount);
      return { ...tx, runningBalance: running };
    });
    return items.reverse(); // newest first
  }, [transactions]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">İşlem Geçmişi</CardTitle>
      </CardHeader>
      <CardContent className="space-y-0 p-0">
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : withBalance.length > 0 ? (
          withBalance.map((tx, i) => {
            const isPayment = tx.type === "payment";
            return (
              <div key={tx.id}>
                {i > 0 && <Separator />}
                <div className="flex items-center gap-3 px-4 py-3">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      isPayment
                        ? "bg-green-100 text-green-600"
                        : "bg-red-100 text-red-600"
                    }`}
                  >
                    {isPayment ? (
                      <Banknote className="h-4 w-4" />
                    ) : (
                      <Truck className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {tx.description || (isPayment ? "Ödeme" : "Nakliye")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateShort(tx.transaction_date)}
                      {tx.payment_method && ` · ${tx.payment_method}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p
                      className={`text-sm font-bold ${
                        isPayment ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {isPayment ? "-" : "+"}
                      {formatCurrency(tx.amount)}
                    </p>
                    <p
                      className={`text-[10px] ${
                        tx.runningBalance > 0 ? "text-red-500" : "text-green-500"
                      }`}
                    >
                      Bakiye: {formatCurrency(Math.abs(tx.runningBalance))}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Henüz işlem yok.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
