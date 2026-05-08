import { useState } from "react";
import { View, Text, FlatList, TextInput, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import { X, Sparkles } from "lucide-react-native";
import { ITEM_PRESETS } from "@pantrymaid/shared/constants";
import type { ItemPreset } from "@pantrymaid/shared/constants";
import { isOnline } from "../src/lib/sync";
import { apiClient } from "../src/lib/api";

export default function QuickAddScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [suggesting, setSuggesting] = useState(false);

  const filtered = query.trim().length === 0
    ? (ITEM_PRESETS as readonly ItemPreset[])
    : (ITEM_PRESETS as readonly ItemPreset[]).filter((p) =>
        p.name.toLowerCase().includes(query.toLowerCase())
      );

  const handleSelect = (preset: ItemPreset) => {
    const expirationDate = new Date(Date.now() + preset.estimatedShelfDays * 86400000)
      .toISOString()
      .split("T")[0];
    router.push({
      pathname: "/(tabs)/add",
      params: {
        prefillName: preset.name,
        prefillCategory: preset.category,
        prefillUnit: preset.unit,
        prefillExpiry: expirationDate,
      },
    });
  };

  const handleAISuggest = async () => {
    if (query.trim().length < 3) return;
    const online = await isOnline();
    if (!online) {
      Alert.alert("Offline", "AI suggest requires an internet connection.");
      return;
    }
    setSuggesting(true);
    try {
      const result = await apiClient.suggestItemDefaults(query.trim());
      if (result.success && result.data) {
        const { unit, category, estimatedShelfDays } = result.data;
        const expirationDate = new Date(Date.now() + estimatedShelfDays * 86400000)
          .toISOString()
          .split("T")[0];
        router.push({
          pathname: "/(tabs)/add",
          params: {
            prefillName: query.trim(),
            prefillCategory: category,
            prefillUnit: unit,
            prefillExpiry: expirationDate,
          },
        });
      }
    } catch {
      Alert.alert("Error", "Couldn't suggest defaults — fill in manually.");
    } finally {
      setSuggesting(false);
    }
  };

  const showAISuggest = query.trim().length >= 3 && filtered.length === 0;

  return (
    <View className="flex-1 bg-gray-50">
      <View className="flex-row items-center justify-between px-4 py-4 bg-white border-b border-gray-200">
        <Text className="text-lg font-semibold text-gray-900">Common Items</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <X color="#374151" size={24} />
        </TouchableOpacity>
      </View>
      <View className="px-4 py-3 bg-white border-b border-gray-100">
        <TextInput
          placeholder="Search items..."
          value={query}
          onChangeText={setQuery}
          className="border border-gray-300 rounded-lg px-3 py-2 text-base"
          autoFocus
        />
      </View>
      {showAISuggest && (
        <TouchableOpacity
          onPress={handleAISuggest}
          disabled={suggesting}
          className="mx-4 mt-3 bg-violet-600 py-3 rounded-lg flex-row items-center justify-center"
        >
          <Sparkles color="#ffffff" size={16} />
          <Text className="text-white font-semibold ml-2">
            {suggesting ? "Suggesting..." : "AI Suggest"}
          </Text>
        </TouchableOpacity>
      )}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.name}
        renderItem={({ item }) => (
          <TouchableOpacity
            className="px-4 py-3 border-b border-gray-100 bg-white flex-row justify-between items-center"
            onPress={() => handleSelect(item)}
          >
            <Text className="text-base text-gray-900 font-medium">{item.name}</Text>
            <Text className="text-xs text-gray-500">{item.unit} · {item.category}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
