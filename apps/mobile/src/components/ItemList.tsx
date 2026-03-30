import { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import type { Item, ItemLocation } from "@pantrymaid/shared";
import { getItemsByLocation } from "../lib/db";
import { syncQueue, syncFromServer } from "../lib/sync";
import { deleteItemOffline } from "../lib/sync";
import { Trash2 } from "lucide-react-native";

interface ItemListProps {
  location: ItemLocation;
}

export function ItemList({ location }: ItemListProps) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadItems = async () => {
    try {
      const data = await getItemsByLocation(location);
      setItems(data);
    } catch (error) {
      console.error("Failed to load items:", error);
    }
  };

  useEffect(() => {
    loadItems();
  }, [location]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await syncFromServer();
      await syncQueue();
      await loadItems();
    } finally {
      setRefreshing(false);
    }
  };

  const handleDelete = (item: Item) => {
    Alert.alert("Delete Item", `Are you sure you want to delete ${item.name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteItemOffline(item.id);
            await loadItems();
          } catch (error) {
            console.error("Failed to delete item:", error);
            Alert.alert("Error", "Failed to delete item");
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: Item }) => {
    const expiresIn = item.expirationDate
      ? Math.ceil(
          (item.expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        )
      : null;

    return (
      <TouchableOpacity
        onPress={() => router.push(`/item/${item.id}`)}
        className="bg-white mx-4 my-2 p-4 rounded-lg shadow-sm border border-gray-200"
      >
        <View className="flex-row justify-between items-start">
          <View className="flex-1">
            <Text className="text-lg font-semibold text-gray-900">{item.name}</Text>
            {item.brand && (
              <Text className="text-sm text-gray-600 mt-1">{item.brand}</Text>
            )}
            <View className="flex-row items-center mt-2">
              <Text className="text-sm text-gray-700">
                Quantity: {item.quantity}
                {item.unit ? ` ${item.unit}` : ""}
              </Text>
            </View>
            {expiresIn !== null && (
              <Text
                className={`text-sm mt-1 ${
                  expiresIn <= 3
                    ? "text-red-600"
                    : expiresIn <= 7
                      ? "text-orange-600"
                      : "text-gray-600"
                }`}
              >
                {expiresIn < 0
                  ? "Expired"
                  : expiresIn === 0
                    ? "Expires today"
                    : `Expires in ${expiresIn} ${expiresIn === 1 ? "day" : "days"}`}
              </Text>
            )}
          </View>
          <TouchableOpacity
            onPress={() => handleDelete(item)}
            className="ml-2 p-2"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Trash2 color="#ef4444" size={20} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  if (items.length === 0) {
    return (
      <View className="flex-1 bg-gray-50">
        <FlatList
          data={[]}
          renderItem={() => null}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center p-8 mt-32">
              <Text className="text-lg text-gray-600 text-center">
                No items here yet.
              </Text>
              <Text className="text-sm text-gray-500 text-center mt-2">
                Tap the + tab to add items.
              </Text>
            </View>
          }
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        contentContainerStyle={{ paddingVertical: 8 }}
      />
    </View>
  );
}
