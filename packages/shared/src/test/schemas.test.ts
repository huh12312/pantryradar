import { describe, it, expect } from "vitest";
import {
  itemLocationSchema,
  createItemSchema,
  updateItemSchema,
  householdSchema,
  createHouseholdSchema,
  userSchema,
  productCacheSchema,
  receiptLineItemSchema,
  receiptProcessingResultSchema,
  barcodeProductSchema,
  expirationEstimateSchema,
  syncQueueEntrySchema,
} from "../schemas";

describe("Shared Schemas Validation", () => {
  describe("itemLocationSchema", () => {
    it("should accept valid locations", () => {
      expect(itemLocationSchema.parse("pantry")).toBe("pantry");
      expect(itemLocationSchema.parse("fridge")).toBe("fridge");
      expect(itemLocationSchema.parse("freezer")).toBe("freezer");
    });

    it("should reject invalid locations", () => {
      expect(() => itemLocationSchema.parse("basement")).toThrow();
      expect(() => itemLocationSchema.parse("garage")).toThrow();
      expect(() => itemLocationSchema.parse("")).toThrow();
    });
  });

  describe("createItemSchema", () => {
    it("should accept valid item data", () => {
      const validItem = {
        name: "Milk",
        brand: "Great Value",
        category: "Dairy",
        location: "fridge" as const,
        quantity: 1,
        unit: "gallon",
        barcodeUpc: "041220000000",
        expirationDate: new Date("2024-12-31"),
        expirationEstimated: false,
        notes: "Whole milk",
      };

      const result = createItemSchema.parse(validItem);
      expect(result.name).toBe("Milk");
      expect(result.location).toBe("fridge");
    });

    it("should require name field", () => {
      const invalidItem = {
        location: "pantry",
      };

      expect(() => createItemSchema.parse(invalidItem)).toThrow();
    });

    it("should reject empty name", () => {
      const invalidItem = {
        name: "",
        location: "pantry",
      };

      expect(() => createItemSchema.parse(invalidItem)).toThrow(/name.*required/i);
    });

    it("should require location field", () => {
      const invalidItem = {
        name: "Test Item",
      };

      expect(() => createItemSchema.parse(invalidItem)).toThrow();
    });

    it("should reject invalid location", () => {
      const invalidItem = {
        name: "Test Item",
        location: "invalid",
      };

      expect(() => createItemSchema.parse(invalidItem)).toThrow();
    });

    it("should reject negative quantity", () => {
      const invalidItem = {
        name: "Test Item",
        location: "pantry",
        quantity: -1,
      };

      expect(() => createItemSchema.parse(invalidItem)).toThrow();
    });

    it("should default quantity to 1", () => {
      const item = {
        name: "Test Item",
        location: "pantry" as const,
      };

      const result = createItemSchema.parse(item);
      expect(result.quantity).toBe(1);
    });

    it("should accept optional fields as undefined", () => {
      const minimalItem = {
        name: "Test Item",
        location: "pantry" as const,
      };

      const result = createItemSchema.parse(minimalItem);
      expect(result.brand).toBeUndefined();
      expect(result.category).toBeUndefined();
      expect(result.unit).toBeUndefined();
    });

    it("should coerce date strings to Date objects", () => {
      const item = {
        name: "Test Item",
        location: "pantry" as const,
        expirationDate: "2024-12-31",
      };

      const result = createItemSchema.parse(item);
      expect(result.expirationDate).toBeInstanceOf(Date);
    });
  });

  describe("updateItemSchema", () => {
    it("should accept partial updates", () => {
      const update = {
        name: "Updated Name",
      };

      const result = updateItemSchema.parse(update);
      expect(result.name).toBe("Updated Name");
    });

    it("should accept empty object (no updates)", () => {
      const result = updateItemSchema.parse({});
      expect(result).toEqual({});
    });

    it("should validate fields when provided", () => {
      const invalidUpdate = {
        quantity: -5,
      };

      expect(() => updateItemSchema.parse(invalidUpdate)).toThrow();
    });
  });

  describe("householdSchema", () => {
    it("should accept valid household data", () => {
      const validHousehold = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        name: "Smith Family",
        inviteCode: "ABC12345",
        createdAt: new Date(),
      };

      const result = householdSchema.parse(validHousehold);
      expect(result.name).toBe("Smith Family");
      expect(result.inviteCode).toBe("ABC12345");
    });

    it("should reject invalid UUID", () => {
      const invalidHousehold = {
        id: "not-a-uuid",
        name: "Test",
        inviteCode: "CODE",
        createdAt: new Date(),
      };

      expect(() => householdSchema.parse(invalidHousehold)).toThrow();
    });

    it("should require name", () => {
      const invalidHousehold = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        name: "",
        inviteCode: "CODE",
        createdAt: new Date(),
      };

      expect(() => householdSchema.parse(invalidHousehold)).toThrow();
    });
  });

  describe("createHouseholdSchema", () => {
    it("should accept valid household name", () => {
      const result = createHouseholdSchema.parse({
        name: "My Household",
      });

      expect(result.name).toBe("My Household");
    });

    it("should reject empty name", () => {
      expect(() => createHouseholdSchema.parse({ name: "" })).toThrow();
    });
  });

  describe("userSchema", () => {
    it("should accept valid user data", () => {
      const validUser = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        householdId: "123e4567-e89b-12d3-a456-426614174001",
        displayName: "John Doe",
        email: "john@example.com",
        createdAt: new Date(),
      };

      const result = userSchema.parse(validUser);
      expect(result.displayName).toBe("John Doe");
      expect(result.email).toBe("john@example.com");
    });

    it("should reject invalid email", () => {
      const invalidUser = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        householdId: "123e4567-e89b-12d3-a456-426614174001",
        displayName: "John Doe",
        email: "not-an-email",
        createdAt: new Date(),
      };

      expect(() => userSchema.parse(invalidUser)).toThrow();
    });

    it("should reject empty display name", () => {
      const invalidUser = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        householdId: "123e4567-e89b-12d3-a456-426614174001",
        displayName: "",
        email: "john@example.com",
        createdAt: new Date(),
      };

      expect(() => userSchema.parse(invalidUser)).toThrow();
    });
  });

  describe("productCacheSchema", () => {
    it("should accept valid product cache data", () => {
      const validProduct = {
        upc: "041220000000",
        name: "Milk",
        brand: "Great Value",
        category: "Dairy",
        imageUrl: "https://example.com/milk.jpg",
        source: "open_food_facts" as const,
        fetchedAt: new Date(),
      };

      const result = productCacheSchema.parse(validProduct);
      expect(result.upc).toBe("041220000000");
      expect(result.source).toBe("open_food_facts");
    });

    it("should accept manual source", () => {
      const manualProduct = {
        upc: "123456789012",
        name: "Custom Item",
        source: "manual" as const,
        fetchedAt: new Date(),
      };

      const result = productCacheSchema.parse(manualProduct);
      expect(result.source).toBe("manual");
    });

    it("should reject invalid source", () => {
      const invalidProduct = {
        upc: "123456789012",
        name: "Item",
        source: "invalid_source",
        fetchedAt: new Date(),
      };

      expect(() => productCacheSchema.parse(invalidProduct)).toThrow();
    });

    it("should reject invalid image URL", () => {
      const invalidProduct = {
        upc: "123456789012",
        name: "Item",
        imageUrl: "not-a-url",
        source: "open_food_facts" as const,
        fetchedAt: new Date(),
      };

      expect(() => productCacheSchema.parse(invalidProduct)).toThrow();
    });
  });

  describe("receiptLineItemSchema", () => {
    it("should accept valid receipt line item", () => {
      const validLineItem = {
        raw: "GV MLK HLF GL",
        decoded: "Great Value Milk Half Gallon",
        confidence: 0.92,
        quantity: 1,
        price: 3.99,
      };

      const result = receiptLineItemSchema.parse(validLineItem);
      expect(result.decoded).toBe("Great Value Milk Half Gallon");
      expect(result.confidence).toBe(0.92);
    });

    it("should reject confidence < 0", () => {
      const invalidLineItem = {
        raw: "ITEM",
        decoded: "Item",
        confidence: -0.1,
      };

      expect(() => receiptLineItemSchema.parse(invalidLineItem)).toThrow();
    });

    it("should reject confidence > 1", () => {
      const invalidLineItem = {
        raw: "ITEM",
        decoded: "Item",
        confidence: 1.5,
      };

      expect(() => receiptLineItemSchema.parse(invalidLineItem)).toThrow();
    });

    it("should accept optional quantity and price", () => {
      const minimalLineItem = {
        raw: "ITEM",
        decoded: "Item",
        confidence: 0.8,
      };

      const result = receiptLineItemSchema.parse(minimalLineItem);
      expect(result.quantity).toBeUndefined();
      expect(result.price).toBeUndefined();
    });
  });

  describe("receiptProcessingResultSchema", () => {
    it("should accept valid receipt result", () => {
      const validResult = {
        storeName: "Walmart",
        lineItems: [
          {
            raw: "GV MLK",
            decoded: "Great Value Milk",
            confidence: 0.95,
          },
        ],
        total: 45.67,
      };

      const result = receiptProcessingResultSchema.parse(validResult);
      expect(result.storeName).toBe("Walmart");
      expect(result.lineItems).toHaveLength(1);
      expect(result.total).toBe(45.67);
    });

    it("should accept result without store name or total", () => {
      const minimalResult = {
        lineItems: [],
      };

      const result = receiptProcessingResultSchema.parse(minimalResult);
      expect(result.lineItems).toEqual([]);
      expect(result.storeName).toBeUndefined();
      expect(result.total).toBeUndefined();
    });
  });

  describe("barcodeProductSchema", () => {
    it("should accept valid barcode product", () => {
      const validProduct = {
        upc: "041220000000",
        name: "Milk",
        brand: "Great Value",
        category: "Dairy",
        imageUrl: "https://example.com/milk.jpg",
        estimatedExpirationDays: 7,
        estimatedExpirationLabel: "~1 week",
      };

      const result = barcodeProductSchema.parse(validProduct);
      expect(result.upc).toBe("041220000000");
      expect(result.estimatedExpirationDays).toBe(7);
    });

    it("should accept minimal product data", () => {
      const minimalProduct = {
        upc: "123456789012",
        name: "Product",
      };

      const result = barcodeProductSchema.parse(minimalProduct);
      expect(result.brand).toBeUndefined();
      expect(result.estimatedExpirationDays).toBeUndefined();
    });
  });

  describe("expirationEstimateSchema", () => {
    it("should accept valid expiration estimate", () => {
      const validEstimate = {
        days: 7,
        label: "~1 week",
        confidence: "high" as const,
      };

      const result = expirationEstimateSchema.parse(validEstimate);
      expect(result.days).toBe(7);
      expect(result.confidence).toBe("high");
    });

    it("should accept all confidence levels", () => {
      const highConfidence = expirationEstimateSchema.parse({
        days: 7,
        label: "~1 week",
        confidence: "high",
      });
      expect(highConfidence.confidence).toBe("high");

      const mediumConfidence = expirationEstimateSchema.parse({
        days: 14,
        label: "~2 weeks",
        confidence: "medium",
      });
      expect(mediumConfidence.confidence).toBe("medium");

      const lowConfidence = expirationEstimateSchema.parse({
        days: 30,
        label: "~1 month",
        confidence: "low",
      });
      expect(lowConfidence.confidence).toBe("low");
    });

    it("should reject zero or negative days", () => {
      const invalidEstimate = {
        days: 0,
        label: "now",
        confidence: "high" as const,
      };

      expect(() => expirationEstimateSchema.parse(invalidEstimate)).toThrow();
    });

    it("should reject invalid confidence level", () => {
      const invalidEstimate = {
        days: 7,
        label: "~1 week",
        confidence: "very_high",
      };

      expect(() => expirationEstimateSchema.parse(invalidEstimate)).toThrow();
    });
  });

  describe("syncQueueEntrySchema", () => {
    it("should accept valid sync queue entry", () => {
      const validEntry = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        action: "create" as const,
        tableName: "items",
        recordId: "123e4567-e89b-12d3-a456-426614174001",
        data: { name: "Test", location: "pantry" },
        createdAt: new Date(),
        synced: false,
      };

      const result = syncQueueEntrySchema.parse(validEntry);
      expect(result.action).toBe("create");
      expect(result.synced).toBe(false);
    });

    it("should accept all action types", () => {
      const actions = ["create", "update", "delete"] as const;

      actions.forEach((action) => {
        const entry = {
          id: "123e4567-e89b-12d3-a456-426614174000",
          action,
          tableName: "items",
          recordId: "123e4567-e89b-12d3-a456-426614174001",
          data: {},
          createdAt: new Date(),
          synced: false,
        };

        const result = syncQueueEntrySchema.parse(entry);
        expect(result.action).toBe(action);
      });
    });

    it("should reject invalid action", () => {
      const invalidEntry = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        action: "invalid",
        tableName: "items",
        recordId: "123e4567-e89b-12d3-a456-426614174001",
        data: {},
        createdAt: new Date(),
        synced: false,
      };

      expect(() => syncQueueEntrySchema.parse(invalidEntry)).toThrow();
    });
  });
});
