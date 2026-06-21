import { api } from "@/lib/api";

export interface ScannedProduct {
  name: string;
  brand?: string;
  category?: string;
  imageUrl?: string;
  barcode: string;
}

export async function lookupBarcodeToProduct(
  barcode: string
): Promise<{ scannedProduct: ScannedProduct; notice: string | null }> {
  try {
    const product = await api.lookupBarcode(barcode);
    return {
      scannedProduct: {
        name: product.name,
        brand: product.brand,
        category: product.category,
        imageUrl: product.imageUrl,
        barcode,
      },
      notice: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    // The API throws the server's error text ("Product not found") rather than a
    // status code, so match the message; "404" covers the generic fallback shape.
    const isNotFound = /not found/i.test(message) || message.includes("404");
    return {
      scannedProduct: { name: "", barcode },
      notice: isNotFound
        ? "We couldn't find that product in our database. No worries — just fill in the details below!"
        : "Something went wrong looking up that barcode. You can still add the item manually.",
    };
  }
}
