import { Redirect, Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FLAG } from '@/api/flags';
import { useAuth } from '@/features/auth/AuthProvider';
import { color, space, type } from '@/ui';
import { IconBallot, IconChat, IconHome, IconPin, IconUser } from '@/ui/icons';

/**
 * Bottom tabs (tela 7.1). "Aberto por fora, fechado por dentro": Ações e Base
 * só existem para membro confirmado — e cada módulo ainda respeita sua
 * feature flag, para poder ser desligado sem rebuild.
 */
export default function TabsLayout() {
  const { isBaseMember, flags, profile, ready } = useAuth();
  const insets = useSafeAreaInsets();

  // Sem conta (ou admin na visão de visitante) não há abas: perfil vazio e
  // área interna não aparecem. Vai para a área pública.
  if (ready && !profile) return <Redirect href="/welcome" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.primary,
        tabBarInactiveTintColor: color.textMuted,
        // A altura padrão (49, do iOS) conta com rótulo de 10px; o nosso `label`
        // tem 12/16 e era cortado embaixo. Altura definida aqui substitui a da
        // biblioteca, então a margem do gesto/home indicator entra na conta.
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
          tabBarIcon: ({ color: c, size }) => <IconPin size={size} color={c} />,
        }}
      />
      <Tabs.Screen
        name="base"
        options={{
          title: 'Base',
          href: isBaseMember && flags[FLAG.feed] ? undefined : null,
          tabBarIcon: ({ color: c, size }) => <IconChat size={size} color={c} />,
        }}
      />
      <Tabs.Screen
        name="votar"
        options={{
          title: 'Votar',
          // Puxada desligada até liberação do advogado eleitoral (revisão de
          // 12/10): sem a flag, a aba nem aparece — e o banco recusa cadastro
          // de eleitor (0039).
          href: flags[FLAG.puxada] ? undefined : null,
          tabBarIcon: ({ color: c, size }) => <IconBallot size={size} color={c} />,
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color: c, size }) => <IconUser size={size} color={c} />,
        }}
      />
    </Tabs>
  );
}
