/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect, afterEach, mock } from "bun:test";
import {
  estimateExpiration,
  clearExpirationCache,
  clearBrandCache,
  clearNormalizeCache,
  clearSuggestionCache,
} from "../../lib/openai";
import { _deps } from "../../lib/llm";
import { FOOD_CATEGORIES } from "../../lib/categories";

const originalGenerateObject = _deps.generateObject;

function stubGenerateObject(returnValue: unknown) {
  _deps.generateObject = mock(async () => ({ object: returnValue })) as any;
}

afterEach(() => {
  _deps.generateObject = originalGenerateObject;
  clearExpirationCache();
  clearBrandCache();
  clearNormalizeCache();
  clearSuggestionCache();
});

describe("estimateExpiration", () => {
  test("returns expiration estimate", async () => {
    stubGenerateObject({ days: 7, label: "~1 week", confidence: "high" });

    const result = await estimateExpiration("Milk");
    expect(result.days).toBe(7);
    expect(result.label).toBe("~1 week");
    expect(result.confidence).toBe("high");
  });

  test("includes category in prompt", async () => {
    let capturedMessages: any[] = [];
    _deps.generateObject = mock(async (params: any) => {
      capturedMessages = params.messages;
      return { object: { days: 30, label: "~1 month", confidence: "medium" } };
    }) as any;

    await estimateExpiration("Cheese", "Dairy");
    expect(capturedMessages.some((m: any) => m.content?.includes("Dairy"))).toBe(true);
  });

  test("caches results", async () => {
    let callCount = 0;
    _deps.generateObject = mock(async () => {
      callCount++;
      return { object: { days: 14, label: "~2 weeks", confidence: "high" } };
    }) as any;

    await estimateExpiration("Bread");
    await estimateExpiration("Bread");
    expect(callCount).toBe(1);
  });

  test("uses separate cache keys per product+category", async () => {
    let callCount = 0;
    _deps.generateObject = mock(async () => {
      callCount++;
      return { object: { days: 10, label: "~10 days", confidence: "medium" } };
    }) as any;

    await estimateExpiration("Cheese");
    await estimateExpiration("Cheese", "Dairy");
    expect(callCount).toBe(2);
  });

  test("falls back to conservative estimate on error", async () => {
    _deps.generateObject = mock(async () => {
      throw new Error("API error");
    }) as any;

    const result = await estimateExpiration("Unknown");
    expect(result.days).toBe(7);
    expect(result.confidence).toBe("low");
  });
});

describe("clearExpirationCache", () => {
  test("forces a fresh API call after clearing", async () => {
    let callCount = 0;
    _deps.generateObject = mock(async () => {
      callCount++;
      return { object: { days: 7, label: "~1 week", confidence: "high" } };
    }) as any;

    await estimateExpiration("Product");
    await estimateExpiration("Product"); // cached
    expect(callCount).toBe(1);

    clearExpirationCache();
    await estimateExpiration("Product"); // cache cleared, re-fetches
    expect(callCount).toBe(2);
  });
});

describe("FOOD_CATEGORIES", () => {
  test("exports a non-empty tuple of category strings", () => {
    expect(Array.isArray(FOOD_CATEGORIES)).toBe(true);
    expect(FOOD_CATEGORIES.length).toBeGreaterThan(0);
    expect(FOOD_CATEGORIES).toContain("Dairy");
    expect(FOOD_CATEGORIES).toContain("Produce");
    expect(FOOD_CATEGORIES).toContain("Other");
  });
});
