"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Sun, Moon, Monitor } from "lucide-react";

const THEMES = [
  { value: "light", label: "Açık", icon: Sun, color: "bg-amber-100 text-amber-600" },
  { value: "dark", label: "Koyu", icon: Moon, color: "bg-indigo-100 text-indigo-600" },
  { value: "system", label: "Sistem", icon: Monitor, color: "bg-gray-100 text-gray-600" },
] as const;

export default function AppearancePage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="p-4 page-enter">
      <div className="flex items-center gap-2 mb-5">
        <Link
          href="/settings"
          className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold">Görünüm</h1>
          <p className="text-xs text-muted-foreground">Tema tercihini seç</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {THEMES.map((t) => {
          const Icon = t.icon;
          const isActive = theme === t.value;
          return (
            <button
              key={t.value}
              onClick={() => setTheme(t.value)}
              className={`flex flex-col items-center gap-2 rounded-2xl p-5 shadow-sm transition-all ${
                isActive
                  ? "bg-card border-2 border-primary ring-2 ring-primary/20"
                  : "bg-card border-2 border-transparent hover:bg-muted/50"
              }`}
            >
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                  isActive ? "bg-primary/10 text-primary" : t.color
                }`}
              >
                <Icon className="h-6 w-6" />
              </div>
              <span className={`text-sm font-semibold ${isActive ? "text-primary" : ""}`}>
                {t.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
