import { Linking } from 'react-native';
import { env } from '@/lib/env';
import { Button, Card, Screen, Section, Txt } from '@/ui';

export default function QuemSomos() {
  return (
    <Screen>
      <Txt variant="display">YvY</Txt>
      <Txt variant="small" muted>
        Do guarani: terra. Raiz de yvyra (árvore) e de Yvy Marãe'ỹ (Terra Grande).
      </Txt>

      <Section title="O que é" />
      <Txt variant="body">
        Ferramenta de organização de base. Serve para quem participa encontrar
        outras pessoas do próprio bairro, marcar ação, conversar com quem está do lado
        e levar gente para votar. Fora disso, traz o que os candidatos disseram,
        com fonte, e uma base de checagem de boato.
      </Txt>

      <Section title="Como se entra" />
      <Card>
        <Txt variant="body">
          Sem convite: você lê as propostas e a checagem de fatos sem criar
          conta nenhuma. Não pedimos nome, telefone nem e-mail para isso.
        </Txt>
        <Txt variant="body">
          Com convite: um membro mostra o QRCode dele presencialmente, você
          escaneia e só então cria sua conta, com seu e-mail e sua senha. Quem
          convidou confirma a entrada em até 24h.
        </Txt>
        <Txt variant="body">
          A conta é sempre sua, e você aceita os termos no seu próprio cadastro.
          O QRCode não cadastra ninguém: ele só libera a permissão.
        </Txt>
      </Card>

      <Section title="Por que não tem link de convite" />
      <Txt variant="body">
        Código de texto vaza: basta um print. QRCode presencial exige as duas
        pessoas no mesmo lugar, vale um uso e expira em 2 minutos. A base cresce pelo
        encontro, não pela timeline.
      </Txt>

      <Section title="Código aberto" />
      <Txt variant="body">
        O código é público. Transparência derruba o argumento de que isto é
        propaganda paga: qualquer pessoa pode ler o que o app faz com os dados.
      </Txt>
      <Button title="Ver no GitHub" kind="outline" onPress={() => void Linking.openURL(env.repoUrl)} />

      <Txt variant="small" muted>
        A terra é de quem a organiza.
      </Txt>
    </Screen>
  );
}
