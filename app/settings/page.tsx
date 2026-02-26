"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronRight, Wheat, Warehouse, Users, Truck, MessageCircle } from "lucide-react";

const SETTINGS_ITEMS = [
  {
    title: "Yem Türleri",
    description: "Yonca, saman, silaj vb. yem türlerini yönetin",
    href: "/settings/feed-types",
    icon: Wheat,
  },
  {
    title: "Depolar",
    description: "Depo ve lokasyonları yönetin",
    href: "/settings/warehouses",
    icon: Warehouse,
  },
  {
    title: "Nakliyeciler & Araçlar",
    description: "Nakliyeci ve araç kayıtlarını yönetin",
    href: "/settings/carriers",
    icon: Truck,
  },
  {
    title: "Kullanıcı Yönetimi",
    description: "Kullanıcıları ve rollerini yönetin",
    href: "/settings/users",
    icon: Users,
  },
  {
    title: "Mesaj Şablonları",
    description: "WhatsApp mesaj şablonlarını düzenleyin",
    href: "/settings/templates",
    icon: MessageCircle,
  },
];

export default function SettingsPage() {
  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Ayarlar</h1>
          <p className="text-sm text-muted-foreground">
            Uygulama ayarları ve tanımlamalar
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {SETTINGS_ITEMS.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="transition-colors hover:bg-muted/50">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.description}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
