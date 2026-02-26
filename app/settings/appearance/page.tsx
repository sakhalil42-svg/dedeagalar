"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Sun, Moon, Monitor } from "lucide-react";

const THEMES = [
  { value: "light", label: "Açık", icon: Sun },
  { value: "dark", label: "Koyu", icon: Moon },
  { value: "system", label: "Sistem", icon: Monitor },
] as const;

export default function AppearancePage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/settings">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Görünüm</h1>
          <p className="text-sm text-muted-foreground">Tema tercihini seç</p>
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
              className="focus:outline-none"
            >
              <Card
                className={`transition-all ${
                  isActive
                    ? "border-primary ring-2 ring-primary/20"
                    : "hover:bg-muted/50"
                }`}
              >
                <CardContent className="flex flex-col items-center gap-2 p-4">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-full ${
                      isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <span className={`text-sm font-medium ${isActive ? "text-primary" : ""}`}>
                    {t.label}
                  </span>
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>
    </div>
  );
}
