"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useCreateVehicle } from "@/lib/hooks/use-vehicles";
import { useCarriers, useCreateCarrier } from "@/lib/hooks/use-carriers";
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

const NEW_CARRIER_SENTINEL = "__new__";

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
  const [newCarrierName, setNewCarrierName] = useState("");
  const [newCarrierPhone, setNewCarrierPhone] = useState("");
  const [creatingCarrier, setCreatingCarrier] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: carriers } = useCarriers();
  const createVehicle = useCreateVehicle();
  const createCarrier = useCreateCarrier();

  const hasCarriers = carriers && carriers.length > 0;
  const showNewCarrierFields = !hasCarriers || newCarrierId === NEW_CARRIER_SENTINEL;

  // Is carrier selected or entered?
  const carrierValid = showNewCarrierFields
    ? newCarrierName.trim().length > 0
    : newCarrierId.length > 0;

  // Fetch ALL vehicles directly on mount — simple, no shared hook complexity
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("vehicles")
      .select("*")
      .then(({ data, error }) => {
        if (error) {
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
    setNewCarrierName("");
    setNewCarrierPhone("");
    setCreatingCarrier(false);
    setShowNewForm(true);
  };

  const handleSaveNew = async () => {
    if (!value.trim()) return;
    if (!carrierValid) return;

    setSaving(true);
    try {
      // If creating new carrier, do it first
      let finalCarrierId = newCarrierId === NEW_CARRIER_SENTINEL ? "" : newCarrierId;
      let finalCarrierName = "";
      let finalCarrierPhone = "";

      if (showNewCarrierFields && newCarrierName.trim()) {
        // Create new carrier
        setCreatingCarrier(true);
        const created = await createCarrier.mutateAsync({
          name: newCarrierName.trim(),
          phone: newCarrierPhone.trim() || null,
        });
        finalCarrierId = created.id;
        finalCarrierName = newCarrierName.trim();
        finalCarrierPhone = newCarrierPhone.trim();
        setCreatingCarrier(false);
      } else if (finalCarrierId) {
        const selectedCarrier = carriers?.find((c) => c.id === finalCarrierId);
        finalCarrierName = selectedCarrier?.name || "";
        finalCarrierPhone = selectedCarrier?.phone || "";
      }

      await createVehicle.mutateAsync({
        plate: value.trim().toUpperCase(),
        driver_name: newDriverName.trim() || null,
        driver_phone: newDriverPhone.trim() || null,
        carrier_id: finalCarrierId || null,
      });

      // Add to local list immediately
      const newVehicle: SimpleVehicle = {
        id: "new-" + Date.now(),
        plate: value.trim().toUpperCase(),
        driver_name: newDriverName.trim() || null,
        driver_phone: newDriverPhone.trim() || null,
        carrier_id: finalCarrierId || null,
        carrier_name: finalCarrierName || null,
        carrier_phone: finalCarrierPhone || null,
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
      // save error — silently handled
    } finally {
      setSaving(false);
      setCreatingCarrier(false);
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

              {/* Nakliyeci — zorunlu alan */}
              <div>
                <Label className="text-xs text-muted-foreground">
                  Nakliyeci *
                </Label>
                {hasCarriers ? (
                  <Select value={newCarrierId} onValueChange={setNewCarrierId}>
                    <SelectTrigger className={`h-8 text-sm ${!carrierValid ? "border-red-300" : ""}`}>
                      <SelectValue placeholder="Nakliyeci seç" />
                    </SelectTrigger>
                    <SelectContent>
                      {carriers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                          {c.phone ? ` (${c.phone})` : ""}
                        </SelectItem>
                      ))}
                      <SelectItem value={NEW_CARRIER_SENTINEL}>
                        <span className="flex items-center gap-1 text-primary">
                          <Plus className="h-3 w-3" />
                          Yeni Nakliyeci Ekle
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                ) : null}

                {/* Yeni nakliyeci alanları — listede seçenek yoksa veya "Yeni Ekle" seçildiyse */}
                {showNewCarrierFields && (
                  <div className="mt-1.5 space-y-1.5 rounded-md border border-dashed border-primary/30 bg-primary/5 p-2">
                    <p className="text-[10px] font-medium text-primary">Yeni Nakliyeci</p>
                    <Input
                      placeholder="Nakliyeci adı *"
                      value={newCarrierName}
                      onChange={(e) => setNewCarrierName(e.target.value)}
                      className={`h-7 text-xs ${!newCarrierName.trim() ? "border-red-300" : ""}`}
                      autoFocus={newCarrierId === NEW_CARRIER_SENTINEL}
                    />
                    <Input
                      type="tel"
                      inputMode="tel"
                      placeholder="Telefon (opsiyonel)"
                      value={newCarrierPhone}
                      onChange={(e) => setNewCarrierPhone(e.target.value)}
                      className="h-7 text-xs"
                    />
                  </div>
                )}
              </div>

              <Button
                type="button"
                size="sm"
                className="w-full"
                onClick={handleSaveNew}
                disabled={saving || creatingCarrier || !carrierValid}
              >
                <Save className="mr-1 h-3.5 w-3.5" />
                {creatingCarrier ? "Nakliyeci oluşturuluyor..." : saving ? "Kaydediliyor..." : "Kaydet"}
              </Button>
              {!carrierValid && (
                <p className="text-[10px] text-red-500 text-center">
                  Nakliyeci seçimi zorunludur
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
