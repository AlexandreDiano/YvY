import { Redirect, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { addKeyword, listKeywords, removeKeyword } from '@/api/voteAlerts';
import { useAuth } from '@/features/auth/AuthProvider';
import { confirmAction } from '@/lib/notify';
import { Banner, Button, Card, Chip, EmptyState, Field, Loading, Row, Screen, Section, Txt } from '@/ui';

/**
 * Palavras-chave das votações em pauta (0057, só admin). A Edge Function
 * vote-alerts confere a ementa de cada projeto da pauta do Congresso contra
 * esta lista; o que bater vira aviso para a base.
 */
export default function VotacoesPauta() {
  const { isAdmin, mode } = useAuth();
  const [terms, setTerms] = useState<string[] | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setTerms(await listKeywords());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar.');
      setTerms((t) => t ?? []);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (!isAdmin) return <Redirect href="/moderar" />;
  if (mode === 'local') {
    return <EmptyState title="Precisa do servidor" detail="A pauta do Congresso e os avisos só funcionam com o Supabase ligado." />;
  }
  if (!terms) return <Loading />;

  async function add() {
    setBusy(true);
    setError(null);
    try {
      await addKeyword(draft);
      setDraft('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não deu para salvar.');
    } finally {
      setBusy(false);
    }
  }

  function remove(term: string) {
    confirmAction('Tirar da lista?', `"${term}" deixa de gerar aviso.`, 'Tirar', async () => {
      try {
        await removeKeyword(term);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Não deu para tirar.');
      }
    });
  }

  const include = terms.filter((t) => !t.startsWith('-'));
  const exclude = terms.filter((t) => t.startsWith('-'));

  return (
    <Screen>
      <Txt variant="small" muted>
        De 3 em 3 horas o app lê a pauta do Plenário da Câmara e do Senado dos próximos 7 dias. Projeto (PL, PEC, MP e
        afins) cuja ementa tenha uma palavra daqui vira aviso para todos os membros que não desligaram "Votações em pauta"
        no Perfil, chamando para votar na consulta pública (e-Cidadania no Senado, enquete na Câmara) antes da sessão.
        Fora isso, o aviso só traz o que a fonte oficial publica: número, ementa, data e link.
      </Txt>
      <Card>
        <Txt variant="small" muted>
          Sem acento nem maiúscula. A palavra vale inteira: "sus" não pega "suspensão". Com * no fim vale o começo:
          "aposentad*" pega aposentadoria e aposentados. Com - na frente, cancela: "-vara do trabalho" impede o aviso de
          criação de vara.
        </Txt>
        <Field
          label="Nova palavra ou expressão"
          value={draft}
          onChangeText={setDraft}
          maxLength={60}
          autoCapitalize="none"
          placeholder="ex.: reforma agraria"
          onSubmitEditing={() => void add()}
          returnKeyType="done"
        />
        <Button title="Incluir" small block={false} loading={busy} disabled={!draft.trim()} onPress={() => void add()} />
      </Card>
      {error ? <Banner tone="danger" title={error} /> : null}

      <Section title={`Avisam (${include.length})`} />
      {include.length === 0 ? (
        <Txt variant="small" muted>
          Lista vazia: nenhum aviso sai.
        </Txt>
      ) : (
        <Row style={{ flexWrap: 'wrap' }}>
          {include.map((t) => (
            <Chip key={t} label={`${t}  ×`} onPress={() => remove(t)} />
          ))}
        </Row>
      )}

      <Section title={`Cancelam (${exclude.length})`} />
      <Row style={{ flexWrap: 'wrap' }}>
        {exclude.map((t) => (
          <Chip key={t} label={`${t}  ×`} onPress={() => remove(t)} />
        ))}
      </Row>
    </Screen>
  );
}
