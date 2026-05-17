import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import {
  Camera,
  FileText,
  Package,
  Thermometer,
  Snowflake,
  AlertTriangle,
  Search,
  ShoppingCart,
  X,
} from "lucide-react";
import { StatCard } from "@/components/inventory/StatCard";
import { LocationSection } from "@/components/inventory/LocationSection";
import { AddItemDialog } from "@/components/inventory/AddItemDialog";
import { BarcodeScanner } from "@/components/inventory/BarcodeScanner";
import { ReceiptUpload } from "@/components/inventory/ReceiptUpload";
import { ReceiptReviewSheet } from "@/components/inventory/ReceiptReviewSheet";
import { ShoppingListPanel } from "@/components/inventory/ShoppingListPanel";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileTopBar } from "@/components/layout/MobileTopBar";
import { SegmentedTabs } from "@/components/layout/SegmentedTabs";
import { MobileFAB } from "@/components/layout/MobileFAB";
import {
  api,
  type InventoryItem,
  type CreateItemDto,
  type ShoppingListItem,
  type ReceiptProcessingResult,
} from "@/lib/api";
import type { ItemLocation } from "@pantrymaid/shared/schemas";
import { queryKeys } from "@/lib/queryKeys";
import { useAuth } from "@/lib/auth";
import { useHouseStore } from "@/lib/houseStore";
import { HouseSelector } from "@/components/layout/HouseSelector";
import { useNavigate } from "react-router-dom";
import { useInventoryMutations } from "@/hooks/useInventoryMutations";
import { filterBySearch } from "@/lib/inventoryFilters";

function parseExpiry(d: string) {
  return new Date(d.includes("T") ? d : d + "T00:00:00");
}

