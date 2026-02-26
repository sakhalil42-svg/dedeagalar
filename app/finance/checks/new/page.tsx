"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { checkSchema, type CheckFormValues } from "@/lib/schemas/check";
import { useCreateCheck } from "@/lib/hooks/use-checks";
import { useContacts } from "@/lib/hooks/use-contacts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function NewCheckPage() {
  const router = useRouter();
  const createCheck = useCreateCheck();
  const { data: contacts } = useContacts();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CheckFormValues>({
    resolver: zodResolver(checkSchema),
    defaultValues: {
      contact_id: "",
      check_type: "check",
      direction: "received",
      check_no: "",
      bank_name: "",
      branch_name: "",
      amount: "",
      issue_date: new Date().toISOString().split("T")[0],
      due_date: "",
      endorsed_to: "",
      notes: "",
    },
  });

  const checkType = watch("check_type");

  async function onSubmit(values: CheckFormValues) {
    try {
      await createCheck.mutateAsync({
        contact_id: values.contact_id,
        check_type: values.check_type,
        direction: values.direction,
        check_no: values.check_no || null,
        bank_name: values.bank_name || null,
        branch_name: values.branch_name || null,
        amount: Number(values.amount),
        issue_date: values.issue_date,
        due_date: values.due_date,
        endorsed_to: values.endorsed_to || null,
        notes: values.notes || null,
      });
      toast.success(
        values.check_type === "check" ? "Çek kaydedildi" : "Senet kaydedildi"
      );
      router.push("/finance/checks");
    } catch {
      toast.error("Kayıt sırasında hata oluştu");
    }
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/finance/checks">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-xl font-bold">Yeni Çek / Senet</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {checkType === "check" ? "Çek" : "Senet"} Bilgileri
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tür *</Label>
                <Select
                  defaultValue="check"
                  onValueChange={(val) =>
                    setValue("check_type", val as CheckFormValues["check_type"])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="check">Çek</SelectItem>
                    <SelectItem value="promissory_note">Senet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Yön *</Label>
                <Select
                  defaultValue="inbound"
                  onValueChange={(val) =>
                    setValue("direction", val as CheckFormValues["direction"])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="received">Alınan</SelectItem>
                    <SelectItem value="given">Verilen</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Kişi *</Label>
              <Select onValueChange={(val) => setValue("contact_id", val)}>
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
              {errors.contact_id && (
                <p className="text-sm text-destructive">{errors.contact_id.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="check_no">
                  {checkType === "check" ? "Çek No" : "Senet No"}
                </Label>
                <Input id="check_no" {...register("check_no")} placeholder="No" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Tutar (TL) *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  {...register("amount")}
                  placeholder="0.00"
                />
                {errors.amount && (
                  <p className="text-sm text-destructive">{errors.amount.message}</p>
                )}
              </div>
            </div>

            {checkType === "check" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="bank_name">Banka</Label>
                  <Input
                    id="bank_name"
                    {...register("bank_name")}
                    placeholder="Banka adı"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="branch_name">Şube</Label>
                  <Input
                    id="branch_name"
                    {...register("branch_name")}
                    placeholder="Şube adı"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="issue_date">Düzenleme Tarihi *</Label>
                <Input
                  id="issue_date"
                  type="date"
                  {...register("issue_date")}
                />
                {errors.issue_date && (
                  <p className="text-sm text-destructive">{errors.issue_date.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="due_date">Vade Tarihi *</Label>
                <Input
                  id="due_date"
                  type="date"
                  {...register("due_date")}
                />
                {errors.due_date && (
                  <p className="text-sm text-destructive">{errors.due_date.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notlar</Label>
              <Textarea
                id="notes"
                {...register("notes")}
                placeholder="Ek notlar..."
                rows={2}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={createCheck.isPending}
            >
              {createCheck.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Kaydediliyor...
                </>
              ) : (
                "Kaydet"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
