import { useState } from "react";
import {
  View, Text, TouchableOpacity, Modal, FlatList, TextInput,
} from "react-native";
import { COMMON_UNITS } from "@pantrymaid/shared/constants";
import { ChevronDown, X } from "lucide-react-native";

interface UnitPickerProps {
  value: string;
  onChange: (unit: string) => void;
}

export function UnitPicker({ value, onChange }: UnitPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? (COMMON_UNITS as readonly string[]).filter((u) => u.toLowerCase().includes(query.toLowerCase()))
    : (COMMON_UNITS as readonly string[]);

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        className="border border-gray-300 rounded-lg px-3 py-2 flex-row items-center justify-between bg-white"
      >
        <Text className="text-base text-gray-900">{value || "Select unit"}</Text>
        <ChevronDown color="#6b7280" size={16} />
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-gray-50">
          <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200 bg-white">
            <Text className="text-lg font-semibold text-gray-900">Select Unit</Text>
            <TouchableOpacity onPress={() => { setOpen(false); setQuery(""); }}>
              <X color="#374151" size={24} />
            </TouchableOpacity>
          </View>
          <View className="px-4 py-3 bg-white border-b border-gray-100">
            <TextInput
              placeholder="Search units..."
              value={query}
              onChangeText={setQuery}
              className="border border-gray-300 rounded-lg px-3 py-2 text-base"
            />
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                className={`px-4 py-3 border-b border-gray-100 ${value === item ? "bg-blue-50" : "bg-white"}`}
                onPress={() => { onChange(item); setOpen(false); setQuery(""); }}
              >
                <Text className={`text-base ${value === item ? "text-blue-600 font-semibold" : "text-gray-900"}`}>
                  {item}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </>
  );
}
