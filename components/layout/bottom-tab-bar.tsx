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
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background pb-[env(safe-area-inset-bottom)]">
      <div className="flex h-16 items-center justify-around">
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
                "relative flex flex-col items-center gap-0.5 px-3 py-1 text-xs transition-colors",
                isActive
                  ? "text-primary font-medium"
                  : "text-muted-foreground"
              )}
            >
              <div className="relative">
                <Icon className="h-5 w-5" />
                {tab.badge > 0 && (
                  <span
                    className={cn(
                      "absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white",
                      tab.badgeColor
                    )}
                  >
                    {tab.badge > 99 ? "99+" : tab.badge}
                  </span>
                )}
              </div>
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
