import { Banner, Card, Screen, Section, Txt } from '@/ui';

/** Termos de uso. Rascunho técnico, falta revisão jurídica. */
export default function Termos() {
  return (
    <Screen>
      <Banner
        tone="warning"
        title="Rascunho técnico"
        detail="Precisa de revisão jurídica (LGPD e legislação eleitoral) antes do lançamento."
      />

      <Section title="O que é o YvY" />
      <Txt variant="body">
        Ferramenta de organização de base: encontrar pessoas do mesmo bairro,
        marcar ação local, conversar no feed do bairro e consultar propostas e checagem de fatos com fonte citada.
      </Txt>

      <Section title="Conta" />
      <Txt variant="body">
        Propostas e checagem são abertas e não pedem cadastro. A conta do YvY só
        existe depois de um convite presencial por QRCode: você cria a sua, com
        seu e-mail e sua senha, e aceita estes termos no seu próprio cadastro.
        Conta é pessoal e intransferível — e a senha também.
      </Txt>

      <Section title="Regras de convivência" />
      <Card>
        <Txt variant="body">
          No feed do bairro: sem ofensa, sem provocação, sem boato sem fonte, sem
          spam. Moderador do bairro aprova ou remove, e você é avisado do motivo.
        </Txt>
        <Txt variant="body">
          Não publique dado pessoal de outra pessoa — nem o seu endereço
          completo. O app foi feito para funcionar sem isso.
        </Txt>
        <Txt variant="body">
          Convite é presencial. Publicar o código de convite em grupo ou rede
          social é descumprir estes termos.
        </Txt>
      </Card>

      <Section title="Suspensão" />
      <Txt variant="body">
        A coordenação pode desativar conta que ameace a segurança da base —
        vazamento de convite, assédio, publicação de dado de terceiro. Conteúdo
        já criado permanece no histórico de moderação.
      </Txt>

      <Section title="Sem garantia de serviço" />
      <Txt variant="body">
        O app é software livre mantido por voluntariado, oferecido como está. Para
        o dia da votação, a coordenação mantém plano alternativo fora do app.
      </Txt>
    </Screen>
  );
}
