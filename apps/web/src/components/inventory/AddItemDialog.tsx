import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { ChevronDown, Package } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api, type InventoryItem, type CreateItemDto } from "@/lib/api";
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editItem ? "Edit Item" : "Add New Item"}</DialogTitle>
        </DialogHeader>
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

            <div className="grid grid-cols-2 gap-4">
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

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{editItem ? "Update" : "Add"} Item</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
