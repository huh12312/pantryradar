import { vi } from "vitest";

let currentWidth = 360;

export function setViewportWidth(width: number) {
  currentWidth = width;
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width,
  });
  window.dispatchEvent(new Event("resize"));
}

export function getViewportWidth() {
  return currentWidth;
}

function evaluate(query: string): boolean {
  // Supports comma-separated queries with simple min-width / max-width clauses.
  return query.split(",").some((clause) => {
    const min = clause.match(/min-width:\s*(\d+)px/);
    const max = clause.match(/max-width:\s*(\d+)px/);
    if (clause.includes("prefers-color-scheme")) {
      return /light/i.test(clause);
    }
    let matches = true;
    if (min) matches = matches && currentWidth >= Number(min[1]);
    if (max) matches = matches && currentWidth <= Number(max[1]);
    return matches;
  });
}

if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: evaluate(query),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}
