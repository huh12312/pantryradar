import { Tabs } from "expo-router";
import { Package, Refrigerator, Snowflake, Plus } from "lucide-react-native";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#2563eb",
        tabBarInactiveTintColor: "#6b7280",
        headerShown: true,
      }}
    >
      <Tabs.Screen
        name="pantry"
        options={{
          title: "Pantry",
          tabBarIcon: ({ color, size }) => <Package color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="fridge"
        options={{
          title: "Fridge",
          tabBarIcon: ({ color, size }) => <Refrigerator color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="freezer"
        options={{
          title: "Freezer",
          tabBarIcon: ({ color, size }) => <Snowflake color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: "Add",
          tabBarIcon: ({ color, size }) => <Plus color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
