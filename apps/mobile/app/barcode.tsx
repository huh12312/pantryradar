import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, Alert, TextInput, ScrollView } from "react-native";
import { CameraView, Camera } from "expo-camera";
import { useRouter } from "expo-router";
import { X } from "lucide-react-native";
import type { ItemLocation } from "@pantrymaid/shared";
import { apiClient } from "../src/lib/api";
import { createItemOffline } from "../src/lib/sync";

export default function BarcodeScreen() {
  const router = useRouter();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
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

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === "granted");
    })();
  }, []);

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

  if (hasPermission === null) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <Text className="text-white">Requesting camera permission...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View className="flex-1 items-center justify-center bg-black p-6">
        <Text className="text-white text-center mb-4">
          Camera permission is required to scan barcodes
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-blue-600 py-3 px-6 rounded-lg"
        >
          <Text className="text-white font-semibold">Go Back</Text>
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
                        form.location === loc
                          ? "text-white font-semibold"
                          : "text-gray-700"
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
              <TextInput
                value={form.unit}
                onChangeText={(text) => setForm({ ...form, unit: text })}
                className="border border-gray-300 rounded-lg px-3 py-2 text-base"
                placeholder="e.g., lbs, oz, count"
              />
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

            <TouchableOpacity
              onPress={handleSubmit}
              className="bg-blue-600 py-3 rounded-lg"
            >
              <Text className="text-white font-semibold text-base text-center">
                Add Item
              </Text>
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
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39"],
        }}
      >
        <View className="flex-1">
          <TouchableOpacity
            onPress={() => router.back()}
            className="absolute top-12 left-4 bg-white/20 p-3 rounded-full"
          >
            <X color="#ffffff" size={24} />
          </TouchableOpacity>

          <View className="flex-1 items-center justify-center">
            <View className="border-2 border-white w-64 h-64 rounded-2xl" />
            <Text className="text-white text-center mt-8 text-lg">
              Position barcode within the frame
            </Text>
          </View>

          {loading && (
            <View className="absolute bottom-32 left-0 right-0 items-center">
              <View className="bg-white/90 py-4 px-6 rounded-lg">
                <Text className="text-gray-900 font-semibold">
                  Looking up product...
                </Text>
              </View>
            </View>
          )}
        </View>
      </CameraView>
    </View>
  );
}
