import { useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, Alert, RefreshControl,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { ShoppingCart, Check, Trash2 } from "lucide-react-native";
import {
  getShoppingListItems,
  type LocalShoppingListItem,
} from "../../src/lib/db";
import {
  markShoppingListPurchasedOffline,
  deleteShoppingListItemOffline,
} from "../../src/lib/sync";

export default function ReorderScreen() {
  const router = useRouter();
  const [items, setItems] = useState<LocalShoppingListItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    const rows = await getShoppingListItems();
    setItems(rows);
  };

  useFocusEffect(useCallback(() => { void load(); }, []));

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handlePurchased = async (item: LocalShoppingListItem) => {
    await markShoppingListPurchasedOffline(item.id);
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    router.push({
      pathname: "/(tabs)/add",
      params: {
        prefillName: item.name,
        prefillCategory: item.category ?? "",
        prefillUnit: item.unit ?? "",
      },
    });
  };

  const handleDelete = async (id: string) => {
    Alert.alert("Remove", "Remove from re-order list?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await deleteShoppingListItemOffline(id);
          setItems((prev) => prev.filter((i) => i.id !== id));
        },
      },
    ]);
  };

  if (items.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 p-8">
        <ShoppingCart color="#9ca3af" size={40} />
        <Text className="text-gray-500 text-center mt-3">Nothing on the re-order list</Text>
      </View>
    );
  }

  return (
    <FlatList
      className="flex-1 bg-gray-50"
      data={items}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      renderItem={({ item }) => (
        <View className="flex-row items-center bg-white px-4 py-3 border-b border-gray-100">
          <View className="flex-1 min-w-0 mr-3">
            <Text className="text-sm font-semibold text-gray-900">{item.name}</Text>
            <Text className="text-xs text-gray-500">
              {[item.brand, item.suggestedQty && `qty ${item.suggestedQty}`, item.unit]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => handlePurchased(item)}
            className="bg-blue-600 py-1.5 px-3 rounded-lg flex-row items-center mr-2"
          >
            <Check color="#ffffff" size={12} />
            <Text className="text-white text-xs font-semibold ml-1">Purchased</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(item.id)}>
            <Trash2 color="#9ca3af" size={16} />
          </TouchableOpacity>
        </View>
      )}
    />
  );
}
