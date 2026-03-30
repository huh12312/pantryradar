import { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { CameraView, Camera } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { Camera as CameraIcon, Image as ImageIcon, Check, X } from "lucide-react-native";
import type { ItemLocation, ReceiptLineItem } from "@pantrymaid/shared";
import { apiClient } from "../src/lib/api";
import { createItemOffline } from "../src/lib/sync";

export default function ReceiptScreen() {
  const router = useRouter();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [processing, setProcessing] = useState(false);
  const [receiptItems, setReceiptItems] = useState<
    Array<ReceiptLineItem & { location: ItemLocation; selected: boolean }>
  >([]);

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === "granted");
    })();
  }, []);

  const processReceiptImage = async (base64Image: string) => {
    setProcessing(true);

    try {
      const result = await apiClient.processReceipt(base64Image);

      if (result.success && result.data) {
        const items = result.data.lineItems.map((item) => ({
          ...item,
          location: "pantry" as ItemLocation,
          selected: true,
        }));
        setReceiptItems(items);
      } else {
        Alert.alert("Error", "Failed to process receipt");
      }
    } catch (error) {
      console.error("Failed to process receipt:", error);
      Alert.alert("Error", "Failed to process receipt. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  const handleTakePhoto = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: "images",
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        await processReceiptImage(result.assets[0].base64);
      }
    } catch (error) {
      console.error("Failed to take photo:", error);
      Alert.alert("Error", "Failed to take photo");
    }
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        await processReceiptImage(result.assets[0].base64);
      }
    } catch (error) {
      console.error("Failed to pick image:", error);
      Alert.alert("Error", "Failed to pick image");
    }
  };

  const handleToggleItem = (index: number) => {
    setReceiptItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const handleChangeLocation = (index: number, location: ItemLocation) => {
    setReceiptItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, location } : item))
    );
  };

  const handleConfirmAll = async () => {
    const selectedItems = receiptItems.filter((item) => item.selected);

    if (selectedItems.length === 0) {
      Alert.alert("Error", "Please select at least one item");
      return;
    }

    try {
      for (const item of selectedItems) {
        await createItemOffline({
          name: item.decoded,
          location: item.location,
          quantity: item.quantity || 1,
        });
      }

      Alert.alert("Success", `Added ${selectedItems.length} items successfully`, [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error("Failed to add items:", error);
      Alert.alert("Error", "Failed to add items");
    }
  };

  if (hasPermission === null) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <Text>Requesting camera permission...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 p-6">
        <Text className="text-center mb-4 text-gray-700">
          Camera permission is required to scan receipts
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

  if (processing) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#2563eb" />
        <Text className="mt-4 text-gray-700 text-lg">Processing receipt...</Text>
        <Text className="mt-2 text-gray-500 text-sm text-center px-6">
          This may take a moment
        </Text>
      </View>
    );
  }

  if (receiptItems.length > 0) {
    return (
      <View className="flex-1 bg-gray-50">
        <ScrollView className="flex-1">
          <View className="p-4">
            <View className="bg-white p-6 rounded-lg shadow-sm mb-4">
              <Text className="text-xl font-bold text-gray-900 mb-2">
                Review Items
              </Text>
              <Text className="text-sm text-gray-600">
                Select items to add and choose their location
              </Text>
            </View>

            {receiptItems.map((item, index) => (
              <View
                key={index}
                className={`bg-white p-4 rounded-lg shadow-sm mb-3 ${
                  !item.selected ? "opacity-50" : ""
                }`}
              >
                <View className="flex-row items-start mb-3">
                  <TouchableOpacity
                    onPress={() => handleToggleItem(index)}
                    className={`w-6 h-6 rounded border-2 mr-3 items-center justify-center ${
                      item.selected ? "bg-blue-600 border-blue-600" : "border-gray-300"
                    }`}
                  >
                    {item.selected && <Check color="#ffffff" size={16} />}
                  </TouchableOpacity>

                  <View className="flex-1">
                    <Text className="text-base font-semibold text-gray-900">
                      {item.decoded}
                    </Text>
                    {item.raw !== item.decoded && (
                      <Text className="text-sm text-gray-500 mt-1">
                        Raw: {item.raw}
                      </Text>
                    )}
                    {item.quantity && (
                      <Text className="text-sm text-gray-600 mt-1">
                        Qty: {item.quantity}
                      </Text>
                    )}
                  </View>
                </View>

                {item.selected && (
                  <View>
                    <Text className="text-sm text-gray-700 mb-2">Location:</Text>
                    <View className="flex-row gap-2">
                      {(["pantry", "fridge", "freezer"] as ItemLocation[]).map(
                        (loc) => (
                          <TouchableOpacity
                            key={loc}
                            onPress={() => handleChangeLocation(index, loc)}
                            className={`flex-1 py-2 px-2 rounded-lg border ${
                              item.location === loc
                                ? "bg-blue-600 border-blue-600"
                                : "bg-white border-gray-300"
                            }`}
                          >
                            <Text
                              className={`text-center capitalize text-xs ${
                                item.location === loc
                                  ? "text-white font-semibold"
                                  : "text-gray-700"
                              }`}
                            >
                              {loc}
                            </Text>
                          </TouchableOpacity>
                        )
                      )}
                    </View>
                  </View>
                )}
              </View>
            ))}
          </View>
        </ScrollView>

        <View className="p-4 bg-white border-t border-gray-200">
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={() => setReceiptItems([])}
              className="flex-1 py-3 rounded-lg border border-gray-300"
            >
              <Text className="text-gray-700 font-semibold text-center">
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleConfirmAll}
              className="flex-1 bg-blue-600 py-3 rounded-lg"
            >
              <Text className="text-white font-semibold text-center">
                Add Selected
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <View className="flex-1 items-center justify-center p-6">
        <Text className="text-2xl font-bold text-gray-900 mb-2 text-center">
          Scan Receipt
        </Text>
        <Text className="text-gray-600 text-center mb-8">
          Take a photo of your receipt or select one from your gallery
        </Text>

        <View className="w-full max-w-xs gap-4">
          <TouchableOpacity
            onPress={handleTakePhoto}
            className="bg-blue-600 py-4 rounded-lg flex-row items-center justify-center"
          >
            <CameraIcon color="#ffffff" size={24} />
            <Text className="text-white font-semibold text-base ml-2">
              Take Photo
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handlePickImage}
            className="bg-green-600 py-4 rounded-lg flex-row items-center justify-center"
          >
            <ImageIcon color="#ffffff" size={24} />
            <Text className="text-white font-semibold text-base ml-2">
              Choose from Gallery
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.back()}
            className="py-3 rounded-lg border border-gray-300"
          >
            <Text className="text-gray-700 font-semibold text-center">Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
