import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useRef } from "react";
import { initializeNotifications } from "@/utils/notificationScheduler";
import { Platform, View, ActivityIndicator, Text, StyleSheet as RNStyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppProvider } from "@/contexts/AppContext";
import { AccentProvider } from "@/contexts/AccentContext";
import Colors from "@/constants/colors";
import { trpc, trpcClient } from "@/lib/trpc";
import AchievementUnlockedModal from "@/components/AchievementUnlockedModal";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useApp } from "@/contexts/AppContext";

void SplashScreen.preventAutoHideAsync();

const GestureWrapper = Platform.OS === 'web'
  ? ({ children }: { children: React.ReactNode }) => <View style={{ flex: 1 }}>{children}</View>
  : GestureHandlerRootView;

function AchievementOverlay() {
  const { pendingAchievements, dismissAchievement } = useApp();
  const current = pendingAchievements.length > 0 ? pendingAchievements[0] : null;

  return (
    <AchievementUnlockedModal
      achievement={current}
      onDismiss={dismissAchievement}
    />
  );
}

function AuthLoadingScreen() {
  return (
    <View style={authStyles.container}>
      <Text style={authStyles.logo}>Okiri</Text>
      <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 20 }} />
    </View>
  );
}

const authStyles = RNStyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
});

function RootLayoutNav() {
  const { loading: authLoading } = useAuth();

  if (authLoading) {
    return <AuthLoadingScreen />;
  }

  return (
    <Stack 
      screenOptions={{ 
        headerShown: false,
        headerBackTitle: "Back",
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.text,
        contentStyle: { backgroundColor: Colors.background },
        animation: 'fade',
        animationDuration: 200,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="auth" options={{ headerShown: false }} />
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen 
        name="reading/[id]" 
        options={{ 
          headerShown: true,
          title: '',
          headerTransparent: true,
        }} 
      />
      <Stack.Screen 
        name="foundation/[id]" 
        options={{ 
          headerShown: true,
          title: 'Foundation',
          presentation: 'card',
        }} 
      />
      <Stack.Screen 
        name="review" 
        options={{ 
          headerShown: false,
          presentation: 'modal',
          animation: 'fade',
        }} 
      />
      <Stack.Screen 
        name="speech-session" 
        options={{ 
          headerShown: false,
          presentation: 'fullScreenModal',
        }} 
      />
      <Stack.Screen 
        name="idioms" 
        options={{ 
          headerShown: false,
          animation: 'slide_from_right',
        }} 
      />
      <Stack.Screen 
        name="idiom-practice" 
        options={{ 
          headerShown: false,
          animation: 'slide_from_right',
        }} 
      />
      <Stack.Screen 
        name="translator" 
        options={{ 
          headerShown: false,
          animation: 'slide_from_right',
        }} 
      />
      <Stack.Screen 
        name="tenses-table" 
        options={{ 
          headerShown: false,
          animation: 'slide_from_right',
        }} 
      />
      <Stack.Screen 
        name="pronunciation-practice" 
        options={{ 
          headerShown: false,
          animation: 'slide_from_right',
        }} 
      />
      <Stack.Screen 
        name="pronunciation-foundation" 
        options={{ 
          headerShown: false,
          animation: 'slide_from_right',
        }} 
      />
      <Stack.Screen 
        name="pronunciation-lesson" 
        options={{ 
          headerShown: false,
          animation: 'slide_from_right',
        }} 
      />
      <Stack.Screen 
        name="learn" 
        options={{ 
          headerShown: false,
          animation: 'slide_from_right',
        }} 
      />
      <Stack.Screen 
        name="accent-intro" 
        options={{ 
          headerShown: false,
          animation: 'slide_from_right',
        }} 
      />
      <Stack.Screen 
        name="accent-explorer" 
        options={{ 
          headerShown: false,
          animation: 'slide_from_right',
        }} 
      />
      <Stack.Screen 
        name="listen-session" 
        options={{ 
          headerShown: false,
          animation: 'slide_from_right',
        }} 
      />
      <Stack.Screen 
        name="gap-quiz" 
        options={{ 
          headerShown: false,
          animation: 'slide_from_right',
        }} 
      />
      <Stack.Screen 
        name="proficiency-test" 
        options={{ 
          headerShown: false,
          animation: 'slide_from_bottom',
        }} 
      />
      <Stack.Screen 
        name="text-session" 
        options={{ 
          headerShown: false,
          animation: 'slide_from_right',
        }} 
      />
      <Stack.Screen 
        name="srs-review" 
        options={{ 
          headerShown: false,
          animation: 'slide_from_bottom',
        }} 
      />
      <Stack.Screen 
        name="news-article" 
        options={{ 
          headerShown: false,
          animation: 'slide_from_right',
        }} 
      />
      <Stack.Screen 
        name="watch-session" 
        options={{ 
          headerShown: false,
          animation: 'slide_from_right',
        }} 
      />
      <Stack.Screen 
        name="youtube-search" 
        options={{ 
          headerShown: false,
          animation: 'slide_from_right',
        }} 
      />
      <Stack.Screen 
        name="gap-lessons" 
        options={{ 
          headerShown: false,
          animation: 'slide_from_right',
        }} 
      />
      <Stack.Screen 
        name="dynamic-lesson" 
        options={{ 
          headerShown: false,
          animation: 'slide_from_bottom',
        }} 
      />
      <Stack.Screen 
        name="gap-lesson" 
        options={{ 
          headerShown: false,
          animation: 'slide_from_right',
        }} 
      />
      <Stack.Screen 
        name="scenarios" 
        options={{ 
          headerShown: false,
          animation: 'slide_from_right',
        }} 
      />
      <Stack.Screen 
        name="tense-practice" 
        options={{ 
          headerShown: false,
          animation: 'slide_from_right',
        }} 
      />
      <Stack.Screen 
        name="recording-log" 
        options={{ 
          headerShown: false,
          animation: 'slide_from_right',
        }} 
      />
      <Stack.Screen 
        name="reading-complete" 
        options={{ 
          headerShown: false,
          animation: 'fade',
        }} 
      />
      <Stack.Screen 
        name="gap-discovery" 
        options={{ 
          headerShown: false,
          animation: 'fade',
        }} 
      />
      <Stack.Screen 
        name="profile" 
        options={{ 
          headerShown: false,
          animation: 'slide_from_right',
        }} 
      />
      <Stack.Screen 
        name="retention" 
        options={{ 
          headerShown: false,
          animation: 'slide_from_right',
        }} 
      />
      <Stack.Screen 
        name="error-patterns" 
        options={{ 
          headerShown: false,
          animation: 'slide_from_right',
        }} 
      />
      <Stack.Screen 
        name="error-pattern/[id]" 
        options={{ 
          headerShown: false,
          animation: 'slide_from_right',
        }} 
      />
      <Stack.Screen 
        name="weakness-map" 
        options={{ 
          headerShown: false,
          animation: 'slide_from_right',
        }} 
      />
      <Stack.Screen 
        name="weekly-recap" 
        options={{ 
          headerShown: false,
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }} 
      />
      <Stack.Screen 
        name="level-up" 
        options={{ 
          headerShown: false,
          presentation: 'modal',
          animation: 'fade',
        }} 
      />
      <Stack.Screen 
        name="converse" 
        options={{ 
          headerShown: false,
          animation: 'slide_from_right',
        }} 
      />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  const queryClientRef = useRef<QueryClient | null>(null);
  if (!queryClientRef.current) {
    queryClientRef.current = new QueryClient();
  }
  const queryClient = queryClientRef.current;

  useEffect(() => {
    void SplashScreen.hideAsync();
    void initializeNotifications();
  }, []);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <GestureWrapper style={{ flex: 1 }}>
          <AuthProvider>
            <AppProvider>
              <AccentProvider>
                <ErrorBoundary fallbackTitle="App crashed unexpectedly">
                  <StatusBar style="dark" />
                  <RootLayoutNav />
                  <AchievementOverlay />
                </ErrorBoundary>
              </AccentProvider>
            </AppProvider>
          </AuthProvider>
        </GestureWrapper>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
