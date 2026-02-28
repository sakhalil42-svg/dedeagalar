"use client";

import { usePathname } from "next/navigation";
import { GlobalSearch } from "./global-search";
import { SeasonSelector } from "./season-selector";

const TITLE_MAP: Record<string, string> = {
  "/": "Dedeagalar",
  "/sales": "Satışlar",
  "/purchases": "Alımlar",
  "/contacts": "Kişiler",
  "/finance": "Finans",
  "/inventory": "Stok",
  "/settings": "Ayarlar",
};

export function AppHeader() {
  const pathname = usePathname();

  // Don't show on login page
  if (pathname === "/login") return null;

  // Find matching title
  const title = Object.entries(TITLE_MAP).find(
    ([path]) => pathname === path || (path !== "/" && pathname.startsWith(path))
  )?.[1] || "Dedeagalar";

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur-sm">
      <div className="flex h-12 items-center justify-between px-4">
        <h1 className="text-base font-bold truncate">{title}</h1>
        <div className="flex items-center gap-2">
          <SeasonSelector />
          <GlobalSearch />
        </div>
      </div>
    </header>
  );
}
