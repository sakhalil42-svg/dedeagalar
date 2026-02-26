"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCreatePaymentWithTransaction } from "@/lib/hooks/use-payments";
import { useContacts } from "@/lib/hooks/use-contacts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
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
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { generateReceiptPdf } from "@/lib/utils/pdf-export";

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
  { value: "bank_transfer", label: "Havale/EFT", icon: Building2 },
  { value: "check", label: "Çek", icon: FileText },
  { value: "promissory_note", label: "Senet", icon: ScrollText },
];

function NewPaymentForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedContactId = searchParams.get("contact_id") || "";
  const createPayment = useCreatePaymentWithTransaction();
  const { data: contacts } = useContacts();

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
    if (!amount || parseFloat(amount) <= 0) {
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
        amount: parseFloat(amount),
        payment_date: paymentDate,
        description: description || null,
        ...(isCheckOrNote
          ? {
              serial_no: serialNo || undefined,
              bank_name: bankName || undefined,
              branch: branch || undefined,
              due_date: dueDate || undefined,
            }
          : {}),
      });
      // Generate receipt PDF
      const selectedContact = contacts?.find((c) => c.id === contactId);
      const receiptNo = `MKB-${Date.now().toString(36).toUpperCase()}`;
      generateReceiptPdf({
        receiptNo,
        direction,
        contactName: selectedContact?.name || "-",
        contactPhone: selectedContact?.phone,
        amount: parseFloat(amount),
        method,
        paymentDate,
        description: description || null,
      });

      toast.success(
        direction === "inbound" ? "Tahsilat kaydedildi — Makbuz indirildi" : "Ödeme kaydedildi — Makbuz indirildi"
      );
      // Kişi detay sayfasına geri dön
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
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link
            href={
              preselectedContactId
                ? `/finance/${preselectedContactId}`
                : "/finance"
            }
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold">Ödeme / Tahsilat</h1>
          <p className="text-sm text-muted-foreground">
            Yeni ödeme veya tahsilat kaydı
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Yön seçimi */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setDirection("outbound")}
            className={`flex items-center justify-center gap-2 rounded-lg border-2 p-4 text-sm font-medium transition-colors ${
              direction === "outbound"
                ? "border-red-500 bg-red-50 text-red-700"
                : "border-muted bg-background text-muted-foreground"
            }`}
          >
            <ArrowUpRight className="h-5 w-5" />
            <div className="text-left">
              <p className="font-bold">Ödeme</p>
              <p className="text-xs opacity-75">Biz ödüyoruz</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setDirection("inbound")}
            className={`flex items-center justify-center gap-2 rounded-lg border-2 p-4 text-sm font-medium transition-colors ${
              direction === "inbound"
                ? "border-green-500 bg-green-50 text-green-700"
                : "border-muted bg-background text-muted-foreground"
            }`}
          >
            <ArrowDownLeft className="h-5 w-5" />
            <div className="text-left">
              <p className="font-bold">Tahsilat</p>
              <p className="text-xs opacity-75">Bize ödeniyor</p>
            </div>
          </button>
        </div>

        {/* Kişi seçimi */}
        <div className="space-y-2">
          <Label>
            {direction === "inbound"
              ? "Tahsilat Yapılan Kişi"
              : "Ödeme Yapılan Kişi"}
          </Label>
          <Select value={contactId} onValueChange={setContactId}>
            <SelectTrigger>
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
        <div className="space-y-2">
          <Label>Ödeme Yöntemi</Label>
          <div className="grid grid-cols-4 gap-2">
            {METHOD_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setMethod(opt.value)}
                  className={`flex flex-col items-center gap-1 rounded-lg border-2 p-3 text-xs font-medium transition-colors ${
                    method === opt.value
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-muted bg-background text-muted-foreground"
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
          <Card>
            <CardContent className="space-y-3 p-4">
              <p className="text-sm font-medium">
                {method === "check" ? "Çek Bilgileri" : "Senet Bilgileri"}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">
                    {method === "check" ? "Çek No" : "Senet No"}
                  </Label>
                  <Input
                    value={serialNo}
                    onChange={(e) => setSerialNo(e.target.value)}
                    placeholder="Opsiyonel"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Banka Adı</Label>
                  <Input
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="Opsiyonel"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Şube</Label>
                  <Input
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    placeholder="Opsiyonel"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Vade Tarihi *</Label>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    required
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tutar */}
        <div className="space-y-2">
          <Label>Tutar</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-bold text-muted-foreground">
              ₺
            </span>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              className="h-14 pl-8 text-2xl font-bold"
              required
            />
          </div>
        </div>

        {/* Tarih */}
        <div className="space-y-2">
          <Label>Tarih</Label>
          <Input
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            required
          />
        </div>

        {/* Açıklama */}
        <div className="space-y-2">
          <Label>Açıklama</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ödeme açıklaması (opsiyonel)..."
            rows={2}
          />
        </div>

        {/* Kaydet */}
        <Button
          type="submit"
          disabled={saving}
          className={`w-full h-12 text-base font-bold ${
            direction === "inbound"
              ? "bg-green-600 hover:bg-green-700"
              : "bg-red-600 hover:bg-red-700"
          }`}
          size="lg"
        >
          {saving ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : direction === "inbound" ? (
            "Tahsilat Kaydet"
          ) : (
            "Ödeme Kaydet"
          )}
        </Button>
      </form>
    </div>
  );
}
