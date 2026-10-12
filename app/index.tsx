import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { useAuth } from '@/features/auth/AuthProvider';
import { Loading, color } from '@/ui';

/** Porteiro: manda para o onboarding ou para as abas. */
export default function Index() {
  const { ready, profile } = useAuth();

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: color.bg, justifyContent: 'center' }}>
        <Loading />
      </View>
    );
  }
  return profile ? <Redirect href="/(tabs)" /> : <Redirect href="/welcome" />;
}
