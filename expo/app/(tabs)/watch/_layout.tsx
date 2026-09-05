import { Stack } from "expo-router";
import Colors from "@/constants/colors";
import ErrorBoundary from "@/components/ErrorBoundary";

export default function WatchLayout() {
  return (
    <ErrorBoundary fallbackLabel="Watch">
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.background },
        }}
      />
    </ErrorBoundary>
  );
}
