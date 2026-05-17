import * as React from "react";
import { cn } from "@/lib/utils";

export type Section = "all" | "pantry" | "fridge" | "freezer";

const TABS: { value: Section; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pantry", label: "Pantry" },
  { value: "fridge", label: "Fridge" },
  { value: "freezer", label: "Freezer" },
];

export interface SegmentedTabsProps {
  value: Section;
  onChange: (value: Section) => void;
  counts?: Partial<Record<Section, number>>;
  className?: string;
}

export function SegmentedTabs({ value, onChange, counts, className }: SegmentedTabsProps) {
  const tabRefs = React.useRef<Array<HTMLButtonElement | null>>([]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const next = (index + direction + TABS.length) % TABS.length;
    const nextTab = TABS[next];
    if (!nextTab) return;
    tabRefs.current[next]?.focus();
    onChange(nextTab.value);
  };

  return (
    <div
      role="tablist"
      aria-label="Inventory location"
      className={cn("flex w-full items-center gap-1 rounded-full bg-muted p-1", className)}
    >
      {TABS.map((tab, index) => {
        const selected = tab.value === value;
        const count = counts?.[tab.value];
        return (
          <button
            key={tab.value}
            ref={(el) => {
              tabRefs.current[index] = el;
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              "flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span>{tab.label}</span>
            {typeof count === "number" ? (
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs",
                  selected
                    ? "bg-primary/10 text-primary"
                    : "bg-muted-foreground/20 text-muted-foreground"
                )}
              >
                {count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
