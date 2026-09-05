import { router } from 'expo-router';

export function safeGoBack() {
  try {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/home' as never);
    }
  } catch {
    router.replace('/(tabs)/home' as never);
  }
}
