import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { Home } from "lucide-react-native";
import { setAuthToken, setUser } from "../../src/lib/auth";
import { apiClient } from "../../src/lib/api";

export default function RegisterScreen() {
  const router = useRouter();
  const [householdName, setHouseholdName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreateHousehold = async () => {
    if (!householdName.trim()) {
      Alert.alert("Error", "Please enter a household name");
      return;
    }

    setLoading(true);

    try {
      const result = await apiClient.createHousehold({ name: householdName });

      if (result.success && result.data) {
        // In a real implementation, the server would return auth tokens
        // For now, we'll simulate a successful auth
        const mockToken = "mock-auth-token";
        const mockUser = {
          id: "mock-user-id",
          email: "user@example.com",
          displayName: "User",
          householdId: result.data.id,
        };

        await setAuthToken(mockToken);
        await setUser(mockUser);

        Alert.alert(
          "Success",
          `Household "${householdName}" created successfully!`,
          [{ text: "OK", onPress: () => router.replace("/(tabs)/pantry") }]
        );
      } else {
        Alert.alert("Error", result.error || "Failed to create household");
      }
    } catch (error) {
      console.error("Failed to create household:", error);
      Alert.alert("Error", "Failed to create household. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-gray-50"
    >
      <ScrollView contentContainerClassName="flex-grow">
        <View className="flex-1 items-center justify-center p-6">
          <View className="w-full max-w-md">
            <View className="mb-8">
              <Text className="text-3xl font-bold text-gray-900 text-center mb-2">
                Create Household
              </Text>
              <Text className="text-gray-600 text-center">
                Set up a new household to start tracking your inventory
              </Text>
            </View>

            <View className="bg-white p-6 rounded-lg shadow-sm">
              <View className="mb-4">
                <Text className="text-sm text-gray-700 mb-2">
                  Household Name *
                </Text>
                <View className="flex-row items-center border border-gray-300 rounded-lg px-3 py-2">
                  <Home color="#6b7280" size={20} />
                  <TextInput
                    value={householdName}
                    onChangeText={setHouseholdName}
                    placeholder="Smith Family"
                    autoCapitalize="words"
                    className="flex-1 ml-2 text-base"
                  />
                </View>
              </View>

              <TouchableOpacity
                onPress={handleCreateHousehold}
                disabled={loading}
                className={`py-3 rounded-lg ${
                  loading ? "bg-blue-400" : "bg-blue-600"
                }`}
              >
                <Text className="text-white font-semibold text-center text-base">
                  {loading ? "Creating..." : "Create Household"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.back()}
                className="mt-4 py-3 rounded-lg border border-gray-300"
              >
                <Text className="text-gray-700 font-semibold text-center">
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
