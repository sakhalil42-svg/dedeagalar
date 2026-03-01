"use client";

import { useParcels } from "@/lib/hooks/use-parcels";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ParcelSelectProps {
  value: string | null;
  onChange: (parcelId: string | null) => void;
  seasonId?: string | null;
  className?: string;
}

export function ParcelSelect({ value, onChange, seasonId, className }: ParcelSelectProps) {
  const { data: parcels } = useParcels(seasonId);

  // Only show active/baling parcels with remaining bales
  const availableParcels = (parcels || []).filter(
    (p) => (p.status === "active" || p.status === "baling") && p.remaining_bales > 0
  );

  if (availableParcels.length === 0) return null;

  return (
    <Select
      value={value || "none"}
      onValueChange={(v) => onChange(v === "none" ? null : v)}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder="Parsel seç (opsiyonel)" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Parsel yok</SelectItem>
        {availableParcels.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.parcel_name} — {p.contact?.name || "?"} ({p.remaining_bales} balya kaldı)
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
