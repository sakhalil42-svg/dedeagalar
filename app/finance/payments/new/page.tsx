"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCreatePaymentWithTransaction } from "@/lib/hooks/use-payments";
import { useContacts } from "@/lib/hooks/use-contacts";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Loader2,
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Building2,
  FileText,
  ScrollText,
  Save,
} from "lucide-react";
import { formatNumberInput, parseNumberInput, handleNumberChange } from "@/lib/utils/format";
import { toast } from "sonner";
import Link from "next/link";
import { generateReceiptPdf } from "@/lib/utils/pdf-export";
import { useSeasonFilter } from "@/lib/contexts/season-context";

export default function NewPaymentPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <NewPaymentForm />
    </Suspense>
  );
}

type PaymentMethod = "cash" | "bank_transfer" | "check" | "promissory_note";
type Direction = "inbound" | "outbound";

const METHOD_OPTIONS: {
  value: PaymentMethod;
  label: string;
  icon: typeof Banknote;
}[] = [
  { value: "cash", label: "Nakit", icon: Banknote },
  { value: "bank_transfer", label: "Havale", icon: Building2 },
  { value: "check", label: "Çek", icon: FileText },
  { value: "promissory_note", label: "Senet", icon: ScrollText },
];

function NewPaymentForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedContactId = searchParams.get("contact_id") || "";
  const createPayment = useCreatePaymentWithTransaction();
  const { data: contacts } = useContacts();
  const { selectedSeasonId } = useSeasonFilter();

  const [direction, setDirection] = useState<Direction>("outbound");
  const [contactId, setContactId] = useState(preselectedContactId);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [description, setDescription] = useState("");

  // Çek/Senet ek alanları
  const [serialNo, setSerialNo] = useState("");
  const [bankName, setBankName] = useState("");
  const [branch, setBranch] = useState("");
  const [dueDate, setDueDate] = useState("");

  const [saving, setSaving] = useState(false);

  const isCheckOrNote = method === "check" || method === "promissory_note";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contactId) {
      toast.error("Kişi seçiniz");
      return;
    }
    if (!amount || parseNumberInput(amount) <= 0) {
      toast.error("Geçerli tutar giriniz");
      return;
    }
    if (isCheckOrNote && !dueDate) {
      toast.error("Vade tarihi giriniz");
      return;
    }

    setSaving(true);
    try {
      await createPayment.mutateAsync({
        contact_id: contactId,
        direction,
        method,
        amount: parseNumberInput(amount),
        payment_date: paymentDate,
        description: description || null,
        season_id: selectedSeasonId || null,
        ...(isCheckOrNote
          ? {
              serial_no: serialNo || undefined,
              bank_name: bankName || undefined,
              branch: branch || undefined,
              due_date: dueDate || undefined,
            }
          : {}),
      });
      const selectedContact = contacts?.find((c) => c.id === contactId);
      const receiptNo = `MKB-${Date.now().toString(36).toUpperCase()}`;
      generateReceiptPdf({
        receiptNo,
        direction,
        contactName: selectedContact?.name || "-",
        contactPhone: selectedContact?.phone,
        amount: parseNumberInput(amount),
        method,
        paymentDate,
        description: description || null,
      });

      toast.success(
        direction === "inbound" ? "Tahsilat kaydedildi — Makbuz indirildi" : "Ödeme kaydedildi — Makbuz indirildi"
      );
      if (preselectedContactId) {
        router.push(`/finance/${preselectedContactId}`);
      } else {
        router.push("/finance");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Hata oluştu";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 page-enter">
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <Link
          href={
            preselectedContactId
              ? `/finance/${preselectedContactId}`
              : "/finance"
          }
          className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold">Ödeme / Tahsilat</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Direction Toggle */}
        <div className="flex gap-1 rounded-full bg-muted p-1">
          <button
            type="button"
            onClick={() => setDirection("outbound")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold transition-colors ${
              direction === "outbound"
                ? "bg-red-500 text-white shadow-sm"
                : "text-muted-foreground"
            }`}
          >
            <ArrowUpRight className="h-4 w-4" />
            Ödeme
          </button>
          <button
            type="button"
            onClick={() => setDirection("inbound")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold transition-colors ${
              direction === "inbound"
                ? "bg-green-500 text-white shadow-sm"
                : "text-muted-foreground"
            }`}
          >
            <ArrowDownLeft className="h-4 w-4" />
            Tahsilat
          </button>
        </div>

        {/* Kişi seçimi */}
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
            {direction === "inbound" ? "Tahsilat Yapılan Kişi *" : "Ödeme Yapılan Kişi *"}
          </label>
          <Select value={contactId} onValueChange={setContactId}>
            <SelectTrigger className="rounded-xl bg-muted border-0 h-12">
              <SelectValue placeholder="Kişi seçiniz" />
            </SelectTrigger>
            <SelectContent>
              {contacts?.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Ödeme yöntemi */}
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Ödeme Yöntemi</label>
          <div className="grid grid-cols-4 gap-2">
            {METHOD_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setMethod(opt.value)}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 text-xs font-medium transition-colors ${
                    method === opt.value
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-transparent bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Çek/Senet ek alanları */}
        {isCheckOrNote && (
          <div className="rounded-xl bg-card p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">
                {method === "check" ? "Çek Bilgileri" : "Senet Bilgileri"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  {method === "check" ? "Çek No" : "Senet No"}
                </label>
                <Input
                  value={serialNo}
                  onChange={(e) => setSerialNo(e.target.value)}
                  placeholder="Opsiyonel"
                  className="rounded-xl bg-muted border-0 h-11"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Banka Adı</label>
                <Input
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="Opsiyonel"
                  className="rounded-xl bg-muted border-0 h-11"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Şube</label>
                <Input
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="Opsiyonel"
                  className="rounded-xl bg-muted border-0 h-11"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Vade Tarihi *</label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                  className="rounded-xl bg-muted border-0 h-11"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tutar */}
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Tutar *</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-muted-foreground">
              ₺
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={amount ? formatNumberInput(amount) : ""}
              onChange={(e) => setAmount(handleNumberChange(e.target.value, true))}
              placeholder="0,00"
              className="w-full rounded-xl bg-muted px-4 py-4 pl-10 text-2xl font-extrabold outline-none ring-0 focus:ring-2 focus:ring-primary/30 transition-shadow placeholder:text-muted-foreground/40"
              required
            />
          </div>
        </div>

        {/* Tarih + Açıklama */}
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Tarih *</label>
            <Input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              required
              className="rounded-xl bg-muted border-0 h-12"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Açıklama</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ödeme açıklaması (opsiyonel)..."
              rows={2}
              className="rounded-xl bg-muted border-0"
            />
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={saving}
          className={`w-full rounded-xl py-4 text-base font-semibold text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-60 ${
            direction === "inbound"
              ? "bg-green-600 hover:bg-green-700"
              : "bg-red-600 hover:bg-red-700"
          }`}
        >
          {saving ? (
            <>
              <Loader2 className="h-4.5 w-4.5 animate-spin" />
              Kaydediliyor...
            </>
          ) : (
            <>
              <Save className="h-4.5 w-4.5" />
              {direction === "inbound" ? "Tahsilat Kaydet" : "Ödeme Kaydet"}
            </>
          )}
        </button>
      </form>
    </div>
  );
}
