// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'android/*', 'ios/*', 'public/*', 'supabase/functions/*', '.expo/*'],
  },
  {
    files: ['app/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}', 'tests/**/*.ts'],
    rules: {
      // Texto em português cheio de aspas; o JSX renderiza certo.
      'react/no-unescaped-entities': 'off',
      // Animated.Value em useRef é o padrão do React Native, não leitura de ref.
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['./*', '../*'], message: 'Use o alias @/ (src/*).' },
            { group: ['@expo/vector-icons', '@expo/vector-icons/*'], message: 'Ícone é SVG próprio (@/ui/icons): fonte de ícone pesa ~1 MB.' },
            { group: ['nativewind', 'react-native-css-interop'], message: 'Estilo é StyleSheet + tokens (@/ui/tokens).' },
          ],
        },
      ],
      // Cor de interface só como token, nas duas paletas (claro e escuro).
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]',
          message: 'Cor solta: crie um token em src/ui/tokens.ts (nas duas paletas).',
        },
      ],
    },
  },
  {
    // Onde hex é a fonte (tokens, marca) ou exceção documentada: QRCode sempre
    // escuro em fundo branco, fundo preto de câmera/foto, canvas da foto
    // reduzida, meta tags do HTML estático.
    files: [
      'src/ui/tokens.ts',
      'src/ui/YvyLogo.tsx',
      'app/+html.tsx',
      'app/cadastro/convite.tsx',
      'app/convidar.tsx',
      'app/conversas/adicionar.tsx',
      'src/features/pwa/InstallCard.tsx',
      'src/features/support/SupportCard.tsx',
      'src/lib/shrinkImage.web.ts',
      'src/ui/PostImage.tsx',
      'src/ui/PostImage.web.tsx',
    ],
    rules: { 'no-restricted-syntax': 'off' },
  },
]);
