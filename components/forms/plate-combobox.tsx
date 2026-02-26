"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useVehicles, useCreateVehicle } from "@/lib/hooks/use-vehicles";
import { Input } from "@/components/ui/input";
import { Truck, Plus, Check } from "lucide-react";
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
  const [saving, setSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: vehicles } = useVehicles();
  const createVehicle = useCreateVehicle();

  const filtered = (vehicles || []).filter((v) =>
    v.plate.toLowerCase().includes(value.toLowerCase())
  );

  const exactMatch = (vehicles || []).some(
    (v) => v.plate.toLowerCase() === value.toLowerCase()
  );

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
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
    },
    [onChange, onVehicleSelect]
  );

  const handleSaveNew = async () => {
    if (!value.trim() || exactMatch) return;
    setSaving(true);
    try {
      const vehicle = await createVehicle.mutateAsync({
        plate: value.trim().toUpperCase(),
      });
      onVehicleSelect?.(vehicle);
      setOpen(false);
    } catch {
      // silently fail — user can still type freely
    } finally {
      setSaving(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Truck className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          placeholder="34 XX 1234"
          value={value}
          onChange={(e) => {
            onChange(e.target.value.toUpperCase());
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          className={`h-9 pl-7 text-sm font-mono ${className || ""}`}
          autoComplete="off"
        />
      </div>

      {open && value.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-background shadow-lg">
          <div className="max-h-48 overflow-y-auto py-1">
            {filtered.length > 0 ? (
              filtered.slice(0, 8).map((v) => (
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
                  {v.plate.toLowerCase() === value.toLowerCase() && (
                    <Check className="ml-auto h-3 w-3 text-green-600" />
                  )}
                </button>
              ))
            ) : null}

            {!exactMatch && value.trim().length >= 3 && (
              <button
                type="button"
                onClick={handleSaveNew}
                disabled={saving}
                className="flex w-full items-center gap-2 border-t px-3 py-2 text-left text-sm text-primary hover:bg-muted/50"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>
                  {saving
                    ? "Kaydediliyor..."
                    : `"${value.trim()}" plakasını kaydet`}
                </span>
              </button>
            )}

            {filtered.length === 0 && value.trim().length < 3 && (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                En az 3 karakter yazın...
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
