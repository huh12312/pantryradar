/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await, @typescript-eslint/unbound-method */
import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import {
  decodeReceiptItems,
  estimateExpiration,
  clearExpirationCache,
} from "../../lib/openai";
import { openai } from "../../lib/openai";

describe("OpenAI Integration", () => {
  let originalCreate: typeof openai.chat.completions.create;

  beforeEach(() => {
    originalCreate = openai.chat.completions.create;
    clearExpirationCache();
  });

  afterEach(() => {
    openai.chat.completions.create = originalCreate;
  });

  describe("decodeReceiptItems", () => {
    test("should decode receipt items with structured output", async () => {
      openai.chat.completions.create = mock(async () => {
        return {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  items: [
                    {
                      raw: "GV MLK",
                      decoded: "Great Value Milk",
                      confidence: 0.95,
                    },
                    {
                      raw: "BNNNA",
                      decoded: "Banana",
                      confidence: 0.85,
                    },
                  ],
                }),
              },
            },
          ],
        } as any;
      });

      const result = await decodeReceiptItems([
        { description: "GV MLK", qty: 1, price: 3.99 },
        { description: "BNNNA", qty: 6, price: 1.29 },
      ]);

      expect(result).toHaveLength(2);
      expect(result[0]?.decoded).toBe("Great Value Milk");
      expect(result[0]?.confidence).toBe(0.95);
      expect(result[1]?.decoded).toBe("Banana");
      expect(result[1]?.confidence).toBe(0.85);
    });

    test("should include store name in prompt when provided", async () => {
      let capturedMessages: any[] = [];

      openai.chat.completions.create = mock(async (params: any) => {
        capturedMessages = params.messages;
        return {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  items: [
                    { raw: "TEST", decoded: "Test Item", confidence: 0.8 },
                  ],
                }),
              },
            },
          ],
        } as any;
      });

      await decodeReceiptItems(
        [{ description: "TEST", qty: 1 }],
        "Walmart"
      );

      const userMessage = capturedMessages.find((m) => m.role === "user");
      expect(userMessage?.content).toContain("Walmart");
    });

    test("should retry low-confidence items", async () => {
      let callCount = 0;

      openai.chat.completions.create = mock(async () => {
        callCount++;

        if (callCount === 1) {
          // First call returns low confidence
          return {
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    items: [
                      {
                        raw: "OBSCURE",
                        decoded: "Unknown Item",
                        confidence: 0.5,
                      },
                    ],
                  }),
                },
              },
            ],
          } as any;
        }

        // Retry call with better result
        return {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  items: [
                    {
                      raw: "OBSCURE",
                      decoded: "Better Guess",
                      confidence: 0.75,
                    },
                  ],
                }),
              },
            },
          ],
        } as any;
      });

      const result = await decodeReceiptItems([
        { description: "OBSCURE", qty: 1 },
      ]);

      expect(callCount).toBe(2); // Initial + retry
      expect(result[0]?.decoded).toBe("Better Guess");
      expect(result[0]?.confidence).toBe(0.75);
    });

    test("should not retry high-confidence items", async () => {
      let callCount = 0;

      openai.chat.completions.create = mock(async () => {
        callCount++;
        return {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  items: [
                    {
                      raw: "MLK",
                      decoded: "Milk",
                      confidence: 0.95,
                    },
                  ],
                }),
              },
            },
          ],
        } as any;
      });

      await decodeReceiptItems([{ description: "MLK", qty: 1 }]);

      expect(callCount).toBe(1); // No retry needed
    });

    test("should fallback to raw description on error", async () => {
      openai.chat.completions.create = mock(async () => {
        throw new Error("API error");
      });

      const result = await decodeReceiptItems([
        { description: "TEST", qty: 1 },
      ]);

      expect(result).toHaveLength(1);
      expect(result[0]?.decoded).toBe("TEST"); // Fallback to raw
      expect(result[0]?.confidence).toBe(0.3);
    });

    test("should use structured output format", async () => {
      let capturedFormat: any;

      openai.chat.completions.create = mock(async (params: any) => {
        capturedFormat = params.response_format;
        return {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  items: [
                    { raw: "TEST", decoded: "Test", confidence: 0.8 },
                  ],
                }),
              },
            },
          ],
        } as any;
      });

      await decodeReceiptItems([{ description: "TEST" }]);

      expect(capturedFormat).toBeDefined();
      expect(capturedFormat.type).toBe("json_schema");
    });
  });

  describe("estimateExpiration", () => {
    test("should estimate expiration for product", async () => {
      openai.chat.completions.create = mock(async () => {
        return {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  days: 7,
                  label: "~1 week",
                  confidence: "high",
                }),
              },
            },
          ],
        } as any;
      });

      const result = await estimateExpiration("Milk");

      expect(result.days).toBe(7);
      expect(result.label).toBe("~1 week");
      expect(result.confidence).toBe("high");
    });

    test("should include category in prompt when provided", async () => {
      let capturedMessages: any[] = [];

      openai.chat.completions.create = mock(async (params: any) => {
        capturedMessages = params.messages;
        return {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  days: 30,
                  label: "~1 month",
                  confidence: "medium",
                }),
              },
            },
          ],
        } as any;
      });

      await estimateExpiration("Cheese", "Dairy");

      const userMessage = capturedMessages.find((m) => m.role === "user");
      expect(userMessage?.content).toContain("Dairy");
    });

    test("should cache expiration estimates", async () => {
      let callCount = 0;

      openai.chat.completions.create = mock(async () => {
        callCount++;
        return {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  days: 14,
                  label: "~2 weeks",
                  confidence: "high",
                }),
              },
            },
          ],
        } as any;
      });

      // First call
      const result1 = await estimateExpiration("Bread");
      expect(callCount).toBe(1);
      expect(result1.days).toBe(14);

      // Second call with same product - should use cache
      const result2 = await estimateExpiration("Bread");
      expect(callCount).toBe(1); // No additional call
      expect(result2.days).toBe(14);
    });

    test("should cache based on product name and category", async () => {
      let callCount = 0;

      openai.chat.completions.create = mock(async () => {
        callCount++;
        return {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  days: 10,
                  label: "~10 days",
                  confidence: "medium",
                }),
              },
            },
          ],
        } as any;
      });

      await estimateExpiration("Cheese");
      await estimateExpiration("Cheese", "Dairy"); // Different cache key

      expect(callCount).toBe(2); // Both should call API
    });

    test("should fallback to conservative estimate on error", async () => {
      openai.chat.completions.create = mock(async () => {
        throw new Error("API error");
      });

      const result = await estimateExpiration("Unknown Product");

      expect(result.days).toBe(7);
      expect(result.label).toBe("~1 week");
      expect(result.confidence).toBe("low");
    });

    test("should use structured output format", async () => {
      let capturedFormat: any;

      openai.chat.completions.create = mock(async (params: any) => {
        capturedFormat = params.response_format;
        return {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  days: 5,
                  label: "~5 days",
                  confidence: "high",
                }),
              },
            },
          ],
        } as any;
      });

      await estimateExpiration("Test Product");

      expect(capturedFormat).toBeDefined();
      expect(capturedFormat.type).toBe("json_schema");
    });
  });

  describe("clearExpirationCache", () => {
    test("should clear the expiration cache", async () => {
      let callCount = 0;

      openai.chat.completions.create = mock(async () => {
        callCount++;
        return {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  days: 7,
                  label: "~1 week",
                  confidence: "high",
                }),
              },
            },
          ],
        } as any;
      });

      // First call - should cache
      await estimateExpiration("Product");
      expect(callCount).toBe(1);

      // Second call - should use cache
      await estimateExpiration("Product");
      expect(callCount).toBe(1);

      // Clear cache
      clearExpirationCache();

      // Third call - should call API again
      await estimateExpiration("Product");
      expect(callCount).toBe(2);
    });
  });
});
