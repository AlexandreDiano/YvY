import { Redirect, Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FLAG } from '@/api/flags';
import { useAuth } from '@/features/auth/AuthProvider';
import { TourTarget } from '@/features/onboarding/Tour';
import { color, space, type } from '@/ui';
import { IconChat, IconHome, IconPin, IconUser } from '@/ui/icons';

/**
 * Abas de baixo. Ações e Base só aparecem para membro confirmado, e cada
 * módulo ainda obedece a própria feature flag (dá para desligar sem build novo).
 */
export default function TabsLayout() {
  const { isBaseMember, flags, profile, ready } = useAuth();
  const insets = useSafeAreaInsets();

  // Sem conta, ou admin olhando como visitante: não tem aba nenhuma, vai
  // direto para a área pública.
  if (ready && !profile) return <Redirect href="/welcome" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.primary,
        tabBarInactiveTintColor: color.textMuted,
        // A altura padrão (49, do iOS) conta com rótulo de 10px e o nosso tem 12/16,
        // então cortava embaixo. Definindo aqui, a margem do home indicator entra na conta.
        tabBarStyle: {
          backgroundColor: color.surface,
          borderTopColor: color.border,
          height: 60 + insets.bottom,
          paddingTop: space.xs,
          paddingBottom: space.xs + insets.bottom,
        },
        tabBarLabelStyle: { ...type.label, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarIcon: ({ color: c, size }) => <IconHome size={size} color={c} />,
        }}
      />
      <Tabs.Screen
        name="acoes"
        options={{
          title: 'Ações',
          href: isBaseMember && flags[FLAG.acoes] ? undefined : null,
          tabBarIcon: ({ color: c, size }) => (
            <TourTarget id="tab.acoes">
              <IconPin size={size} color={c} />
            </TourTarget>
          ),
        }}
      />
      <Tabs.Screen
        name="base"
        options={{
          title: 'Base',
          href: isBaseMember && flags[FLAG.feed] ? undefined : null,
          tabBarIcon: ({ color: c, size }) => (
            <TourTarget id="tab.base">
              <IconChat size={size} color={c} />
            </TourTarget>
          ),
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color: c, size }) => (
            <TourTarget id="tab.perfil">
              <IconUser size={size} color={c} />
            </TourTarget>
          ),
        }}
      />
    </Tabs>
  );
}
