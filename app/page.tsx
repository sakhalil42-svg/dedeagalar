import { createClient } from "@/lib/supabase/server";
import { Settings } from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { BalanceToggle } from "@/components/layout/balance-toggle";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const fullName =
    user?.user_metadata?.full_name || user?.email || "Kullanıcı";

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Kaba Yem Ticaret</h1>
          <p className="text-sm text-muted-foreground">
            Hoş geldin, {fullName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BalanceToggle />
          <Link
            href="/settings"
            className="flex h-9 w-9 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-muted"
          >
            <Settings className="h-4 w-4" />
          </Link>
          <SignOutButton />
        </div>
      </div>

      <DashboardContent />
    </div>
  );
}
