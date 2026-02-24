"use client";

import { useState } from "react";
import Link from "next/link";
import { useContacts } from "@/lib/hooks/use-contacts";
import type { ContactType } from "@/lib/types/database.types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Search, Phone, MapPin, Loader2 } from "lucide-react";

const TYPE_LABELS: Record<ContactType, string> = {
  supplier: "Üretici",
  customer: "Müşteri",
  both: "Üretici/Müşteri",
};

const TYPE_COLORS: Record<ContactType, string> = {
  supplier: "bg-blue-100 text-blue-800",
  customer: "bg-green-100 text-green-800",
  both: "bg-purple-100 text-purple-800",
};

const FILTER_OPTIONS: { label: string; value: ContactType | "all" }[] = [
  { label: "Tümü", value: "all" },
  { label: "Üretici", value: "supplier" },
  { label: "Müşteri", value: "customer" },
];

export default function ContactsPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ContactType | "all">("all");
  const { data: contacts, isLoading } = useContacts(
    filter === "all" ? undefined : filter
  );

  const filtered = contacts?.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Kişiler</h1>
          <p className="text-sm text-muted-foreground">
            Üretici ve müşteri kayıtları
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/contacts/new">
            <Plus className="mr-1 h-4 w-4" />
            Yeni
          </Link>
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="İsim ile ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="flex gap-2">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              filter === opt.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered && filtered.length > 0 ? (
        <div className="space-y-2">
          {filtered.map((contact) => (
            <Link key={contact.id} href={`/contacts/${contact.id}`}>
              <Card className="transition-colors hover:bg-muted/50">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="font-medium">{contact.name}</p>
                      {contact.phone && (
                        <p className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {contact.phone}
                        </p>
                      )}
                      {contact.city && (
                        <p className="flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {contact.city}
                        </p>
                      )}
                    </div>
                    <Badge
                      variant="secondary"
                      className={TYPE_COLORS[contact.type]}
                    >
                      {TYPE_LABELS[contact.type]}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="py-12 text-center text-sm text-muted-foreground">
          {search ? "Sonuç bulunamadı." : "Henüz kişi kaydı yok."}
        </div>
      )}
    </div>
  );
}
