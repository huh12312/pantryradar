import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Camera, FileText } from "lucide-react-native";
import type { ItemLocation } from "@pantrymaid/shared";
import type { Item } from "@pantrymaid/shared";
import { createItemOffline, updateItemOffline } from "../../src/lib/sync";
import { UnitPicker } from "../../src/components/UnitPicker";
import { getItemsByLocation } from "../../src/lib/db";

export default function AddScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    prefillName?: string;
    prefillCategory?: string;
    prefillUnit?: string;
    prefillExpiry?: string;
  }>();

  const [form, setForm] = useState({
    name: "",
    brand: "",
    category: "",
    location: "pantry" as ItemLocation,
    quantity: "1",
    unit: "",
    notes: "",
  });
  const [duplicateItem, setDuplicateItem] = useState<Item | null>(null);

  useEffect(() => {
    if (params.prefillName) {
      setForm((prev) => ({
        ...prev,
        name: params.prefillName ?? prev.name,
        category: params.prefillCategory ?? prev.category,
        unit: params.prefillUnit ?? prev.unit,
      }));
    }
  }, [params.prefillName]);

  const checkDuplicate = async (name: string) => {
    if (!name.trim()) { setDuplicateItem(null); return; }
    const allItems = [
      ...(await getItemsByLocation("pantry")),
      ...(await getItemsByLocation("fridge")),
      ...(await getItemsByLocation("freezer")),
    ];
    const match = allItems.find((i) => i.name.toLowerCase() === name.trim().toLowerCase());
    setDuplicateItem(match ?? null);
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

      Alert.alert("Success", "Item added successfully");
      setForm({
        name: "",
        brand: "",
        category: "",
        location: "pantry",
        quantity: "1",
        unit: "",
        notes: "",
      });
      setDuplicateItem(null);

      // Navigate to the corresponding location tab
      router.push(`/(tabs)/${form.location}`);
    } catch (error) {
      console.error("Failed to add item:", error);
      Alert.alert("Error", "Failed to add item");
    }
  };

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="p-4">
        <View className="flex-row gap-3 mb-3">
          <TouchableOpacity
            onPress={() => router.push("/barcode")}
            className="flex-1 bg-blue-600 py-4 rounded-lg flex-row items-center justify-center"
          >
            <Camera color="#ffffff" size={24} />
            <Text className="text-white font-semibold text-base ml-2">
              Scan Barcode
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/receipt")}
            className="flex-1 bg-green-600 py-4 rounded-lg flex-row items-center justify-center"
          >
            <FileText color="#ffffff" size={24} />
            <Text className="text-white font-semibold text-base ml-2">
              Scan Receipt
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={() => router.push("/quick-add")}
          className="bg-violet-600 py-4 rounded-lg flex-row items-center justify-center mb-3"
        >
          <Text className="text-white font-semibold text-base">Browse Common Items</Text>
        </TouchableOpacity>

        <View className="bg-white p-6 rounded-lg shadow-sm">
          <Text className="text-xl font-bold text-gray-900 mb-4">
            Manual Entry
          </Text>

          <View className="mb-4">
            <Text className="text-sm text-gray-700 mb-1">Name *</Text>
            <TextInput
              value={form.name}
              onChangeText={(text) => setForm({ ...form, name: text })}
              onBlur={() => checkDuplicate(form.name)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-base"
              placeholder="Item name"
            />
            {duplicateItem && (
              <View className="mt-1 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <Text className="text-xs text-amber-800">
                  Already have {duplicateItem.name} in {duplicateItem.location} (qty: {duplicateItem.quantity}).
                </Text>
                <View className="flex-row gap-2 mt-1">
                  <TouchableOpacity
                    onPress={() => setDuplicateItem(null)}
                    className="bg-white border border-amber-300 rounded px-2 py-1"
                  >
                    <Text className="text-xs text-amber-800">Add Anyway</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={async () => {
                      await updateItemOffline(duplicateItem.id, {
                        quantity: duplicateItem.quantity + (parseFloat(form.quantity) || 1),
                      });
                      Alert.alert("Merged", `Quantity updated to ${duplicateItem.quantity + (parseFloat(form.quantity) || 1)}`);
                      setDuplicateItem(null);
                      setForm({ name: "", brand: "", category: "", location: "pantry", quantity: "1", unit: "" , notes: "" });
                    }}
                    className="bg-amber-600 rounded px-2 py-1"
                  >
                    <Text className="text-xs text-white">Merge Qty</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
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
                    className={`text-center capitalize ${
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
