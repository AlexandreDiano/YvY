import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import type { TextInput } from 'react-native';
import {
  DELETE_WORD,
  areaChanged,
  cepChanged,
  emailProblem,
  isDeleteConfirmed,
  passwordProblem,
} from '@/features/account/rules';
import { useAuth } from '@/features/auth/AuthProvider';
import { useCaptcha } from '@/features/auth/useCaptcha';
import { formatCep } from '@/lib/format';
import { confirmAction, notify } from '@/lib/notify';
import { lookupCep } from '@/lib/viacep';
import { Banner, Button, Card, Field, Screen, Section, Txt, color } from '@/ui';

/**
 * Minha conta (YVY-137): e-mail, senha, dados do cadastro e apagar a conta,
 * tudo pela própria pessoa, sem pedir a ninguém.
 *
 * Nome completo pode mudar: é dado da própria pessoa, ninguém da base vê, e
 * corrigir é direito dela (LGPD art. 18, III). Papel, situação do cadastro e
 * conta ativa não mudam daqui (sem grant de UPDATE, 0006).
 */
export default function Conta() {
  const router = useRouter();
  const { profile, mode, account, isModerator, updateProfile, changeEmail, changePassword, deleteAccount } =
    useAuth();
  const backend = mode === 'backend';

  // e-mail
  const [email, setEmail] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMsg, setEmailMsg] = useState<string | null>(null);
  const [emailErr, setEmailErr] = useState<string | null>(null);

  // senha
  const captcha = useCaptcha();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwErr, setPwErr] = useState<string | null>(null);
  const nextRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  // cadastro
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [cep, setCep] = useState(formatCep(profile?.cep ?? ''));
  const [dataBusy, setDataBusy] = useState(false);
  const [dataErr, setDataErr] = useState<string | null>(null);

  // apagar
  const [typed, setTyped] = useState('');
  const [delBusy, setDelBusy] = useState(false);
  const [delErr, setDelErr] = useState<string | null>(null);

  if (!profile) return null;

  async function saveEmail() {
    const problem = emailProblem(account.email, email);
    if (problem) return setEmailErr(problem);
    setEmailErr(null);
    setEmailMsg(null);
    setEmailBusy(true);
    try {
      const result = await changeEmail(email);
      setEmail('');
      setEmailMsg(
        result === 'changed'
          ? 'E-mail trocado. Use o novo para entrar.'
          : 'Mandamos um link de confirmação para o endereço novo (olhe também o spam). Pode chegar outro no endereço atual: abra os dois. Até confirmar, você continua entrando com o e-mail atual.',
      );
    } catch (err) {
      setEmailErr(err instanceof Error ? err.message : 'Não foi possível trocar o e-mail.');
    } finally {
      setEmailBusy(false);
    }
  }

  async function savePassword() {
    const problem = passwordProblem(current, next, confirm);
    if (problem) return setPwErr(problem);
    if (!captcha.ready) return;
    setPwErr(null);
    setPwBusy(true);
    try {
      await changePassword(current, next, captcha.token);
      setCurrent('');
      setNext('');
      setConfirm('');
      notify('Senha trocada', 'Na próxima vez que entrar, use a senha nova.');
    } catch (err) {
      setPwErr(err instanceof Error ? err.message : 'Não foi possível trocar a senha.');
    } finally {
      setPwBusy(false);
      captcha.reset();
    }
  }

  async function saveData() {
    const name = fullName.trim();
    if (name.length < 3) return setDataErr('Digite o nome completo.');
    setDataErr(null);
    setDataBusy(true);
    try {
      const patch: { full_name: string; cep?: string; neighborhood?: string; city?: string; state?: string } = {
        full_name: name,
      };
      let moved = false;
      if (cepChanged(profile!.cep, cep)) {
        // CEP novo recalcula bairro, cidade e UF; a rua da ViaCEP é descartada lá
        const info = await lookupCep(cep);
        Object.assign(patch, info);
        moved = areaChanged(profile!, info);
      }
      const apply = async () => {
        try {
          await updateProfile(patch);
          notify(
            'Salvo',
            moved ? `Seu bairro agora é ${patch.neighborhood}, ${patch.city}/${patch.state}.` : 'Seus dados foram atualizados.',
          );
        } catch (err) {
          setDataErr(err instanceof Error ? err.message : 'Falha ao salvar.');
        }
      };
      if (moved) {
        confirmAction(
          'Mudar de bairro?',
          `O CEP novo é de ${patch.neighborhood}, ${patch.city}/${patch.state}. O seu feed, as ações e a moderação que você vê passam a ser de lá.` +
            (isModerator ? ' Sua moderação continua no bairro antigo até o admin mudar.' : ''),
          'Mudar',
          () => void apply(),
        );
      } else {
        await apply();
      }
    } catch (err) {
      setDataErr(err instanceof Error ? err.message : 'Falha ao salvar.');
    } finally {
      setDataBusy(false);
    }
  }

  function askDelete() {
    if (!isDeleteConfirmed(typed)) return setDelErr(`Digite ${DELETE_WORD} para confirmar.`);
    setDelErr(null);
    // segunda confirmação: a caixa do sistema, depois da palavra digitada
    confirmAction(
      'Apagar a conta de vez?',
      'Não dá para desfazer. Para voltar ao YvY depois, só com convite novo.',
      'Apagar',
      () => void runDelete(),
      true,
    );
  }

  async function runDelete() {
    setDelBusy(true);
    try {
      await deleteAccount(typed);
      notify('Conta apagada', 'Seus dados saíram do YvY. Obrigado por ter feito parte.');
      router.replace('/welcome');
    } catch (err) {
      setDelErr(err instanceof Error ? err.message : 'Não foi possível apagar a conta.');
      setDelBusy(false);
    }
  }

  return (
    <Screen>
      {backend ? (
        <>
          <Section title="E-mail" />
          <Card>
            <Txt variant="small" muted>
              E-mail atual: {account.email ?? '—'}
            </Txt>
            {account.newEmail ? (
              <Txt variant="small" tone="primary">
                Esperando confirmar: {account.newEmail}
              </Txt>
            ) : null}
            <Field
              label="E-mail novo"
              value={email}
              onChangeText={(v) => {
                setEmail(v);
                setEmailErr(null);
              }}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="voce@exemplo.com"
              error={emailErr}
              hint="O e-mail atual continua valendo até você abrir o link de confirmação."
              returnKeyType="send"
              onSubmitEditing={() => void saveEmail()}
            />
            <Button title="Trocar e-mail" loading={emailBusy} disabled={!email.trim()} onPress={() => void saveEmail()} />
            {emailMsg ? <Txt variant="small">{emailMsg}</Txt> : null}
          </Card>

          <Section title="Senha" />
          <Card>
            <Field
              label="Senha atual"
              value={current}
              onChangeText={setCurrent}
              secureTextEntry
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => nextRef.current?.focus()}
            />
            <Field
              ref={nextRef}
              label="Senha nova"
              value={next}
              onChangeText={setNext}
              secureTextEntry
              hint="Pelo menos 8 caracteres."
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => confirmRef.current?.focus()}
            />
            <Field
              ref={confirmRef}
              label="Repita a senha nova"
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
              returnKeyType="go"
              onSubmitEditing={() => void savePassword()}
            />
            {captcha.widget}
            <Button
              title="Trocar senha"
              loading={pwBusy}
              disabled={!current || !next || !captcha.ready}
              onPress={() => void savePassword()}
            />
            {pwErr ? (
              <Txt variant="small" tone="danger">
                {pwErr}
              </Txt>
            ) : null}
            <Button
              title="Esqueci a senha atual"
              kind="ghost"
              small
              onPress={() => router.push({ pathname: '/senha', params: { email: account.email ?? '' } })}
            />
          </Card>
        </>
      ) : null}

      <Section title="Dados do cadastro" />
      <Card>
        <Txt variant="small" muted>
          Ninguém da base vê seu nome completo nem seu CEP. Apelido e telefone ficam no Perfil.
        </Txt>
        <Field label="Nome completo" value={fullName} onChangeText={setFullName} autoCapitalize="words" maxLength={120} />
        <Field
          label="CEP"
          value={cep}
          onChangeText={(v) => setCep(formatCep(v))}
          keyboardType="number-pad"
          maxLength={9}
          hint={`Hoje: ${profile.neighborhood ?? '—'}, ${profile.city ?? ''}/${profile.state ?? ''}. CEP de outro bairro muda o seu feed e a moderação.`}
        />
        <Button title="Salvar" loading={dataBusy} onPress={() => void saveData()} />
        {dataErr ? (
          <Txt variant="small" tone="danger">
            {dataErr}
          </Txt>
        ) : null}
      </Card>

      <Section title="Apagar minha conta" />
      <Card stripe={color.danger}>
        <Txt variant="body">
          Sai do YvY: perfil, posts, presenças, ações que você criou (quem ia é avisado), convites, contatos e
          conversas guardadas neste aparelho.
        </Txt>
        <Txt variant="small" muted>
          O registro da exclusão não leva nome completo, telefone, e-mail nem CEP. O que já estava no registro de
          atividade (cadastro e mudanças de dados) segue até completar 6 meses e depois é apagado. Denúncia em que
          você aparece segue a regra da denúncia. Detalhes em Privacidade.
        </Txt>
        {backend && profile.role === 'admin' ? (
          <Banner tone="warning" title="Conta de admin" detail="Admin não apaga a conta pelo app. Peça a outro admin." />
        ) : (
          <>
            <Field
              label={`Digite ${DELETE_WORD} para confirmar`}
              value={typed}
              onChangeText={(v) => {
                setTyped(v);
                setDelErr(null);
              }}
              autoCapitalize="characters"
              autoCorrect={false}
              error={delErr}
            />
            <Button
              title="Apagar minha conta"
              kind="outline"
              loading={delBusy}
              disabled={!isDeleteConfirmed(typed)}
              onPress={askDelete}
            />
          </>
        )}
      </Card>

      {!backend ? (
        <Txt variant="small" muted center>
          Modo local: e-mail e senha só existem com servidor.
        </Txt>
      ) : null}
      <Button title="Privacidade" kind="ghost" small onPress={() => router.push('/sobre/privacidade')} />
    </Screen>
  );
}
