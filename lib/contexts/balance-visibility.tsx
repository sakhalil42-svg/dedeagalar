"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface BalanceVisibilityContextValue {
  isVisible: boolean;
  toggle: () => void;
}

const BalanceVisibilityContext = createContext<BalanceVisibilityContextValue>({
  isVisible: false,
  toggle: () => {},
});

export function BalanceVisibilityProvider({ children }: { children: ReactNode }) {
  const [isVisible, setIsVisible] = useState(false);
  const toggle = useCallback(() => setIsVisible((v) => !v), []);

  return (
    <BalanceVisibilityContext.Provider value={{ isVisible, toggle }}>
      {children}
    </BalanceVisibilityContext.Provider>
  );
}

export function useBalanceVisibility() {
  return useContext(BalanceVisibilityContext);
}

const MASKED = "••••••";

export function useMaskedCurrency(formatter: (amount: number) => string) {
  const { isVisible } = useBalanceVisibility();
  return useCallback(
    (amount: number) => (isVisible ? formatter(amount) : MASKED),
    [isVisible, formatter]
  );
}
