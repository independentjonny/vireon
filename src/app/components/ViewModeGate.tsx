"use client";
import { useViewMode, type ViewMode } from "./ViewModeContext";
import type { ReactNode } from "react";

export default function ViewModeGate({
  modes,
  children,
}: {
  modes: ViewMode[];
  children: ReactNode;
}) {
  const { mode } = useViewMode();
  if (!modes.includes(mode)) return null;
  return <>{children}</>;
}
