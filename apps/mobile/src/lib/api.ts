import { createApiClient } from "@pantrymaid/shared";
import { getAuthToken } from "./auth";
import Constants from "expo-constants";

const API_URL =
  Constants.expoConfig?.extra?.apiUrl ||
  process.env.EXPO_PUBLIC_API_URL ||
  "http://localhost:3000";

export const apiClient = createApiClient({
  baseUrl: API_URL,
  getAuthToken,
});
