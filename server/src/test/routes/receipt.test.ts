

/* eslint-disable @typescript-eslint/no-explicit-any */


import { describe, it, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { setupTestDb, teardownTestDb, clearTables } from "../setup";
import { factories } from "../factories";
import { Hono } from "hono";
import receiptRoute from "../../routes/receipt";

describe("Receipt API Routes", () => {
  let app: Hono;
  let authToken: string;

  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearTables();

    const testUserId = factories.user("temp-id").id;
    authToken = `Bearer mock-token-${testUserId}`;

    app = new Hono();
    app.route("/receipt", receiptRoute);
  });

  describe("POST /receipt", () => {
    it("should accept imageBase64 JSON and return decoded items array", async () => {
      const response = await app.request("/receipt", {
        method: "POST",
        headers: {
          Authorization: authToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageBase64: "bW9jay1yZWNlaXB0LWltYWdl" }),
      });

      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data).toBeDefined();
      expect(json.data.lineItems).toBeInstanceOf(Array);
      expect(json.data.storeName).toBeDefined();

      if (json.data.lineItems.length > 0) {
        const firstItem = json.data.lineItems[0];
        expect(firstItem.raw).toBeDefined();
        expect(firstItem.decoded).toBeDefined();
        expect(firstItem.confidence).toBeGreaterThanOrEqual(0);
        expect(firstItem.confidence).toBeLessThanOrEqual(1);
      }
    });

    it("should return fully decoded product names", async () => {
      const response = await app.request("/receipt", {
        method: "POST",
        headers: {
          Authorization: authToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageBase64: "bW9jay1yZWNlaXB0" }),
      });

      const json = await response.json();

      json.data.lineItems.forEach((item: any) => {
        expect(item.raw).toBeDefined();
        expect(item.decoded).toBeDefined();
        expect(item.decoded.length).toBeGreaterThanOrEqual(item.raw.length);
      });
    });

    it("should include confidence scores for decoded items", async () => {
      const response = await app.request("/receipt", {
        method: "POST",
        headers: {
          Authorization: authToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageBase64: "bW9jay1yZWNlaXB0" }),
      });

      const json = await response.json();

      json.data.lineItems.forEach((item: any) => {
        expect(item.confidence).toBeDefined();
        expect(typeof item.confidence).toBe("number");
        expect(item.confidence).toBeGreaterThanOrEqual(0);
        expect(item.confidence).toBeLessThanOrEqual(1);
      });
    });

    it("should include quantity and price from receipt parsing", async () => {
      const response = await app.request("/receipt", {
        method: "POST",
        headers: {
          Authorization: authToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageBase64: "cmVjZWlwdC13aXRoLXByaWNlcw==" }),
      });

      const json = await response.json();

      const itemsWithPrice = json.data.lineItems.filter(
        (item: any) => item.price !== undefined
      );
      expect(itemsWithPrice.length).toBeGreaterThan(0);
    });

    it("should extract store name from receipt", async () => {
      const response = await app.request("/receipt", {
        method: "POST",
        headers: {
          Authorization: authToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageBase64: "d2FsbWFydC1yZWNlaXB0" }),
      });

      const json = await response.json();
      expect(json.data.storeName).toBeDefined();
      expect(typeof json.data.storeName).toBe("string");
    });

    it("should fail without authentication", async () => {
      const response = await app.request("/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: "dGVzdA==" }),
      });

      expect(response.status).toBe(401);
    });

    it("should fail without imageBase64 field", async () => {
      const response = await app.request("/receipt", {
        method: "POST",
        headers: {
          Authorization: authToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
    });

    it("should handle LLM API errors gracefully", async () => {
      const response = await app.request("/receipt", {
        method: "POST",
        headers: {
          Authorization: authToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageBase64: "Y29ycnVwdC1pbWFnZQ==" }),
      });

      expect([200, 400, 500, 502, 503]).toContain(response.status);

      if (response.status !== 200) {
        const json = await response.json();
        expect(json.error).toBeDefined();
      }
    });

    it("should not store receipt images (privacy)", async () => {
      const response = await app.request("/receipt", {
        method: "POST",
        headers: {
          Authorization: authToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageBase64: "c2Vuc2l0aXZlLXJlY2VpcHQ=" }),
      });

      const json = await response.json();

      expect(json.data.imageUrl).toBeUndefined();
      expect(json.data.storedPath).toBeUndefined();
    });

    it("should include total amount if available", async () => {
      const response = await app.request("/receipt", {
        method: "POST",
        headers: {
          Authorization: authToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageBase64: "cmVjZWlwdC13aXRoLXRvdGFs" }),
      });

      const json = await response.json();

      if (json.data.total !== undefined) {
        expect(typeof json.data.total).toBe("number");
        expect(json.data.total).toBeGreaterThan(0);
      }
    });
  });
});
