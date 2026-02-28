"use client";

import { useState, useMemo, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useCarriers, useUpdateCarrier } from "@/lib/hooks/use-carriers";
import {
  useCarrierTransactions,
  useCarrierBalances,
  useCreateCarrierTransaction,
} from "@/lib/hooks/use-carrier-transactions";
import { Input } from "@/components/ui/input";
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
  Pencil,
  Check,
  X,
  Phone,
  MapPin,
} from "lucide-react";
import { formatCurrency, formatDateShort } from "@/lib/utils/format";
import { toast } from "sonner";

export default function CarrierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: carriers, isLoading: carriersLoading } = useCarriers();
  const { data: balances } = useCarrierBalances();
  const { data: transactions, isLoading: txLoading } = useCarrierTransactions(id);
  const createTx = useCreateCarrierTransaction();
  const updateCarrier = useUpdateCarrier();

  const [showPayment, setShowPayment] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(new Date().toISOString().split("T")[0]);
  const [payMethod, setPayMethod] = useState("nakit");
  const [payNote, setPayNote] = useState("");

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editPhone2, setEditPhone2] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const carrier = carriers?.find((c) => c.id === id);
  const balance = balances?.find((b) => b.id === id);

  useEffect(() => {
    if (carrier) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEditName(carrier.name);
      setEditPhone(carrier.phone || "");
      setEditPhone2(carrier.phone2 || "");
      setEditCity(carrier.city || "");
      setEditNotes(carrier.notes || "");
    }
  }, [carrier]);

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

  const initials = carrier.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  function startEdit() {
    setEditName(carrier!.name);
    setEditPhone(carrier!.phone || "");
    setEditPhone2(carrier!.phone2 || "");
    setEditCity(carrier!.city || "");
    setEditNotes(carrier!.notes || "");
    setEditing(true);
  }

  async function saveEdit() {
    if (!editName.trim()) {
      toast.error("Nakliyeci adı boş olamaz");
      return;
    }
    try {
      await updateCarrier.mutateAsync({
        id,
        name: editName.trim(),
        phone: editPhone.trim() || null,
        phone2: editPhone2.trim() || null,
        city: editCity.trim() || null,
        notes: editNotes.trim() || null,
      });
      toast.success("Nakliyeci güncellendi");
      setEditing(false);
    } catch {
      toast.error("Güncelleme başarısız");
    }
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
    <div className="p-4 page-enter">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Link
            href="/settings/carriers"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 text-orange-600 text-sm font-bold">
              {initials}
            </div>
            <div>
              <h1 className="text-xl font-bold">{carrier.name}</h1>
              <p className="text-xs text-muted-foreground">Nakliyeci Cari Hesap</p>
            </div>
          </div>
        </div>
        {!editing && (
          <button
            onClick={startEdit}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Edit Form */}
      {editing && (
        <div className="rounded-xl bg-card p-4 shadow-sm mb-4 space-y-3">
          <p className="text-sm font-semibold">Bilgileri Düzenle</p>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Ad *</label>
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Nakliyeci adı"
              className="rounded-xl bg-muted border-0 h-11"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Telefon</label>
              <Input
                type="tel"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="05XX XXX XXXX"
                className="rounded-xl bg-muted border-0 h-11"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Telefon 2</label>
              <Input
                type="tel"
                value={editPhone2}
                onChange={(e) => setEditPhone2(e.target.value)}
                placeholder="05XX XXX XXXX"
                className="rounded-xl bg-muted border-0 h-11"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Şehir</label>
            <Input
              value={editCity}
              onChange={(e) => setEditCity(e.target.value)}
              placeholder="Şehir"
              className="rounded-xl bg-muted border-0 h-11"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Notlar</label>
            <Input
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder="Ek notlar..."
              className="rounded-xl bg-muted border-0 h-11"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={saveEdit}
              disabled={updateCarrier.isPending}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {updateCarrier.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Kaydet
            </button>
            <button
              onClick={() => setEditing(false)}
              className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-xs font-semibold hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
              İptal
            </button>
          </div>
        </div>
      )}

      {/* Carrier Info (when not editing) */}
      {!editing && (carrier.phone || carrier.city || carrier.notes) && (
        <div className="rounded-xl bg-card p-4 shadow-sm mb-4 space-y-2">
          {carrier.phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{carrier.phone}</span>
              {carrier.phone2 && (
                <span className="text-muted-foreground">/ {carrier.phone2}</span>
              )}
            </div>
          )}
          {carrier.city && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              <span>{carrier.city}</span>
            </div>
          )}
          {carrier.notes && (
            <p className="text-xs text-muted-foreground italic">{carrier.notes}</p>
          )}
        </div>
      )}

      {/* Balance Summary */}
      <div className="rounded-2xl bg-card p-4 shadow-sm mb-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Toplam Nakliye</p>
            <p className="text-lg font-extrabold text-red-600">
              {formatCurrency(balance?.total_freight || 0)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Ödenen</p>
            <p className="text-lg font-extrabold text-green-600">
              {formatCurrency(balance?.total_paid || 0)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Kalan Borç</p>
            <p
              className={`text-lg font-extrabold ${
                (balance?.balance || 0) > 0 ? "text-red-600" : "text-green-600"
              }`}
            >
              {formatCurrency(Math.abs(balance?.balance || 0))}
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <button
        onClick={() => setShowPayment(true)}
        className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-white hover:bg-primary/90 transition-colors mb-4"
      >
        <Plus className="h-4 w-4" />
        Ödeme Yap
      </button>

      {/* Transactions */}
      <TransactionList transactions={transactions || []} isLoading={txLoading} />

      {/* Payment Dialog */}
      <Dialog open={showPayment} onOpenChange={setShowPayment}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Nakliyeciye Ödeme</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Tutar *</label>
              <Input
                type="number"
                inputMode="decimal"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder="0.00"
                className="rounded-xl bg-muted border-0 h-12"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Tarih</label>
              <Input
                type="date"
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
                className="rounded-xl bg-muted border-0 h-12"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Yöntem</label>
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
                className="flex h-12 w-full rounded-xl bg-muted px-3 py-2 text-sm outline-none"
              >
                <option value="nakit">Nakit</option>
                <option value="havale">Havale/EFT</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Not (opsiyonel)</label>
              <Input
                value={payNote}
                onChange={(e) => setPayNote(e.target.value)}
                placeholder="Ek açıklama..."
                className="rounded-xl bg-muted border-0 h-12"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <button
              onClick={() => setShowPayment(false)}
              className="flex-1 rounded-xl border border-border py-3 text-sm font-semibold hover:bg-muted transition-colors"
            >
              İptal
            </button>
            <button
              onClick={handlePayment}
              disabled={createTx.isPending}
              className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {createTx.isPending ? "Kaydediliyor..." : "Ödeme Kaydet"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TransactionList({
  transactions,
  isLoading,
}: {
  transactions: { id: string; type: string; amount: number; description: string | null; transaction_date: string; payment_method: string | null }[];
  isLoading: boolean;
}) {
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
    return items.reverse();
  }, [transactions]);

  return (
    <div className="rounded-xl bg-card shadow-sm overflow-hidden">
      <div className="p-3 bg-muted/50">
        <span className="text-sm font-semibold">İşlem Geçmişi</span>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : withBalance.length > 0 ? (
        withBalance.map((tx, i) => {
          const isPayment = tx.type === "payment";
          return (
            <div
              key={tx.id}
              className={`flex items-center gap-3 px-4 py-3 ${
                i > 0 ? "border-t border-border/50" : ""
              }`}
            >
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
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
                <p className="text-[10px] text-muted-foreground">
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
          );
        })
      ) : (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Henüz işlem yok.
        </p>
      )}
    </div>
  );
}
