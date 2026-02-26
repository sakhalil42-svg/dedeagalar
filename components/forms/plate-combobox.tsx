"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useCreateVehicle } from "@/lib/hooks/use-vehicles";
import { useCarriers } from "@/lib/hooks/use-carriers";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Truck, Plus, Check, Save, X } from "lucide-react";

// Simplified vehicle type for this component — no dependency on shared hook
interface SimpleVehicle {
  id: string;
  plate: string;
  driver_name: string | null;
  driver_phone: string | null;
  carrier_id: string | null;
  carrier_name?: string | null;
  carrier_phone?: string | null;
}

interface PlateComboboxProps {
  value: string;
  onChange: (plate: string) => void;
  onVehicleSelect?: (info: {
    plate: string;
    driverName: string;
    driverPhone: string;
    carrierName: string;
    carrierPhone: string;
  }) => void;
  className?: string;
}

export function PlateCombobox({
  value,
  onChange,
  onVehicleSelect,
  className,
}: PlateComboboxProps) {
  const [open, setOpen] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [vehicles, setVehicles] = useState<SimpleVehicle[]>([]);
  const [newDriverName, setNewDriverName] = useState("");
  const [newDriverPhone, setNewDriverPhone] = useState("");
  const [newCarrierId, setNewCarrierId] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: carriers } = useCarriers();
  const createVehicle = useCreateVehicle();

  // Fetch ALL vehicles directly on mount — simple, no shared hook complexity
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("vehicles")
      .select("*")
      .then(({ data, error }) => {
        if (error) {
          console.error("[PlateCombobox] vehicles fetch error:", error);
          return;
        }
        if (!data || data.length === 0) {
          setVehicles([]);
          return;
        }

        // Now fetch carriers for these vehicles
        const carrierIds = [...new Set(data.map((v: Record<string, unknown>) => v.carrier_id).filter(Boolean))] as string[];
        if (carrierIds.length > 0) {
          supabase
            .from("carriers")
            .select("id, name, phone")
            .in("id", carrierIds)
            .then(({ data: carrierData }) => {
              const cMap = new Map<string, { name: string; phone: string | null }>();
              if (carrierData) {
                carrierData.forEach((c: Record<string, unknown>) => {
                  cMap.set(c.id as string, { name: c.name as string, phone: c.phone as string | null });
                });
              }
              setVehicles(
                data.map((v: Record<string, unknown>) => ({
                  id: v.id as string,
                  plate: v.plate as string,
                  driver_name: v.driver_name as string | null,
                  driver_phone: v.driver_phone as string | null,
                  carrier_id: v.carrier_id as string | null,
                  carrier_name: v.carrier_id ? cMap.get(v.carrier_id as string)?.name || null : null,
                  carrier_phone: v.carrier_id ? cMap.get(v.carrier_id as string)?.phone || null : null,
                }))
              );
            });
        } else {
          setVehicles(
            data.map((v: Record<string, unknown>) => ({
              id: v.id as string,
              plate: v.plate as string,
              driver_name: v.driver_name as string | null,
              driver_phone: v.driver_phone as string | null,
              carrier_id: v.carrier_id as string | null,
            }))
          );
        }
      });
  }, []);

  // Simple filter — case insensitive, trim
  const searchText = value.trim().toLowerCase();
  const filtered = vehicles.filter((v) =>
    v.plate.toLowerCase().includes(searchText)
  );
  const exactMatch = vehicles.some(
    (v) => v.plate.toLowerCase().trim() === searchText
  );

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowNewForm(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSelect = useCallback(
    (v: SimpleVehicle) => {
      onChange(v.plate);
      onVehicleSelect?.({
        plate: v.plate,
        driverName: v.driver_name || "",
        driverPhone: v.driver_phone || "",
        carrierName: v.carrier_name || "",
        carrierPhone: v.carrier_phone || "",
      });
      setOpen(false);
      setShowNewForm(false);
    },
    [onChange, onVehicleSelect]
  );

  const openNewForm = () => {
    setNewDriverName("");
    setNewDriverPhone("");
    setNewCarrierId("");
    setShowNewForm(true);
  };

  const handleSaveNew = async () => {
    if (!value.trim()) return;
    setSaving(true);
    try {
      await createVehicle.mutateAsync({
        plate: value.trim().toUpperCase(),
        driver_name: newDriverName.trim() || null,
        driver_phone: newDriverPhone.trim() || null,
        carrier_id: newCarrierId || null,
      });
      const selectedCarrier = carriers?.find((c) => c.id === newCarrierId);
      // Add to local list immediately
      const newVehicle: SimpleVehicle = {
        id: "new-" + Date.now(),
        plate: value.trim().toUpperCase(),
        driver_name: newDriverName.trim() || null,
        driver_phone: newDriverPhone.trim() || null,
        carrier_id: newCarrierId || null,
        carrier_name: selectedCarrier?.name || null,
        carrier_phone: selectedCarrier?.phone || null,
      };
      setVehicles((prev) => [...prev, newVehicle]);
      onVehicleSelect?.({
        plate: newVehicle.plate,
        driverName: newVehicle.driver_name || "",
        driverPhone: newVehicle.driver_phone || "",
        carrierName: newVehicle.carrier_name || "",
        carrierPhone: newVehicle.carrier_phone || "",
      });
      setOpen(false);
      setShowNewForm(false);
    } catch (err) {
      console.error("[PlateCombobox] save error:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Truck className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="34 XX 1234"
          value={value}
          onChange={(e) => {
            onChange(e.target.value.toUpperCase());
            setOpen(true);
            setShowNewForm(false);
          }}
          onFocus={() => setOpen(true)}
          className={`h-9 pl-7 text-sm font-mono ${className || ""}`}
          autoComplete="off"
        />
      </div>

      {open && value.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-background shadow-lg">
          {!showNewForm ? (
            <div className="max-h-48 overflow-y-auto py-1">
              {filtered.length > 0
                ? filtered.slice(0, 8).map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => handleSelect(v)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50"
                    >
                      <span className="font-mono font-medium">{v.plate}</span>
                      <span className="text-xs text-muted-foreground truncate">
                        {[v.driver_name, v.carrier_name && `(${v.carrier_name})`]
                          .filter(Boolean)
                          .join(" · ") || ""}
                      </span>
                      {v.plate.toLowerCase().trim() === searchText && (
                        <Check className="ml-auto h-3 w-3 text-green-600" />
                      )}
                    </button>
                  ))
                : null}

              {!exactMatch && value.trim().length >= 3 && (
                <button
                  type="button"
                  onClick={openNewForm}
                  className="flex w-full items-center gap-2 border-t px-3 py-2 text-left text-sm text-primary hover:bg-muted/50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>&quot;{value.trim()}&quot; yeni plaka ekle</span>
                </button>
              )}

              {filtered.length === 0 && value.trim().length < 3 && (
                <p className="px-3 py-2 text-xs text-muted-foreground">
                  En az 3 karakter yazın...
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2 p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">
                  Yeni Araç: <span className="font-mono font-bold text-foreground">{value.trim()}</span>
                </p>
                <button
                  type="button"
                  onClick={() => setShowNewForm(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Şoför Adı</Label>
                <Input
                  placeholder="Ad Soyad"
                  value={newDriverName}
                  onChange={(e) => setNewDriverName(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Şoför Tel</Label>
                <Input
                  type="tel"
                  inputMode="tel"
                  placeholder="05XX XXX XXXX"
                  value={newDriverPhone}
                  onChange={(e) => setNewDriverPhone(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Nakliyeci</Label>
                <Select value={newCarrierId} onValueChange={setNewCarrierId}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Nakliyeci seç (opsiyonel)" />
                  </SelectTrigger>
                  <SelectContent>
                    {(carriers || []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                        {c.phone ? ` (${c.phone})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="button"
                size="sm"
                className="w-full"
                onClick={handleSaveNew}
                disabled={saving}
              >
                <Save className="mr-1 h-3.5 w-3.5" />
                {saving ? "Kaydediliyor..." : "Kaydet"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
