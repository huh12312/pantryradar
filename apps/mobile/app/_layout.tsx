import { Stack, useRouter, useSegments } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AppState, AppStateStatus } from "react-native";
import { isAuthenticated } from "../src/lib/auth";
import { initDatabase } from "../src/lib/db";
import { syncQueue, syncFromServer } from "../src/lib/sync";
import "../global.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // Initialize database
        await initDatabase();

        // Check auth status
        const authed = await isAuthenticated();
        const inAuthGroup = segments[0] === "auth";

        if (!authed && !inAuthGroup) {
          router.replace("/auth/login");
        } else if (authed && inAuthGroup) {
          router.replace("/(tabs)/pantry");
        }

        setIsReady(true);
      } catch (error) {
        console.error("Failed to prepare app:", error);
      }
    }

    prepare();
  }, [segments]);

  // Sync on app state change
  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      (nextAppState: AppStateStatus) => {
        if (nextAppState === "active") {
          syncQueue();
          syncFromServer();
        }
      }
    );

    return () => {
      subscription.remove();
    };
  }, []);

  if (!isReady) {
    return null;
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthGate>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="auth/login" options={{ title: "Login" }} />
          <Stack.Screen name="auth/register" options={{ title: "Create Household" }} />
          <Stack.Screen name="auth/join" options={{ title: "Join Household" }} />
          <Stack.Screen name="item/[id]" options={{ title: "Item Details" }} />
          <Stack.Screen name="barcode" options={{ title: "Scan Barcode" }} />
          <Stack.Screen name="receipt" options={{ title: "Scan Receipt" }} />
        </Stack>
      </AuthGate>
    </QueryClientProvider>
  );
}