export default function InventoryPage() {
  const navigate = useNavigate();
  const { clearAuth, user } = useAuth();
  const { selectedHouseId } = useHouseStore();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [receiptUploadOpen, setReceiptUploadOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptProcessingResult | null>(null);
  const [receiptReviewOpen, setReceiptReviewOpen] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [defaultLocation, setDefaultLocation] = useState<ItemLocation | undefined>();
  const [scannedProduct, setScannedProduct] = useState<{
    name: string;
    brand?: string;
    category?: string;
    imageUrl?: string;
    barcode: string;
  } | null>(null);
  const [barcodeNotice, setBarcodeNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<"all" | "pantry" | "fridge" | "freezer">(
    "all"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [reorderOpen, setReorderOpen] = useState(false);
  const [consumePromptItem, setConsumePromptItem] = useState<InventoryItem | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: queryKeys.inventory.list(selectedHouseId),
    queryFn: () => api.getItems(selectedHouseId ?? undefined),
  });

  const { data: household } = useQuery({
    queryKey: queryKeys.household.details(),
    queryFn: () => api.getHousehold(),
    retry: false,
  });

  const { data: shoppingListItems = [] } = useQuery({
    queryKey: queryKeys.shoppingList.lists(),
    queryFn: () => api.getShoppingList(),
  });

  const {
    createMutation,
    updateMutation,
    deleteMutation,
    uploadReceiptMutation,
    bulkAddReceiptItemsMutation,
    addToShoppingListMutation,
    deleteShoppingListMutation,
    markPurchasedMutation,
    consume,
    consumingIds,
  } = useInventoryMutations({
    onItemSaved: () => {
      setAddDialogOpen(false);
      setEditItem(null);
    },
    onItemSaveError: (msg) => {
      setBarcodeNotice(msg);
    },
    onDeleteError: (msg) => {
      setErrorNotice(msg);
    },
    onReceiptUploaded: (data) => {
      setReceiptData(data);
      setReceiptUploadOpen(false);
      setReceiptReviewOpen(true);
    },
    onReceiptUploadError: (msg) => {
      setErrorNotice(msg);
    },
    onBulkAddSuccess: () => {
      setReceiptReviewOpen(false);
      setReceiptData(null);
    },
    onBulkAddError: (msg) => {
      setErrorNotice(msg);
    },
    onShoppingListError: (msg) => {
      setErrorNotice(msg);
    },
    onConsumeSuccess: (updated, sourceItems) => {
      if (updated.quantity === 0) {
        const sourceItem = sourceItems.find((i) => i.id === updated.id);
        if (sourceItem) setConsumePromptItem(sourceItem);
      }
    },
    onConsumeError: (_id, msg) => {
      setErrorNotice(msg);
    },
    onPurchasedSuccess: (slItem) => {
      setDefaultLocation("pantry");
      setEditItem(null);
      setScannedProduct({
        name: slItem.name,
        brand: slItem.brand ?? undefined,
        category: slItem.category ?? undefined,
        barcode: "",
      });
      setAddDialogOpen(true);
    },
    onPurchasedError: (msg) => setErrorNotice(msg),
  });

  const handleAddItem = (location?: ItemLocation) => {
    setDefaultLocation(location);
    setEditItem(null);
    setAddDialogOpen(true);
  };

  const handleEditItem = (item: InventoryItem) => {
    setEditItem(item);
    setDefaultLocation(undefined);
    setAddDialogOpen(true);
  };

  const handleSubmit = (data: CreateItemDto) => {
    const payload = selectedHouseId ? { ...data, houseId: selectedHouseId } : data;
    if (editItem) {
      updateMutation.mutate({ id: editItem.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
    setScannedProduct(null);
    setBarcodeNotice(null);
  };

  const handleBarcodeScan = (barcode: string) => {
    void (async () => {
      setEditItem(null);
      setDefaultLocation("pantry");
      setScannerOpen(false);

      try {
        const product = await api.lookupBarcode(barcode);
        setBarcodeNotice(null);
        setScannedProduct({
          name: product.name,
          brand: product.brand,
          category: product.category,
          imageUrl: product.imageUrl,
          barcode,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "";
        const isNotFound = message.includes("404");
        setBarcodeNotice(
          isNotFound
            ? "We couldn't find that product in our database. No worries — just fill in the details below!"
            : "Something went wrong looking up that barcode. You can still add the item manually."
        );
        setScannedProduct({ name: "", barcode });
      }

      setAddDialogOpen(true);
    })();
  };

  const handleLogout = () => {
    clearAuth();
    navigate("/login");
  };

  const handleConsume = (item: InventoryItem) => {
    consume(item, items);
  };

  const handleReorderConfirm = (item: InventoryItem) => {
    void addToShoppingListMutation.mutateAsync(item).then(() => {
      setConsumePromptItem(null);
    });
  };

  const handleShoppingListPurchased = (slItem: ShoppingListItem) => {
    markPurchasedMutation.mutate(slItem);
  };

  const pantryItems = useMemo(() => items.filter((item) => item.location === "pantry"), [items]);
  const fridgeItems = useMemo(() => items.filter((item) => item.location === "fridge"), [items]);
  const freezerItems = useMemo(() => items.filter((item) => item.location === "freezer"), [items]);

  const expiringCount = useMemo(
    () =>
      items.filter((item) => {
        if (!item.expirationDate) return false;
        const d = parseExpiry(item.expirationDate);
        return d > new Date() && d <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      }).length,
    [items]
  );

  const expiredCount = useMemo(
    () =>
      items.filter((item) =>
        item.expirationDate ? parseExpiry(item.expirationDate) < new Date() : false
      ).length,
    [items]
  );

  const filteredPantry = useMemo(
    () => filterBySearch(pantryItems, searchQuery),
    [pantryItems, searchQuery]
  );
  const filteredFridge = useMemo(
    () => filterBySearch(fridgeItems, searchQuery),
    [fridgeItems, searchQuery]
  );
  const filteredFreezer = useMemo(
    () => filterBySearch(freezerItems, searchQuery),
    [freezerItems, searchQuery]
  );

  return (
    <div className="flex min-h-dvh flex-col bg-background md:h-screen md:flex-row md:overflow-hidden">
      <div className="hidden md:flex">
        <Sidebar
          user={user}
          onLogout={handleLogout}
          totalItems={items.length}
          expiringCount={expiringCount}
          expiredCount={expiredCount}
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          pantryCount={pantryItems.length}
          fridgeCount={fridgeItems.length}
          freezerCount={freezerItems.length}
          inviteCode={household?.inviteCode}
          reorderCount={shoppingListItems.length}
          onReorderClick={() => setReorderOpen(true)}
        />
      </div>

      <div className="flex flex-1 flex-col md:overflow-hidden">
        <MobileTopBar
          inviteCode={household?.inviteCode}
          onSearchToggle={() => setMobileSearchOpen((v) => !v)}
          onAdd={() => handleAddItem()}
          onScan={() => setScannerOpen(true)}
          onReceipt={() => setReceiptUploadOpen(true)}
          onLogout={handleLogout}
        />
        {errorNotice && (
          <div
            role="alert"
            className="flex items-center justify-between gap-2 px-4 py-2 bg-destructive/10 text-destructive text-sm border-b border-destructive/20"
          >
            <span>{errorNotice}</span>
            <button
              aria-label="Dismiss error"
              onClick={() => setErrorNotice(null)}
              className="shrink-0 rounded p-0.5 hover:bg-destructive/20 focus:outline-none focus:ring-2 focus:ring-destructive/50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {/* House selector strip — mobile only */}
        <div className="md:hidden sticky top-[56px] z-10 bg-background/95 backdrop-blur border-b border-border">
          <HouseSelector variant="bar" />
        </div>
        {mobileSearchOpen && (
          <div className="px-4 py-2 md:hidden">
            <div className="relative">
              <Search
                aria-hidden="true"
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="text"
                aria-label="Search items"
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-11 w-full rounded-xl border-0 bg-secondary pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground"
              />
            </div>
          </div>
        )}
        <div className="px-4 py-2 md:hidden">
          <SegmentedTabs
            value={activeSection}
            onChange={setActiveSection}
            counts={{
              all: items.length,
              pantry: pantryItems.length,
              fridge: fridgeItems.length,
              freezer: freezerItems.length,
            }}
          />
        </div>

        {/* Desktop Topbar */}
        <header className="hidden shrink-0 border-b bg-card px-6 py-4 md:flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">
              {activeSection === "all"
                ? "All Storage"
                : activeSection === "pantry"
                  ? "Pantry"
                  : activeSection === "fridge"
                    ? "Fridge"
                    : "Freezer"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {user ? `Welcome back, ${user.name}` : "Your household inventory"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search
                aria-hidden="true"
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
              />
              <input
                type="text"
                aria-label="Search items"
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 text-sm bg-secondary rounded-xl border-0 w-56 focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground"
              />
            </div>
            <Button
              onClick={() => setScannerOpen(true)}
              variant="outline"
              size="sm"
              className="rounded-xl"
            >
              <Camera className="h-4 w-4 mr-2" />
              Scan
            </Button>
            <Button
              onClick={() => setReceiptUploadOpen(true)}
              variant="outline"
              size="sm"
              className="rounded-xl"
            >
              <FileText className="h-4 w-4 mr-2" />
              Receipt
            </Button>
            <ThemeToggle />
            <Button
              onClick={() => setReorderOpen(true)}
              variant="outline"
              size="sm"
              className="rounded-xl relative"
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              Re-order
              {shoppingListItems.length > 0 && (
                <span className="absolute -top-1 -right-1 text-xs bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center">
                  {shoppingListItems.length}
                </span>
              )}
            </Button>
          </div>
        </header>

        {/* Scrollable main content */}
        <main className="flex-1 px-4 pb-24 pt-4 md:overflow-y-auto md:p-6 md:pb-6">
          {/* Stats row — only in "all" view */}
          {activeSection === "all" && (
            <div className="mb-6 grid grid-cols-2 gap-3 md:mb-8 md:gap-4 xl:grid-cols-4">
              <StatCard
                icon={Package}
                label="Total Items"
                value={items.length}
                sub="in your kitchen"
                color="violet"
              />
              <StatCard
                icon={Thermometer}
                label="In Fridge"
                value={fridgeItems.length}
                sub="items refrigerated"
                color="blue"
              />
              <StatCard
                icon={Snowflake}
                label="In Freezer"
                value={freezerItems.length}
                sub="items frozen"
                color="cyan"
              />
              <StatCard
                icon={AlertTriangle}
                label="Expiring Soon"
                value={expiringCount}
                sub="within 7 days"
                color="amber"
              />
            </div>
          )}

          {/* Item sections */}
          {isLoading ? (
            <div className="flex items-center justify-center py-24">
              <div className="text-center">
                <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Loading your inventory...</p>
              </div>
            </div>
          ) : (
            <div
              className={
                activeSection === "all"
                  ? "grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6"
                  : "max-w-lg"
              }
            >
              {(activeSection === "all" || activeSection === "pantry") && (
                <LocationSection
                  title="Pantry"
                  icon={Package}
                  items={filteredPantry}
                  color="violet"
                  onAdd={() => handleAddItem("pantry")}
                  onEdit={handleEditItem}
                  onDelete={(id) => deleteMutation.mutate(id)}
                  onConsume={handleConsume}
                  consumingIds={consumingIds}
                />
              )}
              {(activeSection === "all" || activeSection === "fridge") && (
                <LocationSection
                  title="Fridge"
                  icon={Thermometer}
                  items={filteredFridge}
                  color="blue"
                  onAdd={() => handleAddItem("fridge")}
                  onEdit={handleEditItem}
                  onDelete={(id) => deleteMutation.mutate(id)}
                  onConsume={handleConsume}
                  consumingIds={consumingIds}
                />
              )}
              {(activeSection === "all" || activeSection === "freezer") && (
                <LocationSection
                  title="Freezer"
                  icon={Snowflake}
                  items={filteredFreezer}
                  color="cyan"
                  onAdd={() => handleAddItem("freezer")}
                  onEdit={handleEditItem}
                  onDelete={(id) => deleteMutation.mutate(id)}
                  onConsume={handleConsume}
                  consumingIds={consumingIds}
                />
              )}
            </div>
          )}
        </main>
        <MobileFAB onClick={() => handleAddItem()} />
      </div>

      {/* Consume-to-zero re-order prompt */}
      <Dialog
        open={!!consumePromptItem}
        onOpenChange={(open) => {
          if (!open) setConsumePromptItem(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogTitle>You&apos;re out of {consumePromptItem?.name}</DialogTitle>
          <DialogDescription>Add it to your re-order list?</DialogDescription>
          <DialogFooter className="flex-row gap-2 sm:gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setConsumePromptItem(null)}>
              No thanks
            </Button>
            <Button
              className="flex-1"
              onClick={() => consumePromptItem && handleReorderConfirm(consumePromptItem)}
            >
              Add to Re-order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shopping list panel */}
      <Sheet open={reorderOpen} onOpenChange={setReorderOpen}>
        <SheetContent side="right" className="flex flex-col p-0 gap-0">
          <div className="flex items-center gap-2 px-4 py-4 border-b shrink-0">
            <ShoppingCart className="h-4 w-4 shrink-0" aria-hidden="true" />
            <SheetTitle className="font-semibold text-sm">Re-order List</SheetTitle>
            {shoppingListItems.length > 0 && (
              <span className="text-xs bg-primary text-primary-foreground rounded-full px-2 py-0.5">
                {shoppingListItems.length}
              </span>
            )}
          </div>
          <SheetDescription className="sr-only">Items you have marked to re-order</SheetDescription>
          <div className="flex-1 overflow-y-auto p-4">
            <ShoppingListPanel
              items={shoppingListItems}
              onPurchased={handleShoppingListPurchased}
              onDelete={(id) => deleteShoppingListMutation.mutate(id)}
            />
          </div>
        </SheetContent>
      </Sheet>

      <AddItemDialog
        open={addDialogOpen}
        onOpenChange={(open) => {
          setAddDialogOpen(open);
          if (!open) {
            setScannedProduct(null);
            setBarcodeNotice(null);
          }
        }}
        onSubmit={handleSubmit}
        editItem={editItem}
        defaultLocation={defaultLocation}
        scannedProduct={scannedProduct}
        barcodeNotice={barcodeNotice}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
      />

      <BarcodeScanner open={scannerOpen} onOpenChange={setScannerOpen} onScan={handleBarcodeScan} />

      <ReceiptUpload
        open={receiptUploadOpen}
        onOpenChange={setReceiptUploadOpen}
        onUpload={(file) => uploadReceiptMutation.mutate(file)}
        isLoading={uploadReceiptMutation.isPending}
      />

      {receiptData && (
        <ReceiptReviewSheet
          open={receiptReviewOpen}
          onOpenChange={(open) => {
            setReceiptReviewOpen(open);
            if (!open) setReceiptData(null);
          }}
          receiptData={receiptData}
          onConfirm={(items) => bulkAddReceiptItemsMutation.mutate(items)}
          isSubmitting={bulkAddReceiptItemsMutation.isPending}
        />
      )}
    </div>
  );
}
