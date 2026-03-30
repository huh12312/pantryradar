/**
 * Veryfi API client for receipt OCR processing
 * With retry logic, rate limiting, and proper error handling
 */

import { withRetry, RateLimiter } from "./retry";

export interface VeryfiConfig {
  clientId: string;
  clientSecret: string;
  username: string;
  apiKey: string;
}

export interface VeryfiLineItem {
  description: string;
  quantity?: number;
  price?: number;
  total?: number;
  upc?: string;
}

export interface VeryfiResponse {
  vendor?: {
    name?: string;
  };
  line_items?: VeryfiLineItem[];
  total?: number;
}

export class VeryfiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly responseBody?: string
  ) {
    super(message);
    this.name = "VeryfiError";
  }
}

export class VeryfiClient {
  private config: VeryfiConfig;
  private baseUrl = "https://api.veryfi.com/api/v8";
  // Veryfi free tier: 5 requests per minute
  private rateLimiter = new RateLimiter(5, 60 * 1000);

  constructor(config: VeryfiConfig) {
    this.config = config;
  }

  /**
   * Process a receipt image
   * Supports both base64 and multipart upload
   */
  async processReceipt(imageBase64: string): Promise<VeryfiResponse> {
    // Wait for rate limit slot
    await this.rateLimiter.waitForSlot();

    return withRetry(
      async () => {
        const url = `${this.baseUrl}/partner/documents`;

        const headers = {
          "Content-Type": "application/json",
          "CLIENT-ID": this.config.clientId,
          AUTHORIZATION: `apikey ${this.config.username}:${this.config.apiKey}`,
        };

        const body = {
          file_data: imageBase64,
          categories: ["Grocery", "Food & Drink"],
          boost_mode: 0,
        };

        const response = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorBody = await response.text();

          // For 429, throw with response object for retry detection
          if (response.status === 429) {
            const error = new VeryfiError(
              "Veryfi rate limit exceeded",
              response.status,
              errorBody
            );
            // Attach response for retry-after detection
            (error as { response?: { status: number; headers: Headers } }).response = {
              status: response.status,
              headers: response.headers,
            };
            throw error;
          }

          throw new VeryfiError(
            `Veryfi API error: ${response.status}`,
            response.status,
            errorBody
          );
        }

        const data = (await response.json()) as VeryfiResponse;

        // Normalize line items to include qty and price
        if (data.line_items) {
          data.line_items = data.line_items.map((item) => ({
            description: item.description,
            quantity: item.quantity ?? 1,
            price: item.price ?? item.total ?? 0,
            total: item.total,
            upc: item.upc,
          }));
        }

        return data;
      },
      {
        maxRetries: 3,
        initialDelayMs: 1000,
        maxDelayMs: 10000,
      }
    );
  }
}

// Validate environment variables
const clientId = process.env.VERYFI_CLIENT_ID;
const clientSecret = process.env.VERYFI_CLIENT_SECRET;
const username = process.env.VERYFI_USERNAME;
const apiKey = process.env.VERYFI_API_KEY;

if (!clientId || !clientSecret || !username || !apiKey) {
  console.warn(
    "Veryfi environment variables not fully configured. Receipt processing will fail."
  );
}

// Export singleton instance
export const veryfiClient = new VeryfiClient({
  clientId: clientId || "",
  clientSecret: clientSecret || "",
  username: username || "",
  apiKey: apiKey || "",
});
