import { Banner, Card, Screen, Section, Txt } from '../../src/ui';

/**
 * Politica de privacidade — RASCUNHO TECNICO.
 *
 * Descreve o que o codigo de fato faz hoje. Antes do lancamento precisa de
 * revisao juridica (LGPD + legislacao eleitoral), ver secao 12 do contexto.
 */
export default function Privacidade() {
  return (
    <Screen>
      <Banner
        tone="warning"
        title="Rascunho técnico"
        detail="Este texto descreve o comportamento real do app e ainda precisa de revisão jurídica antes do lançamento."
      />

      <Section title="Sem conta, sem dado" />
      <Card>
        <Txt variant="body">
          Ler propostas e checagem não exige cadastro. Quem não tem convite não
          cria conta, e o app não guarda nada sobre essa pessoa.
        </Txt>
      </Card>

      <Section title="O que guardamos de quem tem conta" />
      <Card>
        <Txt variant="body">
          E-mail, senha (guardada com hash pelo Supabase, nunca em texto),
          apelido (ex.: "J.S."), nome completo, bairro, cidade, UF e — se você
          informar — telefone. Nada de rua e número: o endereço para no CEP, e o
          CEP só é usado para descobrir bairro, cidade e UF.
        </Txt>
      </Card>

      <Section title="Quem vê o quê" />
      <Card>
        <Txt variant="body">
          Outro membro do seu bairro vê seu apelido, seu papel e seu bairro.
          Não vê seu nome completo, telefone, e-mail nem CEP.
        </Txt>
        <Txt variant="body">
          A coordenação (moderador do bairro, admin) vê o que precisa para
          moderar e organizar — e toda ação de moderação fica registrada em log
          de auditoria.
        </Txt>
        <Txt variant="body">
          Seu nome completo, telefone e CEP são seus. Ninguém da base acessa.
        </Txt>
      </Card>

      <Section title="Cadastro de eleitor para puxada de voto" />
      <Card>
        <Txt variant="body">
          Esta é a parte mais sensível do app, e vale ler com atenção.
        </Txt>
        <Txt variant="body">
          Para levar gente à urna, o app guarda nome completo, zona, seção, local
          de votação e, se informada, uma referência de localização — podendo ser
          de alguém que nem usa o app, cadastrado por um membro.
        </Txt>
        <Txt variant="body">
          Regras: o membro só pode cadastrar quem autorizou; quem lê esse
          registro é apenas o puxador daquela rota e a administração; nada disso
          fica salvo no aparelho; e os registros de puxada são apagados depois de
          25/10/2026.
        </Txt>
        <Txt variant="body">
          Qualquer pessoa cadastrada pode pedir a exclusão imediata dos dados
          dela a qualquer momento, inclusive antes da eleição.
        </Txt>
      </Card>

      <Section title="O que não fazemos" />
      <Card>
        <Txt variant="body">Não vendemos dado. Não há rastreador de anúncio no app.</Txt>
        <Txt variant="body">
          Não guardamos localização precisa em segundo plano. A precisão da sua
          localização é escolhida por você e vem do CEP, não do GPS.
        </Txt>
        <Txt variant="body">
          O texto que você cola na checagem de fatos não é associado ao seu
          perfil. Telefone, e-mail e CPF são apagados antes de guardar. Se a
          base da equipe não cobre o assunto, o texto vai para uma fila e é
          checado por IA: a afirmação vai para uma busca na web (Tavily) e para o Gemini, do Google — no plano gratuito o Google pode usar esse texto para melhorar os produtos dele. Se você usar "Ler de um print", a imagem vai ao Gemini só para ler o texto e não é guardada. Depois da
          checagem o texto colado é apagado; fica só a afirmação neutra e o
          resultado, que outras pessoas podem ver ao checar a mesma coisa.
        </Txt>
        <Txt variant="body">
          Ideias e problemas que membros mandam à equipe vão ao Gemini só com o
          texto da mensagem (sem apelido nem outro dado do perfil), para juntar
          mensagens parecidas. Vale o mesmo aviso do plano gratuito do Google.
        </Txt>
        <Txt variant="body">
          As telas de votações e de quem foi eleito consultam direto do seu
          aparelho os sites oficiais da Câmara e do Senado (incluindo o e-Cidadania) e o Querido Diário.
          Eles recebem só o estado e a cidade consultados (e, como todo site, o
          seu IP) — nunca seu nome ou perfil. Não registramos o que você
          consulta.
        </Txt>
      </Card>

      <Section title="Seus direitos (LGPD)" />
      <Txt variant="body">
        Você pode pedir acesso, correção ou exclusão dos seus dados, e sair do
        app apagando a conta. Exclusão de conta apaga perfil, posts e
        participações; o log de auditoria guarda apenas o registro da ação, sem
        conteúdo pessoal, por 90 dias.
      </Txt>
    </Screen>
  );
}
