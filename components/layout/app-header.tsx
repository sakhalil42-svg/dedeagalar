"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Sprout, Settings } from "lucide-react";
import { GlobalSearch } from "./global-search";
import { SeasonSelector } from "./season-selector";
import { BalanceToggle } from "./balance-toggle";

const TITLE_MAP: Record<string, string> = {
  "/": "",
  "/sales": "Satışlar",
  "/purchases": "Sevkiyatlar",
  "/contacts": "Kişiler",
  "/finance": "Finans",
  "/inventory": "Stok",
  "/settings": "Ayarlar",
};

export function AppHeader() {
  const pathname = usePathname();

  // Don't show on login page
  if (pathname === "/login") return null;

  const isHome = pathname === "/";

  // Find matching title
  const title = Object.entries(TITLE_MAP).find(
    ([path]) => pathname === path || (path !== "/" && pathname.startsWith(path))
  )?.[1] || "Dedeağalar";

  return (
    <header className="sticky top-0 z-40 border-b border-border/50 bg-background/95 backdrop-blur-lg">
      <div className="flex h-14 items-center justify-between px-4">
        {isHome ? (
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sprout className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight leading-tight">Dedeağalar</h1>
              <p className="text-[10px] text-muted-foreground font-medium leading-tight">Kaba Yem Ticareti</p>
            </div>
          </div>
        ) : (
          <h1 className="text-base font-bold truncate">{title}</h1>
        )}
        <div className="flex items-center gap-1.5">
          <SeasonSelector />
          {isHome && <BalanceToggle />}
          <GlobalSearch />
          <Link
            href="/settings"
            className="p-2 rounded-xl hover:bg-muted transition-colors"
          >
            <Settings className="h-5 w-5 text-muted-foreground" />
          </Link>
        </div>
      </div>
    </header>
  );
}
