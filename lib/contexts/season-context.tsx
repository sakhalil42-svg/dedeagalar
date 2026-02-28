"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useActiveSeason } from "@/lib/hooks/use-seasons";

interface SeasonContextValue {
  selectedSeasonId: string | null;
  setSelectedSeasonId: (id: string | null) => void;
}

const SeasonContext = createContext<SeasonContextValue>({
  selectedSeasonId: null,
  setSelectedSeasonId: () => {},
});

const STORAGE_KEY = "dedeagalar_season_id";

export function SeasonProvider({ children }: { children: ReactNode }) {
  const [selectedSeasonId, setSelectedSeasonIdState] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const { data: activeSeason } = useActiveSeason();

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setSelectedSeasonIdState(stored === "all" ? null : stored);
    }
    setInitialized(true);
  }, []);

  // If not initialized from localStorage, use active season
  useEffect(() => {
    if (initialized && !localStorage.getItem(STORAGE_KEY) && activeSeason) {
      setSelectedSeasonIdState(activeSeason.id);
    }
  }, [initialized, activeSeason]);

  const setSelectedSeasonId = useCallback((id: string | null) => {
    setSelectedSeasonIdState(id);
    localStorage.setItem(STORAGE_KEY, id || "all");
  }, []);

  return (
    <SeasonContext.Provider value={{ selectedSeasonId, setSelectedSeasonId }}>
      {children}
    </SeasonContext.Provider>
  );
}

export function useSeasonFilter() {
  return useContext(SeasonContext);
}
