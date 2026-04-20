"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type DetailPanelType = "market" | "profit" | "timing" | "basis";

interface DetailPanelContextValue {
  /** Currently-open panel type, or null if closed. */
  type: DetailPanelType | null;
  isOpen: boolean;
  /** Open a panel. If another panel is already open, switches to the new one. */
  open: (type: DetailPanelType) => void;
  /** Close any open panel. */
  close: () => void;
}

const Context = createContext<DetailPanelContextValue | null>(null);

/**
 * Provides the detail-panel state for a page. Panels are cross-cutting
 * (a card anywhere on the page can trigger opening the right panel), so
 * we keep the state at page level rather than prop-drilling.
 *
 * Only "which panel is open" lives here. The panel's *content* reads
 * scene data independently (keeps the API narrow).
 */
export function DetailPanelProvider({ children }: { children: ReactNode }) {
  const [type, setType] = useState<DetailPanelType | null>(null);

  const open = useCallback((next: DetailPanelType) => setType(next), []);
  const close = useCallback(() => setType(null), []);

  const value = useMemo<DetailPanelContextValue>(
    () => ({ type, isOpen: type !== null, open, close }),
    [type, open, close],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/**
 * Access the detail-panel controller. Must be called under a
 * <DetailPanelProvider>.
 */
export function useDetailPanel(): DetailPanelContextValue {
  const v = useContext(Context);
  if (v === null) {
    throw new Error("useDetailPanel must be used inside <DetailPanelProvider>");
  }
  return v;
}
