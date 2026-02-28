"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { X, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/utils/format";
import { useChecks } from "@/lib/hooks/use-checks";

export function DueDateBanner() {
  const [dismissed, setDismissed] = useState(true); // Start hidden until check
  const { data: checks } = useChecks();

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    const dismissKey = `due_banner_dismissed_${today}`;
    const wasDismissed = localStorage.getItem(dismissKey);
    if (!wasDismissed) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDismissed(false);
    }
  }, []);

  if (dismissed || !checks) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split("T")[0];

  // Filter overdue + today's due checks
  const urgentChecks = checks.filter((c) => {
    if (c.status !== "pending" && c.status !== "deposited") return false;
    return c.due_date <= todayStr;
  });

  if (urgentChecks.length === 0) return null;

  const overdueChecks = urgentChecks.filter((c) => c.due_date < todayStr);
  const todayDueChecks = urgentChecks.filter((c) => c.due_date === todayStr);
  const totalAmount = urgentChecks.reduce((s, c) => s + (c.amount || 0), 0);

  const handleDismiss = () => {
    const todayKey = new Date().toISOString().split("T")[0];
    localStorage.setItem(`due_banner_dismissed_${todayKey}`, "1");
    setDismissed(true);
  };

  return (
    <Link href="/finance/calendar" onClick={(e) => e.stopPropagation()}>
      <div className="relative mx-4 mt-2 rounded-lg border border-red-300 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950/30">
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleDismiss();
          }}
          className="absolute top-2 right-2 rounded-full p-0.5 hover:bg-red-200 transition-colors"
        >
          <X className="h-3.5 w-3.5 text-red-600" />
        </button>
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5 pr-4">
            <p className="text-sm font-bold text-red-800 dark:text-red-400">
              {overdueChecks.length > 0 && `${overdueChecks.length} adet çek/senetin vadesi geçmiş`}
              {overdueChecks.length > 0 && todayDueChecks.length > 0 && ", "}
              {todayDueChecks.length > 0 && `${todayDueChecks.length} adet bugün vadeli`}
              {overdueChecks.length === 0 && todayDueChecks.length === 0 && "Vadesi gelen çek/senet var"}
            </p>
            <p className="text-xs text-red-600 dark:text-red-500">
              Toplam: {formatCurrency(totalAmount)}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}
