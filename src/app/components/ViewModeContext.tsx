"use client";
import { createContext, useState, useContext } from "react";
import type { ReactNode } from "react";

export type ViewMode = "executive" | "operator" | "engineering" | "runtime";

interface ViewModeContextValue {
  mode: ViewMode;
  setMode: (m: ViewMode) => void;
}

export const ViewModeContext = createContext<ViewModeContextValue>({
  mode: "executive",
  setMode: () => {},
});

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ViewMode>("executive");
  return (
    <ViewModeContext.Provider value={{ mode, setMode }}>
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode() {
  return useContext(ViewModeContext);
}
