"use client";

import { Eye, EyeOff } from "lucide-react";
import { useBalanceVisibility } from "@/lib/contexts/balance-visibility";

export function BalanceToggle() {
  const { isVisible, toggle } = useBalanceVisibility();

  return (
    <button
      onClick={toggle}
      className="flex h-9 w-9 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-muted"
      aria-label={isVisible ? "Bakiyeleri gizle" : "Bakiyeleri göster"}
    >
      {isVisible ? (
        <Eye className="h-4 w-4" />
      ) : (
        <EyeOff className="h-4 w-4" />
      )}
    </button>
  );
}
