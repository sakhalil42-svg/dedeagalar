"use client";

import { useState, useEffect } from "react";
import { WifiOff } from "lucide-react";
import { toast } from "sonner";

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    // Set initial state
    setIsOffline(!navigator.onLine);

    function handleOffline() {
      setIsOffline(true);
    }

    function handleOnline() {
      setIsOffline(false);
      toast.success("Bağlantı yeniden sağlandı");
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="sticky top-0 z-[60] flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-white text-sm font-medium">
      <WifiOff className="h-4 w-4" />
      <span>Çevrimdışısınız — Veriler son kaydedilen halinde gösterilir</span>
    </div>
  );
}
