import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { simplified } from '@/api/plain';
import { Txt } from '@/ui/Text';
import { space } from '@/ui/tokens';

/**
 * Texto oficial mostrado, por padrão, na versão simplificada (gerada por IA
 * uma vez e guardada). Rótulo deixa claro que é simplificado; "Ver original"
 * mostra o texto oficial como publicado. Sem versão simplificada, fica o
 * original.
 */
export function SimpleText({ text, lines }: { text: string; lines?: number }) {
  const [simple, setSimple] = useState<string | null>(null);
  const [original, setOriginal] = useState(false);

  useEffect(() => {
    let alive = true;
    void simplified(text).then((s) => alive && setSimple(s));
    return () => {
      alive = false;
    };
  }, [text]);

  if (!simple) {
    return (
      <Txt variant="body" numberOfLines={lines}>
        {text}
      </Txt>
    );
  }
  return (
    <View style={{ gap: space.xs }}>
      <Txt variant="body" numberOfLines={original ? lines : undefined}>
        {original ? text : simple}
      </Txt>
      <Txt variant="small" muted>
        {original ? 'Texto oficial, como publicado.' : 'Texto simplificado por IA a partir do oficial.'}{' '}
        <Txt variant="small" tone="primary" onPress={() => setOriginal((v) => !v)}>
          {original ? 'Ver simplificado' : 'Ver original'}
        </Txt>
      </Txt>
    </View>
  );
}
