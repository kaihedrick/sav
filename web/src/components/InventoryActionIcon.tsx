type Action = "import" | "sheet" | "refresh" | "export" | "copy";

const colors: Record<Action, string> = {
  import: "bg-violet-100 text-violet-800",
  sheet: "bg-emerald-100 text-emerald-800",
  refresh: "bg-sky-100 text-sky-800",
  export: "bg-amber-100 text-amber-800",
  copy: "bg-rose-100 text-rose-800",
};

/** Distinct silhouettes stay recognizable without relying on color or an icon font. */
export function InventoryActionIcon({ action, busy = false }: { action: Action; busy?: boolean }) {
  return (
    <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${colors[action]}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
        className={`h-5 w-5 ${busy ? "motion-safe:animate-spin" : ""}`}>
        {busy ? <><path d="M20 12a8 8 0 1 1-8-8" /><path d="M16 4h4v4" /></> : null}
        {!busy && action === "import" ? <>
          <path d="M12 3v12m-4-4 4 4 4-4" />
          <path d="M4 14v6h16v-6M4 20h16" />
        </> : null}
        {!busy && action === "sheet" ? <>
          <rect x="3" y="4" width="18" height="17" rx="2" />
          <path d="M3 9h18M3 15h18M9 9v12M15 9v12" />
        </> : null}
        {!busy && action === "refresh" ? <>
          <path d="M20 9a8 8 0 0 0-13.7-3L3 9m0-5v5h5M4 15a8 8 0 0 0 13.7 3l3.3-3m0 5v-5h-5" />
        </> : null}
        {!busy && action === "export" ? <>
          <path d="M14 3H5v18h14v-6M9 15 21 3m-7 0h7v7" />
        </> : null}
        {!busy && action === "copy" ? <>
          <rect x="8" y="8" width="13" height="13" rx="2" />
          <path d="M16 4V3H3v13h1M12 13h5m-5 4h5" />
        </> : null}
      </svg>
    </span>
  );
}
