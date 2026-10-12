import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { formatCep, formatPhone, suggestDisplayName } from '@/lib/format';
import { lookupCep, type CepInfo } from '@/lib/viacep';
import {
  Banner,
  Button,
  Field,
  Options,
  Row,
  Screen,
  Section,
  Toggle,
  Txt,
  space,
} from '@/ui';
import type { SignUpInput } from '@/features/auth/AuthProvider';
import { useCaptcha } from '@/features/auth/useCaptcha';

/**
 * Cadastro de membro (fluxo 4.2, passo 7).
 *
 * Só se chega aqui com um convite válido já lido — o QRCode é o portão. Quem
 * não tem convite não cria conta: lê o conteúdo público e pronto.
 *
 * Anonimato (seção 5.2): o nome completo fica com a pessoa e com a
 * coordenação; o que circula na base é o apelido. A rua nunca é pedida — o
 * endereço para no CEP, que vira só bairro/cidade/UF.
 */

const PRECISION = [
  { key: '4', label: 'Cidade', detail: 'Menos preciso, mais anônimo' },
  { key: '3', label: 'Bairro', detail: 'Padrão recomendado' },
  { key: '2', label: 'Quadra', detail: 'Facilita encontrar ações a pé' },
  { key: '1', label: 'Rua', detail: 'Só ative se confiar na sua base' },
] as const;

const MIN_PASSWORD = 8;

export function SignupForm({
  inviterName,
  onSubmit,
}: {
  inviterName?: string;
  onSubmit: (input: SignUpInput) => Promise<void>;
}) {
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [phone, setPhone] = useState('');
  const [cep, setCep] = useState('');
  const [place, setPlace] = useState<CepInfo | null>(null);
  const [precision, setPrecision] = useState<'1' | '2' | '3' | '4'>('3');
  const [terms, setTerms] = useState(false);
  const [sensitive, setSensitive] = useState(false);
  const [cepBusy, setCepBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const captcha = useCaptcha();

  async function resolveCep(value: string) {
    setCep(formatCep(value));
    const digits = value.replace(/\D+/g, '');
    if (digits.length !== 8) {
      setPlace(null);
      return;
    }
    setCepBusy(true);
    setError(null);
    try {
      setPlace(await lookupCep(digits));
    } catch (err) {
      setPlace(null);
      setError(err instanceof Error ? err.message : 'Falha ao consultar o CEP.');
    } finally {
      setCepBusy(false);
    }
  }

  function onNameBlur() {
    if (!displayName && fullName.trim()) setDisplayName(suggestDisplayName(fullName));
  }

  async function submit() {
    setError(null);
    if (fullName.trim().length < 3) {
      setError('Informe seu nome completo. Ele fica com você e com a coordenação.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Informe um e-mail válido — é com ele que você entra de novo.');
      return;
    }
    if (password.length < MIN_PASSWORD) {
      setError(`A senha precisa de pelo menos ${MIN_PASSWORD} caracteres.`);
      return;
    }
    if (password !== password2) {
      setError('As duas senhas não são iguais.');
      return;
    }
    if (!place) {
      setError('Informe um CEP válido para descobrir seu bairro.');
      return;
    }
    if (!sensitive) {
      setError('Sem o consentimento para o dado de participação política não dá para entrar na base.');
      return;
    }
    if (!terms) {
      setError('É preciso aceitar os termos e a política de privacidade.');
      return;
    }

    setBusy(true);
    try {
      await onSubmit({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        displayName: displayName.trim() || undefined,
        phone: phone.replace(/\D+/g, '') || undefined,
        cep: place.cep,
        neighborhood: place.neighborhood,
        city: place.city,
        state: place.state,
        locationPrecision: Number(precision),
        acceptedTerms: true,
        sensitiveConsent: true,
        captchaToken: captcha.token,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível concluir o cadastro.');
    } finally {
      setBusy(false);
      // Token do captcha vale uma vez: gera outro para a próxima tentativa.
      captcha.reset();
    }
  }

  return (
    <Screen>
      <Banner
        title={inviterName ? `Convite de ${inviterName}` : 'Convite validado'}
        detail="Depois do cadastro, quem gerou o QRCode confirma sua entrada. Até lá você vê só o conteúdo público."
      />

      <Section title="Sua conta" />
      <Field
        label="E-mail"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="voce@exemplo.com"
        hint="É assim que você entra de novo se trocar de celular."
      />
      <Field
        label="Senha"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder={`Mínimo de ${MIN_PASSWORD} caracteres`}
      />
      <Field label="Repita a senha" value={password2} onChangeText={setPassword2} secureTextEntry />

      <Section title="Seus dados" />
      <Field
        label="Nome completo"
        value={fullName}
        onChangeText={setFullName}
        onBlur={onNameBlur}
        autoCapitalize="words"
        placeholder="Como está no documento"
        hint="Visível só para você e para a coordenação do bairro."
      />
      <Field
        label="Apelido no app"
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="J.S."
        maxLength={12}
        hint="É assim que a base te vê: Camarada J.S. Nunca o nome completo."
      />
      <Field
        label="Telefone (opcional)"
        value={phone}
        onChangeText={(v) => setPhone(formatPhone(v))}
        keyboardType="phone-pad"
        placeholder="(11) 90000-0000"
      />

      <Section title="Onde você organiza" />
      <Field
        label="CEP"
        value={cep}
        onChangeText={resolveCep}
        keyboardType="number-pad"
        placeholder="00000-000"
        maxLength={9}
        hint={cepBusy ? 'Consultando...' : 'Só guardamos bairro, cidade e UF. Nunca a rua.'}
      />
      {place ? (
        <Row>
          <Txt variant="body" tone="primary">
            {place.neighborhood} · {place.city}/{place.state}
          </Txt>
        </Row>
      ) : null}
      <Options
        label="Precisão da sua localização"
        value={precision}
        options={PRECISION.map((p) => ({ ...p }))}
        onChange={setPrecision}
      />

      <Section title="Termos" />
      {/* Separado dos termos, de propósito: dado sensível (LGPD, art. 11)
          exige consentimento específico e destacado, não um aceite genérico. */}
      <Toggle
        value={sensitive}
        onChange={setSensitive}
        label="Consinto que o YvY trate o dado de que participo de um grupo de organização política"
        detail="Participar da base revela opinião política, que a lei trata como dado sensível. O uso é só para o funcionamento do app (sua conta, seu bairro, as ações). Você pode retirar este consentimento e apagar a conta quando quiser, pelo e-mail na Política de Privacidade."
      />
      <Toggle
        value={terms}
        onChange={setTerms}
        label="Aceito os termos de uso e a política de privacidade"
        detail="Resumo: seus dados ficam com você. A base vê seu apelido e seu bairro — nunca nome completo, e-mail, telefone ou rua."
      />
      <Row>
        <Button title="Ler termos" kind="ghost" small block={false} onPress={() => router.push('/sobre/termos')} />
        <Button
          title="Ler privacidade"
          kind="ghost"
          small
          block={false}
          onPress={() => router.push('/sobre/privacidade')}
        />
      </Row>

      {error ? (
        <Txt variant="small" tone="danger">
          {error}
        </Txt>
      ) : null}

      <View style={{ height: space.sm }} />
      {/* Logo acima do botão: o token vence em ~5 min, e o formulário é longo. */}
      {captcha.widget}
      <Button title="Criar conta" onPress={submit} loading={busy} disabled={!captcha.ready} />
    </Screen>
  );
}
