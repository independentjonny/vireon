"use client";

import { useEffect, useState } from "react";

export default function DeveloperModeGate({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const sync = () => setEnabled(window.localStorage.getItem("vireon-developer-mode") === "true");
    sync();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "d") {
        window.setTimeout(sync, 0);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("storage", sync);
    window.addEventListener("vireon-developer-mode-change", sync);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("storage", sync);
      window.removeEventListener("vireon-developer-mode-change", sync);
    };
  }, []);

  if (!enabled) return null;

  return <>{children}</>;
}
