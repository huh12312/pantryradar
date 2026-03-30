import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { Item, ItemLocation } from "@pantrymaid/shared";
import { getItemById } from "../../src/lib/db";
import { updateItemOffline, deleteItemOffline } from "../../src/lib/sync";
import { Trash2, Edit, Save, X } from "lucide-react-native";

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<Item | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    brand: "",
    category: "",
    location: "pantry" as ItemLocation,
    quantity: "1",
    unit: "",
    notes: "",
  });

  useEffect(() => {
    loadItem();
  }, [id]);

  const loadItem = async () => {
    if (!id) return;
    const data = await getItemById(id);
    if (data) {
      setItem(data);
      setEditForm({
        name: data.name,
        brand: data.brand || "",
        category: data.category || "",
        location: data.location,
        quantity: data.quantity.toString(),
        unit: data.unit || "",
        notes: data.notes || "",
      });
    }
  };

  const handleSave = async () => {
    if (!item) return;

    try {
      await updateItemOffline(item.id, {
        name: editForm.name,
        brand: editForm.brand || undefined,
        category: editForm.category || undefined,
        location: editForm.location,
        quantity: parseFloat(editForm.quantity) || 1,
        unit: editForm.unit || undefined,
        notes: editForm.notes || undefined,
      });

      await loadItem();
      setIsEditing(false);
      Alert.alert("Success", "Item updated successfully");
    } catch (error) {
      console.error("Failed to update item:", error);
      Alert.alert("Error", "Failed to update item");
    }
  };

  const handleDelete = () => {
    if (!item) return;

    Alert.alert("Delete Item", `Are you sure you want to delete ${item.name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteItemOffline(item.id);
            router.back();
          } catch (error) {
            console.error("Failed to delete item:", error);
            Alert.alert("Error", "Failed to delete item");
          }
        },
      },
    ]);
  };

  if (!item) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <Text className="text-gray-600">Item not found</Text>
      </View>
    );
  }

  const expiresIn = item.expirationDate
    ? Math.ceil((item.expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="p-4">
        {!isEditing ? (
          <View className="bg-white p-6 rounded-lg shadow-sm">
            <View className="flex-row justify-between items-start mb-4">
              <Text className="text-2xl font-bold text-gray-900 flex-1">
                {item.name}
              </Text>
              <View className="flex-row gap-2">
                <TouchableOpacity
                  onPress={() => setIsEditing(true)}
                  className="p-2 bg-blue-50 rounded-lg"
                >
                  <Edit color="#2563eb" size={20} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleDelete}
                  className="p-2 bg-red-50 rounded-lg"
                >
                  <Trash2 color="#ef4444" size={20} />
                </TouchableOpacity>
              </View>
            </View>

            {item.brand && (
              <View className="mb-3">
                <Text className="text-sm text-gray-500 mb-1">Brand</Text>
                <Text className="text-base text-gray-900">{item.brand}</Text>
              </View>
            )}

            {item.category && (
              <View className="mb-3">
                <Text className="text-sm text-gray-500 mb-1">Category</Text>
                <Text className="text-base text-gray-900">{item.category}</Text>
              </View>
            )}

            <View className="mb-3">
              <Text className="text-sm text-gray-500 mb-1">Location</Text>
              <Text className="text-base text-gray-900 capitalize">{item.location}</Text>
            </View>

            <View className="mb-3">
              <Text className="text-sm text-gray-500 mb-1">Quantity</Text>
              <Text className="text-base text-gray-900">
                {item.quantity}
                {item.unit ? ` ${item.unit}` : ""}
              </Text>
            </View>

            {expiresIn !== null && (
              <View className="mb-3">
                <Text className="text-sm text-gray-500 mb-1">Expiration</Text>
                <Text
                  className={`text-base ${
                    expiresIn <= 3
                      ? "text-red-600"
                      : expiresIn <= 7
                        ? "text-orange-600"
                        : "text-gray-900"
                  }`}
                >
                  {expiresIn < 0
                    ? "Expired"
                    : expiresIn === 0
                      ? "Expires today"
                      : `Expires in ${expiresIn} ${expiresIn === 1 ? "day" : "days"}`}
                </Text>
              </View>
            )}

            {item.notes && (
              <View className="mb-3">
                <Text className="text-sm text-gray-500 mb-1">Notes</Text>
                <Text className="text-base text-gray-900">{item.notes}</Text>
              </View>
            )}
          </View>
        ) : (
          <View className="bg-white p-6 rounded-lg shadow-sm">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xl font-bold text-gray-900">Edit Item</Text>
              <TouchableOpacity
                onPress={() => setIsEditing(false)}
                className="p-2"
              >
                <X color="#6b7280" size={24} />
              </TouchableOpacity>
            </View>

            <View className="mb-4">
              <Text className="text-sm text-gray-700 mb-1">Name *</Text>
              <TextInput
                value={editForm.name}
                onChangeText={(text) => setEditForm({ ...editForm, name: text })}
                className="border border-gray-300 rounded-lg px-3 py-2 text-base"
                placeholder="Item name"
              />
            </View>

            <View className="mb-4">
              <Text className="text-sm text-gray-700 mb-1">Brand</Text>
              <TextInput
                value={editForm.brand}
                onChangeText={(text) => setEditForm({ ...editForm, brand: text })}
                className="border border-gray-300 rounded-lg px-3 py-2 text-base"
                placeholder="Brand name"
              />
            </View>

            <View className="mb-4">
              <Text className="text-sm text-gray-700 mb-1">Category</Text>
              <TextInput
                value={editForm.category}
                onChangeText={(text) => setEditForm({ ...editForm, category: text })}
                className="border border-gray-300 rounded-lg px-3 py-2 text-base"
                placeholder="Category"
              />
            </View>

            <View className="mb-4">
              <Text className="text-sm text-gray-700 mb-1">Quantity *</Text>
              <TextInput
                value={editForm.quantity}
                onChangeText={(text) => setEditForm({ ...editForm, quantity: text })}
                className="border border-gray-300 rounded-lg px-3 py-2 text-base"
                placeholder="1"
                keyboardType="numeric"
              />
            </View>

            <View className="mb-4">
              <Text className="text-sm text-gray-700 mb-1">Unit</Text>
              <TextInput
                value={editForm.unit}
                onChangeText={(text) => setEditForm({ ...editForm, unit: text })}
                className="border border-gray-300 rounded-lg px-3 py-2 text-base"
                placeholder="e.g., lbs, oz, count"
              />
            </View>

            <View className="mb-4">
              <Text className="text-sm text-gray-700 mb-1">Notes</Text>
              <TextInput
                value={editForm.notes}
                onChangeText={(text) => setEditForm({ ...editForm, notes: text })}
                className="border border-gray-300 rounded-lg px-3 py-2 text-base"
                placeholder="Additional notes"
                multiline
                numberOfLines={3}
              />
            </View>

            <TouchableOpacity
              onPress={handleSave}
              className="bg-blue-600 py-3 rounded-lg flex-row items-center justify-center"
            >
              <Save color="#ffffff" size={20} />
              <Text className="text-white font-semibold text-base ml-2">
                Save Changes
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
