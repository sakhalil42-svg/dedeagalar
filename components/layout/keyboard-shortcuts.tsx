"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SHORTCUTS = [
  { keys: ["Ctrl", "K"], description: "Global arama" },
  { keys: ["Ctrl", "N"], description: "Yeni satış" },
  { keys: ["Ctrl", "P"], description: "Ödemeler" },
  { keys: ["?"], description: "Kısayolları göster" },
];

export function KeyboardShortcuts() {
  const router = useRouter();
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        return;
      }

      // Ctrl+K — Open global search
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        // Dispatch custom event for global search
        window.dispatchEvent(new CustomEvent("toggle-global-search"));
        return;
      }

      // Ctrl+N — New sale
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault();
        router.push("/sales");
        return;
      }

      // Ctrl+P — Payments
      if ((e.ctrlKey || e.metaKey) && e.key === "p") {
        e.preventDefault();
        router.push("/finance/payments");
        return;
      }

      // ? — Show shortcuts help
      if (e.key === "?") {
        e.preventDefault();
        setShowHelp(true);
        return;
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  return (
    <Dialog open={showHelp} onOpenChange={setShowHelp}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Klavye Kısayolları</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {SHORTCUTS.map((s) => (
            <div
              key={s.description}
              className="flex items-center justify-between"
            >
              <span className="text-sm">{s.description}</span>
              <div className="flex items-center gap-1">
                {s.keys.map((key) => (
                  <kbd
                    key={key}
                    className="rounded border bg-muted px-2 py-0.5 text-xs font-mono"
                  >
                    {key}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
