import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
  useRouter,
} from "expo-router";
import { StatusBar } from "expo-status-bar";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import {
  SafeAreaInsetsContext,
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "@/features/auth/AuthProvider";
import { BiometricLockProvider } from "@/features/auth/BiometricLock";
import { Txt, color, isDark, space, type } from "@/ui";
import { OfflineBanner } from "@/ui/OfflineBanner";

/** Tema da navegação com as cores do Yvy (claro ou escuro, ver src/ui/theme.ts). */
const NAV_THEME = {
  ...(isDark ? DarkTheme : DefaultTheme),
  colors: {
    ...(isDark ? DarkTheme : DefaultTheme).colors,
    primary: color.primary,
    background: color.bg,
    card: color.surface,
    text: color.text,
    border: color.border,
    notification: color.accent,
  },
};

export default function RootLayout() {
  return (
    <ThemeProvider value={NAV_THEME}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style={isDark ? "light" : "dark"} />
          <OfflineBanner />
          <BiometricLockProvider>
          <VisitorViewFrame>
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: color.bg },
                headerShadowVisible: false,
                headerTintColor: color.primary,
                headerTitleStyle: { ...type.heading, color: color.text },
                headerBackTitle: "Voltar",
                contentStyle: { backgroundColor: color.bg },
              }}
            >
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="welcome" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="publico" options={{ title: "YvY" }} />
              <Stack.Screen name="entrar" options={{ title: "Entrar" }} />
              <Stack.Screen
                name="senha"
                options={{ title: "Recuperar senha" }}
              />
              <Stack.Screen
                name="cadastro/convite"
                options={{ title: "Entrar com convite" }}
              />
              <Stack.Screen
                name="cadastro/militante"
                options={{ title: "Cadastro" }}
              />
              <Stack.Screen
                name="propostas/index"
                options={{ title: "Propostas" }}
              />
              <Stack.Screen name="propostas/[id]" options={{ title: "" }} />
              <Stack.Screen
                name="checar"
                options={{ title: "Checar fake news" }}
              />
              <Stack.Screen name="congresso" options={{ title: "Congresso" }} />
              <Stack.Screen
                name="representantes"
                options={{ title: "Quem foi eleito" }}
              />
              <Stack.Screen
                name="votacao/[id]"
                options={{ title: "Votação" }}
              />
              <Stack.Screen name="avisos" options={{ title: "Avisos" }} />
              <Stack.Screen
                name="plano/[sq]"
                options={{ title: "Plano de governo" }}
              />
              <Stack.Screen
                name="feedback"
                options={{ title: "Ideias e problemas" }}
              />
              <Stack.Screen
                name="membros"
                options={{ title: "Membros e papéis" }}
              />
              <Stack.Screen
                name="acoes/nova"
                options={{ title: "Nova ação" }}
              />
              <Stack.Screen name="acoes/[id]" options={{ title: "Ação" }} />
              <Stack.Screen
                name="convidar"
                options={{ title: "Convidar camarada" }}
              />
              <Stack.Screen
                name="moderar"
                options={{ title: "Moderação do bairro" }}
              />
              <Stack.Screen
                name="rotas"
                options={{ title: "Rotas de puxada" }}
              />
              <Stack.Screen
                name="sobre/privacidade"
                options={{ title: "Privacidade" }}
              />
              <Stack.Screen
                name="sobre/termos"
                options={{ title: "Termos de uso" }}
              />
              <Stack.Screen
                name="sobre/quem-somos"
                options={{ title: "Quem somos" }}
              />
            </Stack>
          </VisitorViewFrame>
          </BiometricLockProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

/**
 * Enquanto o admin vê o app como visitante, uma faixa EMBAIXO leva de volta à
 * conta. Embaixo porque visitante não tem barra de abas, e porque no topo o
 * cabeçalho nativo do Android somava a altura da barra de status de novo
 * (espaço grande entre a faixa e o título). As telas recebem inset de baixo
 * zero: a faixa já ocupa a área segura. A árvore é a mesma nos dois modos
 * para não remontar a navegação.
 */
function VisitorViewFrame({ children }: { children: ReactNode }) {
  const { visitorView, setVisitorView } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <SafeAreaInsetsContext.Provider
        value={visitorView ? { ...insets, bottom: 0 } : insets}
      >
        <View style={{ flex: 1 }}>{children}</View>
      </SafeAreaInsetsContext.Provider>
      {visitorView ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setVisitorView(false);
            router.replace("/");
          }}
          style={({ pressed }) => [
            s.bar,
            { paddingBottom: insets.bottom + space.sm },
            pressed && { opacity: 0.8 },
          ]}
        >
          <Txt variant="small" tone="onPrimary" center>
            Vendo como visitante · toque aqui para voltar à sua conta
          </Txt>
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    paddingTop: space.sm,
    paddingHorizontal: space.lg,
    backgroundColor: color.accent,
  },
});
