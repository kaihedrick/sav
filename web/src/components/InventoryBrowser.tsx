import { useMemo, useState, type ReactNode } from "react";
import {
  stockLevelFromOnHand,
  stockStatusClasses,
  type StockLevel,
} from "../lib/inventoryCardStyle";

export type StockFilter = "all" | StockLevel;

export type CatalogItem = {
  id: string;
  name: string;
  category: string;
  onHand: number;
};

function categoryLabel(category: string): string {
  const t = category.trim();
  return t || "Uncategorized";
}

function worstLevel(items: { onHand: number }[]): StockLevel {
  if (items.some((it) => stockLevelFromOnHand(it.onHand) === "out")) return "out";
  if (items.some((it) => stockLevelFromOnHand(it.onHand) === "low")) return "low";
  return "ok";
}

function groupByCategory<T extends CatalogItem>(
  items: T[],
): { category: string; items: T[] }[] {
  const map = new Map<string, T[]>();
  for (const it of items) {
    const key = categoryLabel(it.category);
    const list = map.get(key);
    if (list) list.push(it);
    else map.set(key, [it]);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([category, grouped]) => ({ category, items: grouped }));
}

export function InventoryBrowser<T extends CatalogItem>({
  items,
  renderItem,
}: {
  items: T[];
  renderItem: (item: T) => ReactNode;
}) {
  const [filter, setFilter] = useState<StockFilter>("all");
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const counts = useMemo(() => {
    let ok = 0;
    let low = 0;
    let out = 0;
    for (const it of items) {
      const level = stockLevelFromOnHand(it.onHand);
      if (level === "ok") ok += 1;
      else if (level === "low") low += 1;
      else out += 1;
    }
    return { total: items.length, ok, low, out };
  }, [items]);

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((it) => stockLevelFromOnHand(it.onHand) === filter);
  }, [items, filter]);

  const groups = useMemo(() => groupByCategory(filtered), [filtered]);

  return (
    <div>
      <div
        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
        role="tablist"
        aria-label="Stock filter"
      >
        <StatCard
          icon="fa-box"
          label="Total Needs"
          value={counts.total}
          active={filter === "all"}
          onClick={() => setFilter("all")}
        />
        <StatCard
          icon="fa-circle-check"
          label="In Stock"
          value={counts.ok}
          active={filter === "ok"}
          onClick={() => setFilter("ok")}
        />
        <StatCard
          icon="fa-triangle-exclamation"
          label="Low Stock"
          value={counts.low}
          active={filter === "low"}
          onClick={() => setFilter("low")}
        />
        <StatCard
          icon="fa-circle-xmark"
          label="Out of Stock"
          value={counts.out}
          active={filter === "out"}
          onClick={() => setFilter("out")}
        />
      </div>

      <div className="mt-4 space-y-3">
        {groups.length === 0 ? (
          <p className="surface-glass px-4 py-3 text-sm text-bob-muted">
            Empty
          </p>
        ) : (
          groups.map((group) => {
            const expanded = open[group.category] === true;
            const status = stockStatusClasses(worstLevel(group.items));
            return (
              <section
                key={group.category}
                className="overflow-hidden rounded-2xl border border-bob-mist/90 bg-bob-card/80 shadow-sm"
              >
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                  aria-expanded={expanded}
                  onClick={() =>
                    setOpen((prev) => ({
                      ...prev,
                      [group.category]: !expanded,
                    }))
                  }
                >
                  <i
                    className={`fa-solid fa-chevron-right text-xs text-bob-gold transition-transform ${
                      expanded ? "rotate-90" : ""
                    }`}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-bob-ink">{group.category}</h3>
                    <p className="text-xs text-bob-muted">
                      {group.items.length}{" "}
                      {group.items.length === 1 ? "item" : "items"}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.pillClass}`}
                  >
                    {status.label}
                  </span>
                </button>
                {expanded ? (
                  <div className="space-y-2 border-t border-bob-mist/70 p-3">
                    {group.items.map((it) => (
                      <div key={it.id}>{renderItem(it)}</div>
                    ))}
                  </div>
                ) : null}
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  active,
  onClick,
}: {
  icon: string;
  label: string;
  value: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`rounded-2xl border px-3 py-2.5 text-left shadow-sm transition-colors ${
        active
          ? "border-bob-wood bg-bob-wood text-white"
          : "border-bob-mist/80 bg-white/70 hover:bg-white"
      }`}
    >
      <p
        className={`flex items-center gap-1.5 text-xs font-medium ${
          active ? "text-white/85" : "text-bob-muted"
        }`}
      >
        <i
          className={`fa-solid ${icon} ${active ? "text-white/90" : "text-bob-wood/80"}`}
          aria-hidden
        />
        {label}
      </p>
      <p
        className={`mt-1 text-xl font-semibold ${
          active ? "text-white" : "text-bob-ink"
        }`}
      >
        {value}
      </p>
    </button>
  );
}
