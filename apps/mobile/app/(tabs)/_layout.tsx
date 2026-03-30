import { Tabs } from "expo-router";

export default function TabLayout() {
  return (
    <Tabs>
      <Tabs.Screen
        name="pantry"
        options={{
          title: "Pantry",
          headerShown: true,
        }}
      />
      <Tabs.Screen
        name="fridge"
        options={{
          title: "Fridge",
          headerShown: true,
        }}
      />
      <Tabs.Screen
        name="freezer"
        options={{
          title: "Freezer",
          headerShown: true,
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: "Add Item",
          headerShown: true,
        }}
      />
    </Tabs>
  );
}
