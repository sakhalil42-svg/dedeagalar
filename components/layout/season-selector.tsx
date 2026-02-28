"use client";

import { useSeasons } from "@/lib/hooks/use-seasons";
import { useSeasonFilter } from "@/lib/contexts/season-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "lucide-react";

export function SeasonSelector() {
  const { data: seasons, isLoading } = useSeasons();
  const { selectedSeasonId, setSelectedSeasonId } = useSeasonFilter();

  if (isLoading) return null;

  return (
    <Select
      value={selectedSeasonId || "all"}
      onValueChange={(v) => setSelectedSeasonId(v === "all" ? null : v)}
    >
      <SelectTrigger className="h-7 w-auto gap-1 border-none bg-muted/50 px-2 text-xs font-medium">
        <Calendar className="h-3 w-3 shrink-0" />
        <SelectValue placeholder="Sezon" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Tüm Sezonlar</SelectItem>
        {(seasons || []).map((s) => (
          <SelectItem key={s.id} value={s.id}>
            {s.name}
            {s.is_active ? " *" : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
