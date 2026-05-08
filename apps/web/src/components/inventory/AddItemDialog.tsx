import { useState, useEffect, useRef } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, Package, Search, X } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api, type InventoryItem, type CreateItemDto, type ProductSearchResult } from "@/lib/api";
import type { ItemLocation } from "@pantrymaid/shared/schemas";
import { FOOD_CATEGORIES, COMMON_UNITS } from "@pantrymaid/shared/constants";
import type { ItemPreset } from "@pantrymaid/shared/constants";
import { QuickAddPresets } from "./QuickAddPresets";
import { queryKeys } from "@/lib/queryKeys";

interface ScannedProduct {
  name: string;
  brand?: string;
  category?: string;
  imageUrl?: string;
  barcode: string;
}

interface AddItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateItemDto) => void;
  editItem?: InventoryItem | null;
  defaultLocation?: ItemLocation;
  scannedProduct?: ScannedProduct | null;
  barcodeNotice?: string | null;
}

const emptyForm = (defaultLocation?: ItemLocation): CreateItemDto => ({
  name: "",
  quantity: 1,
  unit: "unit",
  location: defaultLocation ?? "pantry",
  opened: false,
});

export function AddItemDialog({
  open,
  onOpenChange,
  onSubmit,
  editItem,
  defaultLocation,
  scannedProduct,
  barcodeNotice,
}: AddItemDialogProps) {
  const [formData, setFormData] = useState<CreateItemDto>(emptyForm(defaultLocation));
  const [duplicateWarning, setDuplicateWarning] = useState<InventoryItem | null>(null);
  const nameBlurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Product search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProductSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: items = [] } = useQuery({
    queryKey: queryKeys.inventory.lists(),
    queryFn: () => api.getItems(),
    enabled: open,
  });

  const suggestMutation = useMutation({
    mutationFn: (name: string) => api.suggestItemDefaults(name),
    onSuccess: (suggestion) => {
      setFormData((prev) => ({
        ...prev,
        unit: suggestion.unit,
        category: suggestion.category,
        expirationDate: suggestion.estimatedShelfDays
          ? new Date(Date.now() + suggestion.estimatedShelfDays * 86400000)
              .toISOString()
              .split("T")[0]
          : prev.expirationDate,
      }));
    },
  });

  // Debounced product search
  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (q.trim().length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    searchDebounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await api.searchProducts(q.trim());
        setSearchResults(results);
        setShowResults(results.length > 0);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  };

  const handleSelectResult = (result: ProductSearchResult) => {
    setFormData((prev) => ({
      ...prev,
      name: result.name ?? prev.name,
      brand: result.brand ?? prev.brand,
      category: result.category ?? prev.category,
      imageUrl: result.imageUrl ?? prev.imageUrl,
      barcodeUpc: result.upc ?? prev.barcodeUpc,
    }));
    setSearchQuery("");
    setShowResults(false);
    setSearchResults([]);
  };

  const SOURCE_LABEL: Record<string, string> = {
    kroger: "Kroger",
    open_food_facts: "Open Food Facts",
    trader_joes: "Trader Joe's",
    manual: "Manual",
  };

  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setSearchResults([]);
      setShowResults(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (editItem) {
      setFormData({
        name: editItem.name,
        brand: editItem.brand ?? undefined,
        quantity: editItem.quantity,
        unit: editItem.unit ?? "unit",
        location: editItem.location,
        category: editItem.category ?? undefined,
        expirationDate: editItem.expirationDate ?? undefined,
        barcodeUpc: editItem.barcodeUpc ?? undefined,
        imageUrl: editItem.imageUrl ?? undefined,
        notes: editItem.notes ?? undefined,
        opened: editItem.opened ?? false,
      });
    } else if (scannedProduct) {
      setFormData({
        name: scannedProduct.name,
        brand: scannedProduct.brand,
        quantity: 1,
        unit: "unit",
        location: defaultLocation ?? "pantry",
        category: scannedProduct.category,
        imageUrl: scannedProduct.imageUrl,
        barcodeUpc: scannedProduct.barcode,
        opened: false,
      });
    } else {
      setFormData(emptyForm(defaultLocation));
    }
    setDuplicateWarning(null);
  }, [editItem, scannedProduct, open, defaultLocation]);

  const handleNameBlur = () => {
    if (editItem || !formData.name.trim()) return;
    if (nameBlurTimeout.current) clearTimeout(nameBlurTimeout.current);
    nameBlurTimeout.current = setTimeout(() => {
      const match = items.find(
        (i) => i.name.toLowerCase() === formData.name.trim().toLowerCase()
      );
      setDuplicateWarning(match ?? null);
    }, 200);
  };

  const handleMerge = () => {
    if (!duplicateWarning) return;
    void api.updateItem(duplicateWarning.id, {
      quantity: duplicateWarning.quantity + (formData.quantity || 1),
    }).then(() => {
      setDuplicateWarning(null);
      onOpenChange(false);
    });
  };

  const handlePresetSelect = (preset: ItemPreset) => {
    const expirationDate = new Date(Date.now() + preset.estimatedShelfDays * 86400000)
      .toISOString()
      .split("T")[0];
    setFormData((prev) => ({
      ...prev,
      name: preset.name,
      category: preset.category,
      unit: preset.unit,
      expirationDate,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" showHandle>
        <SheetHeader>
          <SheetTitle>{editItem ? "Edit Item" : "Add New Item"}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit}>
          {barcodeNotice && (
            <div className="mb-4 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
              {barcodeNotice}
            </div>
          )}

          {!editItem && (
            <Collapsible className="mb-4">
              <CollapsibleTrigger className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ChevronDown className="h-3 w-3" />
                Common items
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <QuickAddPresets
                  onSelect={handlePresetSelect}
                  onAISuggest={(name) => suggestMutation.mutate(name)}
                  isSuggestLoading={suggestMutation.isPending}
                />
              </CollapsibleContent>
            </Collapsible>
          )}

          {!editItem && (
            <div className="mb-4 relative">
              <Label htmlFor="product-search">Search products</Label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="product-search"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Search Kroger, Open Food Facts…"
                  className="pl-9 pr-9"
                  autoComplete="off"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => { setSearchQuery(""); setShowResults(false); setSearchResults([]); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {isSearching && (
                <p className="mt-1 text-xs text-muted-foreground">Searching…</p>
              )}
              {showResults && searchResults.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md max-h-60 overflow-y-auto">
                  {searchResults.map((r, i) => (
                    <li key={`${r.source}-${r.upc ?? r.name}-${i}`}>
                      <button
                        type="button"
                        onClick={() => handleSelectResult(r)}
                        className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
                      >
                        {r.imageUrl ? (
                          <img
                            src={r.imageUrl}
                            alt=""
                            className="h-10 w-10 rounded object-cover flex-shrink-0 bg-secondary"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                        ) : (
                          <div className="h-10 w-10 rounded bg-secondary flex items-center justify-center flex-shrink-0">
                            <Package className="h-5 w-5 text-muted-foreground/40" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{r.name}</p>
                          {r.brand && <p className="text-xs text-muted-foreground truncate">{r.brand}</p>}
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                          {SOURCE_LABEL[r.source] ?? r.source}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  setDuplicateWarning(null);
                }}
                onBlur={handleNameBlur}
                required
              />
              {duplicateWarning && (
                <div className="mt-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                  You already have <strong>{duplicateWarning.name}</strong> in your{" "}
                  <strong>{duplicateWarning.location}</strong> (qty: {duplicateWarning.quantity}).
                  <div className="flex gap-2 mt-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-6 text-xs"
                      onClick={() => setDuplicateWarning(null)}
                    >
                      Add Anyway
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={handleMerge}
                    >
                      Merge Qty
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="brand">Brand</Label>
              <Input
                id="brand"
                value={formData.brand || ""}
                onChange={(e) =>
                  setFormData({ ...formData, brand: e.target.value || undefined })
                }
                placeholder="e.g. Pringles"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="quantity">Quantity *</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="0"
                  step="0.1"
                  value={formData.quantity}
                  onChange={(e) =>
                    setFormData({ ...formData, quantity: parseFloat(e.target.value) })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="unit">Unit</Label>
                <Select
                  value={formData.unit ?? "unit"}
                  onValueChange={(value) => setFormData({ ...formData, unit: value })}
                >
                  <SelectTrigger id="unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_UNITS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="location">Location *</Label>
              <Select
                value={formData.location}
                onValueChange={(value: ItemLocation) =>
                  setFormData({ ...formData, location: value })
                }
              >
                <SelectTrigger id="location">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pantry">Pantry</SelectItem>
                  <SelectItem value="fridge">Fridge</SelectItem>
                  <SelectItem value="freezer">Freezer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.category || ""}
                onValueChange={(value) =>
                  setFormData({ ...formData, category: value || undefined })
                }
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {FOOD_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="expirationDate">Expiry Date</Label>
              <Input
                id="expirationDate"
                type="date"
                value={formData.expirationDate || ""}
                onChange={(e) =>
                  setFormData({ ...formData, expirationDate: e.target.value })
                }
              />
            </div>

            {editItem && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="opened"
                  checked={formData.opened ?? false}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, opened: checked === true })
                  }
                />
                <Label htmlFor="opened" className="font-normal cursor-pointer">
                  Mark as opened
                </Label>
              </div>
            )}

            <div>
              <Label htmlFor="imageUrl">Image URL</Label>
              {formData.imageUrl && (
                <div className="mt-1.5 mb-2 w-full h-40 rounded-lg overflow-hidden bg-secondary flex items-center justify-center">
                  <img
                    src={formData.imageUrl}
                    alt={formData.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      const sibling = e.currentTarget.nextElementSibling as HTMLElement | null;
                      if (sibling) sibling.style.removeProperty("display");
                    }}
                  />
                  <Package className="h-8 w-8 text-muted-foreground/30" style={{ display: "none" }} />
                </div>
              )}
              <Input
                id="imageUrl"
                type="url"
                value={formData.imageUrl || ""}
                onChange={(e) =>
                  setFormData({ ...formData, imageUrl: e.target.value || undefined })
                }
                placeholder="https://example.com/image.jpg"
              />
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                value={formData.notes || ""}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
              />
            </div>
          </div>

          <SheetFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              className="h-11 sm:h-10"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" className="h-11 sm:h-10">
              {editItem ? "Update" : "Add"} Item
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
