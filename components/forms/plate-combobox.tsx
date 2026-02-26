"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useVehicles, useCreateVehicle } from "@/lib/hooks/use-vehicles";
import { useCarriers } from "@/lib/hooks/use-carriers";
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
import type { Vehicle } from "@/lib/types/database.types";

interface PlateComboboxProps {
  value: string;
  onChange: (plate: string) => void;
  onVehicleSelect?: (vehicle: Vehicle) => void;
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
  const [newDriverName, setNewDriverName] = useState("");
  const [newDriverPhone, setNewDriverPhone] = useState("");
  const [newCarrierId, setNewCarrierId] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: vehicles } = useVehicles();
  const { data: carriers } = useCarriers();
  const createVehicle = useCreateVehicle();

  // Normalize: strip spaces for comparison so "42 BN 010" matches "42BN010"
  const norm = (s: string) => s.replace(/\s+/g, "").toUpperCase();
  const normValue = norm(value);

  const filtered = (vehicles || []).filter((v) =>
    norm(v.plate).includes(normValue)
  );

  const exactMatch = (vehicles || []).some(
    (v) => norm(v.plate) === normValue
  );

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setShowNewForm(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSelect = useCallback(
    (vehicle: Vehicle) => {
      onChange(vehicle.plate);
      onVehicleSelect?.(vehicle);
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
      const vehicle = await createVehicle.mutateAsync({
        plate: value.trim().toUpperCase(),
        driver_name: newDriverName.trim() || null,
        driver_phone: newDriverPhone.trim() || null,
        carrier_id: newCarrierId || null,
      });
      // Build a vehicle-like object with carrier info for the callback
      const selectedCarrier = carriers?.find((c) => c.id === newCarrierId);
      const vehicleWithCarrier: Vehicle = {
        ...vehicle,
        carrier: selectedCarrier || undefined,
      };
      onVehicleSelect?.(vehicleWithCarrier);
      setOpen(false);
      setShowNewForm(false);
    } catch {
      // silently fail
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
                      {v.driver_name && (
                        <span className="text-xs text-muted-foreground">
                          {v.driver_name}
                        </span>
                      )}
                      {v.carrier?.name && (
                        <span className="text-xs text-muted-foreground">
                          ({v.carrier.name})
                        </span>
                      )}
                      {norm(v.plate) === normValue && (
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
            /* Inline new vehicle form */
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
