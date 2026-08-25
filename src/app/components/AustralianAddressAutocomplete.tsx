"use client";

import { CheckCircle2, LoaderCircle, MapPin, Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

export type AustralianAddressSelection = {
  id: string;
  address: string;
  locality: string | null;
  state: string | null;
  postcode: string | null;
  provider: "geoscape-gnaf";
};

type Props = {
  value: string;
  selectionId: string;
  onChange: (address: string, selection: AustralianAddressSelection | null) => void;
};

export default function AustralianAddressAutocomplete({ value, selectionId, onChange }: Props) {
  const inputId = useId();
  const listId = `${inputId}-suggestions`;
  const requestSequence = useRef(0);
  const [suggestions, setSuggestions] = useState<AustralianAddressSelection[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    const query = value.trim();
    if (selectionId || query.length < 4) {
      requestSequence.current += 1;
      return;
    }

    const controller = new AbortController();
    const sequence = ++requestSequence.current;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setMessage("");
      try {
        const response = await fetch(`/api/addresses/australian?q=${encodeURIComponent(query)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json()) as { suggestions?: AustralianAddressSelection[]; error?: string };
        if (sequence !== requestSequence.current) return;
        if (!response.ok) throw new Error(payload.error || "Address search unavailable.");
        const next = Array.isArray(payload.suggestions) ? payload.suggestions : [];
        setSuggestions(next);
        setOpen(true);
        setActiveIndex(next.length ? 0 : -1);
        setMessage(next.length ? "" : "No matching Australian addresses. You can continue with manual entry.");
      } catch (error) {
        if (controller.signal.aborted || sequence !== requestSequence.current) return;
        setSuggestions([]);
        setOpen(true);
        setMessage(error instanceof Error ? error.message : "Address search unavailable.");
      } finally {
        if (sequence === requestSequence.current) setLoading(false);
      }
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [selectionId, value]);

  function choose(suggestion: AustralianAddressSelection) {
    onChange(suggestion.address, suggestion);
    setSuggestions([]);
    setOpen(false);
    setActiveIndex(-1);
    setMessage("");
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          id={inputId}
          role="combobox"
          aria-label="Property address"
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={open && Boolean(suggestions.length)}
          aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
          autoComplete="off"
          value={value}
          onChange={(event) => {
            const nextValue = event.target.value;
            requestSequence.current += 1;
            setSuggestions([]);
            setLoading(false);
            setActiveIndex(-1);
            setMessage(nextValue.trim().length > 0 && nextValue.trim().length < 4 ? "Enter at least 4 characters to search." : "");
            onChange(nextValue, null);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" && suggestions.length) {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((index) => (index + 1) % suggestions.length);
            } else if (event.key === "ArrowUp" && suggestions.length) {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
            } else if (event.key === "Enter" && open && activeIndex >= 0) {
              event.preventDefault();
              choose(suggestions[activeIndex]);
            } else if (event.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder="Start typing an Australian street address"
          className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-10 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
        {loading ? <LoaderCircle className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-blue-700" aria-hidden="true" /> : null}
      </div>

      {open && suggestions.length ? (
        <ul id={listId} role="listbox" className="absolute z-30 mt-2 max-h-72 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
          {suggestions.map((suggestion, index) => (
            <li
              id={`${listId}-${index}`}
              key={suggestion.id}
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(suggestion)}
              className={"flex cursor-pointer items-start gap-3 rounded-lg px-3 py-3 text-sm " + (index === activeIndex ? "bg-blue-50 text-blue-950" : "text-slate-700 hover:bg-slate-50")}
            >
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
              <span>{suggestion.address}</span>
            </li>
          ))}
          <li className="border-t border-slate-100 px-3 py-2 text-[11px] text-slate-500">Australian address data supplied by Geoscape Australia (G-NAF).</li>
        </ul>
      ) : null}

      <div className="mt-2 min-h-5 text-xs text-slate-500" aria-live="polite">
        {selectionId ? <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700"><CheckCircle2 className="h-4 w-4" />Australian address selected</span> : message || "Search Geoscape’s Australian G-NAF address directory, or enter the address manually."}
      </div>
    </div>
  );
}
