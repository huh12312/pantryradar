import { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  TextInput,
  ScrollView,
  FlatList,
  Image,
  Animated,
  Pressable,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { X, Zap, ZapOff } from "lucide-react-native";
import type { ItemLocation, ProductSearchResult } from "@pantrymaid/shared";
import { apiClient } from "../src/lib/api";
import { createItemOffline } from "../src/lib/sync";
import { UnitPicker } from "../src/components/UnitPicker";

const ZOOM_LEVELS = [
  { label: "1×", value: 0 },
  { label: "2×", value: 0.15 },
  { label: "3×", value: 0.3 },
] as const;

export default function BarcodeScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [productData, setProductData] = useState<{
    name: string;
    brand?: string;
    category?: string;
  } | null>(null);
  const [form, setForm] = useState({
    name: "",
    brand: "",
    category: "",
    location: "pantry" as ItemLocation,
    quantity: "1",
    unit: "",
    notes: "",
  });

  // Camera controls
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [zoom, setZoom] = useState(0);
  const [autofocus, setAutofocus] = useState<"on" | "off">("off");
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);
  const focusOpacity = useRef(new Animated.Value(0)).current;

  // Manual barcode entry
  const [showManualBarcode, setShowManualBarcode] = useState(false);
  const [manualBarcode, setManualBarcode] = useState("");

  // Product name search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProductSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTapToFocus = (event: { nativeEvent: { locationX: number; locationY: number } }) => {
    const { locationX, locationY } = event.nativeEvent;
    setFocusPoint({ x: locationX, y: locationY });
    // iOS: trigger one-shot autofocus then resume continuous
    setAutofocus("on");
    setTimeout(() => setAutofocus("off"), 1500);
    // Show focus ring
    focusOpacity.setValue(1);
    Animated.sequence([
      Animated.delay(300),
      Animated.timing(focusOpacity, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]).start(() => setFocusPoint(null));
  };

  const handleSystemScanner = async () => {
    const subscription = CameraView.onModernBarcodeScanned(({ data }) => {
      subscription.remove();
      CameraView.dismissScanner();
      handleBarCodeScanned({ data });
    });
    await CameraView.launchScanner({
      barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39"],
    });
    subscription.remove();
  };

  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (q.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    searchDebounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const result = await apiClient.searchProducts(q.trim());
        if (result.success && result.data) setSearchResults(result.data);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  };

  const handleSelectSearchResult = (r: ProductSearchResult) => {
    setForm((prev) => ({
      ...prev,
      name: r.name ?? prev.name,
      brand: r.brand ?? prev.brand ?? "",
      category: r.category ?? prev.category ?? "",
    }));
    setSearchQuery("");
    setSearchResults([]);
    setScanned(true);
  };

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned || loading) return;

    setScanned(true);
    setLoading(true);

    try {
      const result = await apiClient.lookupBarcode(data);

      if (result.success && result.data) {
        setProductData({
          name: result.data.name,
          brand: result.data.brand,
          category: result.data.category,
        });
        setForm({
          ...form,
          name: result.data.name,
          brand: result.data.brand || "",
          category: result.data.category || "",
        });
      } else {
        Alert.alert(
          "Product Not Found",
          "This barcode was not found in the database. Please enter the details manually.",
          [{ text: "OK" }]
        );
        setProductData(null);
      }
    } catch (error) {
      console.error("Failed to lookup barcode:", error);
      Alert.alert("Error", "Failed to lookup barcode. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      Alert.alert("Error", "Item name is required");
      return;
    }

    try {
      await createItemOffline({
        name: form.name,
        brand: form.brand || undefined,
        category: form.category || undefined,
        location: form.location,
        quantity: parseFloat(form.quantity) || 1,
        unit: form.unit || undefined,
        notes: form.notes || undefined,
      });

      Alert.alert("Success", "Item added successfully", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error("Failed to add item:", error);
      Alert.alert("Error", "Failed to add item");
    }
  };

  if (!permission) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <Text className="text-white">Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center bg-black p-6">
        <Text className="text-white text-center mb-4">
          Camera permission is required to scan barcodes
        </Text>
        <TouchableOpacity
          onPress={requestPermission}
          className="bg-blue-600 py-3 px-6 rounded-lg mb-3"
        >
          <Text className="text-white font-semibold">Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()} className="py-3 px-6 rounded-lg">
          <Text className="text-white">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (scanned && (productData || !loading)) {
    return (
      <ScrollView className="flex-1 bg-gray-50">
        <View className="p-4">
          <TouchableOpacity
            onPress={() => {
              setScanned(false);
              setProductData(null);
            }}
            className="absolute top-4 left-4 z-10 bg-white p-2 rounded-full shadow"
          >
            <X color="#000000" size={24} />
          </TouchableOpacity>

          <View className="bg-white p-6 rounded-lg shadow-sm mt-12">
            <Text className="text-xl font-bold text-gray-900 mb-4">
              {productData ? "Confirm Item Details" : "Enter Item Details"}
            </Text>

            <View className="mb-4">
              <Text className="text-sm text-gray-700 mb-1">Name *</Text>
              <TextInput
                value={form.name}
                onChangeText={(text) => setForm({ ...form, name: text })}
                className="border border-gray-300 rounded-lg px-3 py-2 text-base"
                placeholder="Item name"
              />
            </View>

            <View className="mb-4">
              <Text className="text-sm text-gray-700 mb-1">Brand</Text>
              <TextInput
                value={form.brand}
                onChangeText={(text) => setForm({ ...form, brand: text })}
                className="border border-gray-300 rounded-lg px-3 py-2 text-base"
                placeholder="Brand name"
              />
            </View>

            <View className="mb-4">
              <Text className="text-sm text-gray-700 mb-1">Category</Text>
              <TextInput
                value={form.category}
                onChangeText={(text) => setForm({ ...form, category: text })}
                className="border border-gray-300 rounded-lg px-3 py-2 text-base"
                placeholder="Category"
              />
            </View>

            <View className="mb-4">
              <Text className="text-sm text-gray-700 mb-1">Location *</Text>
              <View className="flex-row gap-2">
                {(["pantry", "fridge", "freezer"] as ItemLocation[]).map((loc) => (
                  <TouchableOpacity
                    key={loc}
                    onPress={() => setForm({ ...form, location: loc })}
                    className={`flex-1 py-2 px-3 rounded-lg border ${
                      form.location === loc
                        ? "bg-blue-600 border-blue-600"
                        : "bg-white border-gray-300"
                    }`}
                  >
                    <Text
                      className={`text-center capitalize text-sm ${
                        form.location === loc ? "text-white font-semibold" : "text-gray-700"
                      }`}
                    >
                      {loc}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View className="mb-4">
              <Text className="text-sm text-gray-700 mb-1">Quantity *</Text>
              <TextInput
                value={form.quantity}
                onChangeText={(text) => setForm({ ...form, quantity: text })}
                className="border border-gray-300 rounded-lg px-3 py-2 text-base"
                placeholder="1"
                keyboardType="numeric"
              />
            </View>

            <View className="mb-4">
              <Text className="text-sm text-gray-700 mb-1">Unit</Text>
              <UnitPicker value={form.unit} onChange={(unit) => setForm({ ...form, unit })} />
            </View>

            <View className="mb-4">
              <Text className="text-sm text-gray-700 mb-1">Notes</Text>
              <TextInput
                value={form.notes}
                onChangeText={(text) => setForm({ ...form, notes: text })}
                className="border border-gray-300 rounded-lg px-3 py-2 text-base"
                placeholder="Additional notes"
                multiline
                numberOfLines={3}
              />
            </View>

            <TouchableOpacity onPress={handleSubmit} className="bg-blue-600 py-3 rounded-lg">
              <Text className="text-white font-semibold text-base text-center">Add Item</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        autofocus={autofocus}
        zoom={zoom}
        enableTorch={torchEnabled}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39"],
        }}
      >
        <Pressable style={{ flex: 1 }} onPress={handleTapToFocus}>
          {/* Close */}
          <TouchableOpacity
            onPress={() => router.back()}
            className="absolute top-12 left-4 bg-white/20 p-3 rounded-full z-10"
          >
            <X color="#ffffff" size={24} />
          </TouchableOpacity>

          {/* Torch toggle */}
          <TouchableOpacity
            onPress={() => setTorchEnabled((t) => !t)}
            className="absolute top-12 right-4 bg-white/20 p-3 rounded-full z-10"
          >
            {torchEnabled ? (
              <Zap color="#fde047" size={24} fill="#fde047" />
            ) : (
              <ZapOff color="#ffffff" size={24} />
            )}
          </TouchableOpacity>

          {/* Name search — inset from both sides for close + torch buttons */}
          <View className="absolute top-12 left-16 right-16 z-10">
            <TextInput
              value={searchQuery}
              onChangeText={handleSearchChange}
              placeholder="Or search by name…"
              placeholderTextColor="rgba(255,255,255,0.6)"
              className="bg-black/50 text-white rounded-xl px-4 py-2 text-sm"
            />
            {isSearching && (
              <Text className="text-white/70 text-xs mt-1 ml-1">Searching…</Text>
            )}
            {searchResults.length > 0 && (
              <FlatList
                data={searchResults}
                keyExtractor={(item, idx) => `${item.source}-${item.upc ?? item.name}-${idx}`}
                style={{ maxHeight: 240, marginTop: 4, borderRadius: 12, overflow: "hidden" }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => handleSelectSearchResult(item)}
                    className="flex-row items-center gap-3 bg-white px-3 py-2 border-b border-gray-100"
                  >
                    {item.imageUrl ? (
                      <Image
                        source={{ uri: item.imageUrl }}
                        className="h-10 w-10 rounded bg-gray-100"
                        resizeMode="cover"
                      />
                    ) : (
                      <View className="h-10 w-10 rounded bg-gray-200" />
                    )}
                    <View className="flex-1">
                      <Text className="text-sm font-medium text-gray-900" numberOfLines={1}>
                        {item.name}
                      </Text>
                      {item.brand ? (
                        <Text className="text-xs text-gray-500" numberOfLines={1}>
                          {item.brand}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>

          {/* Scan window */}
          <View className="flex-1 items-center justify-center">
            <View className="border-2 border-white w-72 h-36 rounded-xl" />
            <Text className="text-white text-center mt-4 text-base">
              Position barcode within the frame
            </Text>
            <Text className="text-white/50 text-center mt-1 text-xs">
              Tap anywhere to focus
            </Text>
          </View>

          {/* Tap-to-focus indicator */}
          {focusPoint && (
            <Animated.View
              style={{
                position: "absolute",
                left: focusPoint.x - 30,
                top: focusPoint.y - 30,
                width: 60,
                height: 60,
                borderRadius: 4,
                borderWidth: 2,
                borderColor: "rgba(255, 220, 0, 0.9)",
                opacity: focusOpacity,
                pointerEvents: "none",
              }}
            />
          )}

          {/* Bottom controls */}
          <View className="absolute bottom-12 left-0 right-0 items-center gap-3">
            {/* Zoom level buttons */}
            <View className="flex-row gap-2">
              {ZOOM_LEVELS.map((z) => (
                <TouchableOpacity
                  key={z.label}
                  onPress={() => setZoom(z.value)}
                  className={`px-4 py-1.5 rounded-full border ${
                    zoom === z.value ? "bg-white border-white" : "bg-white/20 border-white/40"
                  }`}
                >
                  <Text
                    className={`text-sm font-semibold ${
                      zoom === z.value ? "text-black" : "text-white"
                    }`}
                  >
                    {z.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* System scanner */}
            <TouchableOpacity
              onPress={handleSystemScanner}
              className="bg-white/20 border border-white/40 rounded-xl px-6 py-2"
            >
              <Text className="text-white text-sm">Use system scanner</Text>
            </TouchableOpacity>

            {/* Manual barcode entry */}
            {showManualBarcode ? (
              <View className="flex-row items-center bg-white rounded-xl px-3 py-1.5 mx-8 w-72">
                <TextInput
                  value={manualBarcode}
                  onChangeText={setManualBarcode}
                  placeholder="Enter barcode number"
                  keyboardType="numeric"
                  autoFocus
                  className="flex-1 text-base"
                  onSubmitEditing={() => {
                    if (manualBarcode.trim()) {
                      setShowManualBarcode(false);
                      handleBarCodeScanned({ data: manualBarcode.trim() });
                    }
                  }}
                  returnKeyType="search"
                />
                <TouchableOpacity
                  onPress={() => {
                    setShowManualBarcode(false);
                    setManualBarcode("");
                  }}
                >
                  <X color="#666666" size={16} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={() => setShowManualBarcode(true)}>
                <Text className="text-white/70 text-sm">Type barcode manually</Text>
              </TouchableOpacity>
            )}
          </View>

          {loading && (
            <View className="absolute bottom-32 left-0 right-0 items-center">
              <View className="bg-white/90 py-4 px-6 rounded-lg">
                <Text className="text-gray-900 font-semibold">Looking up product...</Text>
              </View>
            </View>
          )}
        </Pressable>
      </CameraView>
    </View>
  );
}
