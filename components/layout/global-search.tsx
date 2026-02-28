"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Search, X, User, Truck, FileText, Building2, Loader2 } from "lucide-react";

interface SearchResult {
  id: string;
  label: string;
  sub?: string;
  href: string;
  category: "contact" | "vehicle" | "ticket" | "carrier";
}

const CATEGORY_META = {
  contact: { icon: User, title: "Kişiler", color: "text-blue-600" },
  vehicle: { icon: Truck, title: "Araçlar", color: "text-orange-600" },
  ticket: { icon: FileText, title: "Fişler", color: "text-green-600" },
  carrier: { icon: Building2, title: "Nakliyeciler", color: "text-purple-600" },
} as const;

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Listen for keyboard shortcut toggle event
  useEffect(() => {
    function handleToggle() {
      setOpen((prev) => !prev);
    }
    window.addEventListener("toggle-global-search", handleToggle);
    return () => window.removeEventListener("toggle-global-search", handleToggle);
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open]);

  // Close on ESC
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("keydown", handleKey);
      return () => document.removeEventListener("keydown", handleKey);
    }
  }, [open]);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const pattern = `%${q}%`;
    const allResults: SearchResult[] = [];

    try {
      // Parallel searches
      const [contactsRes, vehiclesRes, deliveriesRes, carriersRes] = await Promise.all([
        supabase
          .from("contacts")
          .select("id, name, type, phone")
          .ilike("name", pattern)
          .limit(3),
        supabase
          .from("vehicles")
          .select("id, plate, driver_name, carrier_id")
          .ilike("plate", pattern)
          .limit(3),
        supabase
          .from("deliveries")
          .select("id, ticket_no, net_weight, vehicle_plate, sale_id")
          .ilike("ticket_no", pattern)
          .limit(3),
        supabase
          .from("carriers")
          .select("id, name, phone")
          .ilike("name", pattern)
          .eq("is_active", true)
          .limit(3),
      ]);

      // Contacts
      if (contactsRes.data) {
        for (const c of contactsRes.data) {
          const typeLabel = c.type === "customer" ? "Müşteri" : c.type === "supplier" ? "Üretici" : "Üretici/Müşteri";
          allResults.push({
            id: `contact-${c.id}`,
            label: c.name,
            sub: `${typeLabel}${c.phone ? ` · ${c.phone}` : ""}`,
            href: `/contacts/${c.id}`,
            category: "contact",
          });
        }
      }

      // Vehicles
      if (vehiclesRes.data) {
        for (const v of vehiclesRes.data) {
          allResults.push({
            id: `vehicle-${v.id}`,
            label: v.plate,
            sub: v.driver_name || undefined,
            href: v.carrier_id ? `/settings/carriers/${v.carrier_id}` : `/settings/carriers`,
            category: "vehicle",
          });
        }
      }

      // Deliveries (tickets)
      if (deliveriesRes.data) {
        for (const d of deliveriesRes.data) {
          allResults.push({
            id: `ticket-${d.id}`,
            label: `#${d.ticket_no}`,
            sub: `${d.net_weight?.toLocaleString("tr-TR")} kg${d.vehicle_plate ? ` · ${d.vehicle_plate}` : ""}`,
            href: d.sale_id ? `/sales?ticket=${d.id}` : `/sales`,
            category: "ticket",
          });
        }
      }

      // Carriers
      if (carriersRes.data) {
        for (const c of carriersRes.data) {
          allResults.push({
            id: `carrier-${c.id}`,
            label: c.name,
            sub: c.phone || undefined,
            href: `/settings/carriers/${c.id}`,
            category: "carrier",
          });
        }
      }
    } catch {
      // search error — silently handled
    }

    setResults(allResults);
    setLoading(false);
  }, []);

  const handleChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val.trim()), 300);
  };

  const handleSelect = (r: SearchResult) => {
    setOpen(false);
    setQuery("");
    setResults([]);
    router.push(r.href);
  };

  // Group results by category
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    if (!acc[r.category]) acc[r.category] = [];
    acc[r.category].push(r);
    return acc;
  }, {});

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted transition-colors"
        title="Ara"
      >
        <Search className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div ref={containerRef} className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm">
      <div className="mx-auto max-w-lg p-4">
        {/* Search input */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              placeholder="Kişi, plaka, fiş no veya nakliyeci ara..."
              value={query}
              onChange={(e) => handleChange(e.target.value)}
              className="pl-9 h-11 text-base"
              autoComplete="off"
            />
            {loading && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setQuery("");
              setResults([]);
            }}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border text-muted-foreground hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Results */}
        {query.length >= 2 && (
          <div className="mt-3 rounded-lg border bg-background shadow-lg overflow-hidden">
            {Object.entries(grouped).length > 0 ? (
              Object.entries(grouped).map(([category, items]) => {
                const meta = CATEGORY_META[category as keyof typeof CATEGORY_META];
                const Icon = meta.icon;
                return (
                  <div key={category}>
                    <div className="flex items-center gap-2 px-3 py-2 bg-muted/50">
                      <Icon className={`h-3.5 w-3.5 ${meta.color}`} />
                      <span className="text-xs font-medium text-muted-foreground">
                        {meta.title}
                      </span>
                    </div>
                    {items.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => handleSelect(r)}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{r.label}</p>
                          {r.sub && (
                            <p className="text-xs text-muted-foreground truncate">{r.sub}</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                );
              })
            ) : !loading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Sonuç bulunamadı.
              </div>
            ) : null}
          </div>
        )}

        {query.length > 0 && query.length < 2 && (
          <div className="mt-3 rounded-lg border p-4 text-center text-xs text-muted-foreground">
            En az 2 karakter yazın...
          </div>
        )}
      </div>
    </div>
  );
}
