import { View, Text, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';

export default function IndexScreen() {
  const { user, isLoading } = useApp();
  const { isAuthenticated, loading: authLoading } = useAuth();

  if (isLoading || authLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.logo}>Okiri</Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/auth" />;
  }

  if (user) {
    return <Redirect href="/(tabs)/home" />;
  }

  return <Redirect href="/welcome" />;
}

const styles = StyleSheet.create({
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
