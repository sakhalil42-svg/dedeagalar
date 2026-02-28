"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Leaf, User, Lock, Eye, EyeOff, ArrowRight, Headset } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-svh flex-col">
      {/* Hero Section */}
      <div className="flex flex-1 flex-col items-center justify-center bg-gradient-to-b from-primary/5 to-primary/10 px-4 pb-12 pt-16">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10 mb-5">
          <Leaf className="h-12 w-12 text-primary" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Dedeağalar Grup</h1>
        <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold mt-1">
          KABA YEM TİCARET
        </p>
      </div>

      {/* Form Section */}
      <div className="-mt-6 rounded-t-3xl bg-card px-6 pb-8 pt-8 shadow-[0_-4px_24px_rgba(0,0,0,0.06)]">
        <div className="mx-auto max-w-sm">
          <h2 className="text-2xl font-bold text-center">Hoş Geldiniz</h2>
          <p className="text-sm text-muted-foreground text-center mt-1 mb-6">
            Devam etmek için hesabınıza giriş yapın
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Email input */}
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-muted-foreground" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="user@example.com"
                autoComplete="email"
                className="w-full rounded-xl bg-muted px-4 py-3.5 pl-11 text-sm outline-none ring-0 focus:ring-2 focus:ring-primary/30 transition-shadow placeholder:text-muted-foreground/60"
              />
            </div>

            {/* Password input */}
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-muted-foreground" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full rounded-xl bg-muted px-4 py-3.5 pl-11 pr-11 text-sm outline-none ring-0 focus:ring-2 focus:ring-primary/30 transition-shadow placeholder:text-muted-foreground/60"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
              </button>
            </div>

            {/* Remember me + Forgot password */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                <span className="text-muted-foreground text-xs">Beni Hatırla</span>
              </label>
              <button type="button" className="text-xs text-primary font-medium hover:underline">
                Şifremi Unuttum?
              </button>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-primary py-4 text-base font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? "Giriş yapılıyor..." : (
                <>
                  Giriş Yap
                  <ArrowRight className="h-4.5 w-4.5" />
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="flex items-center justify-center gap-1.5 mt-8 text-xs text-muted-foreground">
            <Headset className="h-3.5 w-3.5" />
            <span>Sorun mu yaşıyorsunuz?</span>
            <button type="button" className="text-primary font-medium hover:underline">
              Bize Ulaşın
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
