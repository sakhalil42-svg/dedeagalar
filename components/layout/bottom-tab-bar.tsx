"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Truck,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTodayDeliveryCount, useOverdueCheckCount } from "@/lib/hooks/use-badge-counts";

export function BottomTabBar() {
  const pathname = usePathname();
  const { data: todayCount } = useTodayDeliveryCount();
  const { data: overdueCount } = useOverdueCheckCount();

  const tabs = [
    { href: "/", label: "Ana Sayfa", icon: LayoutDashboard, badge: 0, badgeColor: "" },
    { href: "/sales", label: "Satışlar", icon: TrendingUp, badge: 0, badgeColor: "" },
    { href: "/purchases", label: "Sevkiyatlar", icon: Truck, badge: todayCount || 0, badgeColor: "bg-green-500" },
    { href: "/contacts", label: "Kişiler", icon: Users, badge: 0, badgeColor: "" },
    { href: "/finance", label: "Finans", icon: Wallet, badge: overdueCount || 0, badgeColor: "bg-red-500" },
  ] as const;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-card/95 backdrop-blur-lg shadow-[0_-2px_12px_rgba(0,0,0,0.06)] pb-[env(safe-area-inset-bottom)]">
      <div className="flex h-[68px] items-end justify-around px-2 py-2">
        {tabs.map((tab) => {
          const isActive =
            tab.href === "/"
              ? pathname === "/"
              : pathname.startsWith(tab.href);
          const Icon = tab.icon;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "relative flex flex-1 flex-col items-center gap-1 py-1 text-[10px] font-medium transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              <div
                className={cn(
                  "relative flex items-center justify-center rounded-full px-4 py-1 transition-all",
                  isActive && "bg-primary/10"
                )}
              >
                <Icon className={cn("h-[22px] w-[22px]", isActive && "scale-105")} />
                {tab.badge > 0 && (
                  <span
                    className={cn(
                      "absolute -top-1.5 -right-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[9px] font-bold text-white shadow-sm",
                      tab.badgeColor
                    )}
                  >
                    {tab.badge > 99 ? "99+" : tab.badge}
                  </span>
                )}
              </div>
              <span className="font-semibold">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
