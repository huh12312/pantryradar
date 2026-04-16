import type {
  Item,
  CreateItemInput,
  UpdateItemInput,
  Household,
  CreateHouseholdInput,
  BarcodeProduct,
  ReceiptProcessingResult,
  ApiResponse,
  PaginatedResponse,
} from "../schemas";

export interface ApiClientConfig {
  baseUrl: string;
  getAuthToken?: () => Promise<string | null>;
}

export class ApiClient {
  private baseUrl: string;
  private getAuthToken?: () => Promise<string | null>;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl;
    this.getAuthToken = config.getAuthToken;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    if (this.getAuthToken) {
      const token = await this.getAuthToken();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const json: unknown = await response.json();
      const data = json as ApiResponse<T>;

      if (!response.ok) {
        const errorMsg =
          typeof json === "object" && json !== null && "error" in json && typeof json.error === "string"
            ? json.error
            : `Request failed with status ${response.status}`;
        return {
          success: false,
          error: errorMsg,
        };
      }

      return data;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  // Health check
  async health(): Promise<ApiResponse<{ status: string }>> {
    return this.request<{ status: string }>("/health");
  }

  // Items
  async getItems(location?: string): Promise<ApiResponse<PaginatedResponse<Item>>> {
    const query = location ? `?location=${location}` : "";
    return this.request<PaginatedResponse<Item>>(`/items${query}`);
  }

  async getItem(id: string): Promise<ApiResponse<Item>> {
    return this.request<Item>(`/items/${id}`);
  }

  async createItem(data: CreateItemInput): Promise<ApiResponse<Item>> {
    return this.request<Item>("/items", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateItem(id: string, data: UpdateItemInput): Promise<ApiResponse<Item>> {
    return this.request<Item>(`/items/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteItem(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/items/${id}`, {
      method: "DELETE",
    });
  }

  // Households
  async getHousehold(): Promise<ApiResponse<Household>> {
    return this.request<Household>("/households/me");
  }

  async createHousehold(data: CreateHouseholdInput): Promise<ApiResponse<Household>> {
    return this.request<Household>("/households", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async joinHousehold(inviteCode: string): Promise<ApiResponse<Household>> {
    return this.request<Household>("/households/join", {
      method: "POST",
      body: JSON.stringify({ inviteCode }),
    });
  }

  // Barcode lookup
  async lookupBarcode(upc: string): Promise<ApiResponse<BarcodeProduct>> {
    return this.request<BarcodeProduct>(`/barcode/${upc}`);
  }

  // Receipt processing
  async processReceipt(imageData: string): Promise<ApiResponse<ReceiptProcessingResult>> {
    return this.request<ReceiptProcessingResult>("/receipt", {
      method: "POST",
      body: JSON.stringify({ imageData }),
    });
  }
}

export function createApiClient(config: ApiClientConfig): ApiClient {
  return new ApiClient(config);
}
