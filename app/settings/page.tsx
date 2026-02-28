"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { createClient } from "@/lib/supabase/client";
import {
  ChevronRight,
  Wheat,
  Warehouse,
  Users,
  Truck,
  MessageCircle,
  Database,
  Calendar,
  Sun,
  Moon,
  Monitor,
  Info,
} from "lucide-react";

const GENERAL_ITEMS = [
  {
    title: "Sezon Yönetimi",
    description: "Sezon oluşturma, kapatma ve raporları",
    href: "/settings/seasons",
    icon: Calendar,
    color: "bg-purple-100 text-purple-600",
  },
  {
    title: "Yem Türleri",
    description: "Yonca, saman, silaj vb. yönetin",
    href: "/settings/feed-types",
    icon: Wheat,
    color: "bg-green-100 text-green-600",
  },
  {
    title: "Depolar",
    description: "Depo ve lokasyonları yönetin",
    href: "/settings/warehouses",
    icon: Warehouse,
    color: "bg-blue-100 text-blue-600",
  },
  {
    title: "Nakliyeciler & Araçlar",
    description: "Nakliyeci ve araç kayıtları",
    href: "/settings/carriers",
    icon: Truck,
    color: "bg-orange-100 text-orange-600",
  },
  {
    title: "Mesaj Şablonları",
    description: "WhatsApp mesaj şablonlarını düzenleyin",
    href: "/settings/templates",
    icon: MessageCircle,
    color: "bg-emerald-100 text-emerald-600",
  },
];

const SYSTEM_ITEMS = [
  {
    title: "Kullanıcı Yönetimi",
    description: "Kullanıcıları ve rollerini yönetin",
    href: "/settings/users",
    icon: Users,
    color: "bg-indigo-100 text-indigo-600",
  },
  {
    title: "Veri Yönetimi",
    description: "Yedekleme, çöp kutusu ve işlem geçmişi",
    href: "/settings/data",
    icon: Database,
    color: "bg-amber-100 text-amber-600",
  },
];

const THEMES = [
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
  { value: "system", icon: Monitor },
] as const;

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserEmail(data.user.email || null);
        setUserName(
          data.user.user_metadata?.full_name ||
            data.user.email?.split("@")[0] ||
            null
        );
      }
    });
  }, []);

  const initials = userName
    ? userName
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <div className="p-4 page-enter">
      {/* Profile Card */}
      <div className="flex flex-col items-center mb-6 pt-2">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-white text-2xl font-extrabold mb-3">
          {initials}
        </div>
        <h2 className="text-lg font-bold">{userName || "Kullanıcı"}</h2>
        <p className="text-xs text-muted-foreground">{userEmail || ""}</p>
        <div className="mt-1.5 flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Dedeağalar Grup
          </span>
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
            Aktif
          </span>
        </div>
      </div>

      {/* GENEL AYARLAR */}
      <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2 px-1">
        Genel Ayarlar
      </p>
      <div className="space-y-2 mb-5">
        {GENERAL_ITEMS.map((item) => (
          <Link key={item.href} href={item.href}>
            <div className="flex items-center gap-3 rounded-xl bg-card p-4 shadow-sm hover:bg-muted/50 transition-colors">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.color}`}>
                <item.icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="text-xs text-muted-foreground truncate">{item.description}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </div>
          </Link>
        ))}
      </div>

      {/* SİSTEM */}
      <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2 px-1">
        Sistem
      </p>
      <div className="space-y-2 mb-5">
        {SYSTEM_ITEMS.map((item) => (
          <Link key={item.href} href={item.href}>
            <div className="flex items-center gap-3 rounded-xl bg-card p-4 shadow-sm hover:bg-muted/50 transition-colors">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.color}`}>
                <item.icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="text-xs text-muted-foreground truncate">{item.description}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </div>
          </Link>
        ))}

        {/* Theme Toggle Inline */}
        {mounted && (
          <div className="flex items-center gap-3 rounded-xl bg-card p-4 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-600">
              {theme === "dark" ? (
                <Moon className="h-5 w-5" />
              ) : theme === "light" ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Monitor className="h-5 w-5" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Görünüm</p>
              <p className="text-xs text-muted-foreground">Tema tercihini değiştir</p>
            </div>
            <div className="flex gap-1 rounded-lg bg-muted p-1">
              {THEMES.map((t) => {
                const Icon = t.icon;
                const isActive = theme === t.value;
                return (
                  <button
                    key={t.value}
                    onClick={() => setTheme(t.value)}
                    className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                      isActive
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Version */}
      <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground pt-4 pb-2">
        <Info className="h-3 w-3" />
        <span>Dedeağalar Ticaret v1.0</span>
      </div>
    </div>
  );
}
