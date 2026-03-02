"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { contactSchema, type ContactFormValues } from "@/lib/schemas/contact";
import { useCreateContact } from "@/lib/hooks/use-contacts";
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
import { ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { capitalizeWords } from "@/lib/utils/format";
import { type LatLng, parseLocationInput, isShortMapUrl, resolveShortMapUrl } from "@/lib/utils/location";
import { useState } from "react";

export default function NewContactPage() {
  const router = useRouter();
  const createContact = useCreateContact();
  const [locationParsed, setLocationParsed] = useState<LatLng | null>(null);
  const [locationError, setLocationError] = useState(false);
  const [locationResolving, setLocationResolving] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      type: "supplier",
      name: "",
      phone: "",
      email: "",
      address: "",
      city: "",
      notes: "",
      location_url: "",
      credit_limit: "",
    },
  });

  async function onSubmit(values: ContactFormValues) {
    try {
      let coords = values.location_url ? parseLocationInput(values.location_url) : null;
      if (!coords && values.location_url && isShortMapUrl(values.location_url)) {
        coords = await resolveShortMapUrl(values.location_url);
      }
      const { location_url: _locationUrl, ...rest } = values;
      const payload = {
        ...rest,
        phone: values.phone || null,
        email: values.email || null,
        address: values.address || null,
        city: values.city || null,
        notes: values.notes || null,
        latitude: coords?.lat ?? null,
        longitude: coords?.lng ?? null,
        credit_limit: values.credit_limit ? Number(values.credit_limit) : null,
      };
      await createContact.mutateAsync(payload);
      toast.success("Kişi başarıyla eklendi");
      router.push("/contacts");
    } catch {
      toast.error("Kişi eklenirken hata oluştu");
    }
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/contacts">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-xl font-bold">Yeni Kişi</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Kişi Bilgileri</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Kişi Türü</Label>
              <Select
                defaultValue="supplier"
                onValueChange={(val) =>
                  setValue("type", val as ContactFormValues["type"])
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seçiniz" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="supplier">Üretici</SelectItem>
                  <SelectItem value="customer">Müşteri</SelectItem>
                  <SelectItem value="both">Üretici/Müşteri</SelectItem>
                </SelectContent>
              </Select>
              {errors.type && (
                <p className="text-sm text-destructive">{errors.type.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">İsim *</Label>
              <Input id="name" {...register("name", { onBlur: (e) => setValue("name", capitalizeWords(e.target.value)) })} placeholder="Ad Soyad / Firma" />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="phone">Telefon</Label>
                <Input id="phone" {...register("phone")} placeholder="05XX XXX XXXX" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">Şehir</Label>
                <Input id="city" {...register("city")} placeholder="Şehir" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-posta</Label>
              <Input id="email" type="email" {...register("email")} placeholder="ornek@email.com" />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="credit_limit">Kredi Limiti (₺)</Label>
              <Input
                id="credit_limit"
                type="number"
                step="0.01"
                {...register("credit_limit")}
                placeholder="Boş = sınırsız, 0 = peşin"
              />
              <p className="text-[10px] text-muted-foreground">Boş bırakılırsa limit uygulanmaz</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Adres</Label>
              <Textarea id="address" {...register("address")} placeholder="Açık adres" rows={2} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location_url">Konum (Google Maps linki yapıştır)</Label>
              <div className="relative">
                <Input
                  id="location_url"
                  {...register("location_url", {
                    onChange: async (e: React.ChangeEvent<HTMLInputElement>) => {
                      const val = e.target.value;
                      if (!val) {
                        setLocationParsed(null);
                        setLocationError(false);
                        return;
                      }
                      const parsed = parseLocationInput(val);
                      if (parsed) {
                        setLocationParsed(parsed);
                        setLocationError(false);
                      } else if (isShortMapUrl(val)) {
                        setLocationResolving(true);
                        setLocationError(false);
                        setLocationParsed(null);
                        const resolved = await resolveShortMapUrl(val);
                        setLocationResolving(false);
                        if (resolved) {
                          setLocationParsed(resolved);
                        } else {
                          setLocationError(true);
                        }
                      } else {
                        setLocationParsed(null);
                        setLocationError(true);
                      }
                    },
                  })}
                  placeholder="https://maps.google.com/?q=37.1234,38.5678"
                />
                {locationParsed && (
                  <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                )}
              </div>
              {locationParsed && (
                <p className="text-xs text-green-600">Konum kaydedilecek: {locationParsed.lat.toFixed(5)}, {locationParsed.lng.toFixed(5)}</p>
              )}
              {locationResolving && (
                <p className="text-xs text-muted-foreground">Kısa link çözümleniyor...</p>
              )}
              {locationError && (
                <p className="text-xs text-destructive">Geçerli bir Google Maps linki veya koordinat yapıştırın</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notlar</Label>
              <Textarea id="notes" {...register("notes")} placeholder="Ek notlar..." rows={2} />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={createContact.isPending}
            >
              {createContact.isPending ? (
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
