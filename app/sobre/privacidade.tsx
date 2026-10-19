import { RESPONSAVEL } from '@/data/responsavel';
import { Banner, Card, Screen, Section, Txt } from '@/ui';

/**
 * Política de privacidade, ainda rascunho técnico. Descreve o que o código faz
 * hoje e precisa passar pelo jurídico (LGPD e lei eleitoral) antes do lançamento.
 */
export default function Privacidade() {
  return (
    <Screen>
      <Banner
        tone="warning"
        title="Rascunho técnico"
        detail="Este texto descreve o comportamento real do app e ainda precisa de revisão jurídica antes do lançamento."
      />

      <Section title="Quem cuida dos dados" />
      <Card>
        <Txt variant="body">
          Controlador: {RESPONSAVEL.nome}. Pedidos sobre dados pessoais — acesso, correção, exclusão, retirada de
          consentimento — vão para {RESPONSAVEL.email}.
        </Txt>
      </Card>

      <Section title="Dado sensível: participação política" />
      <Card>
        <Txt variant="body">
          Fazer parte da base revela opinião política, que a LGPD trata como dado sensível. Por isso o cadastro
          pede um consentimento separado e explícito só para isso, além do aceite dos termos. Ele pode ser
          retirado a qualquer momento pelo e-mail acima, e a conta é apagada.
        </Txt>
      </Card>

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
          moderar e organizar. Moderador e admin também veem quem convidou quem,
          pelo apelido.
        </Txt>
        <Txt variant="body">
          Seu nome completo, telefone e CEP são seus. Ninguém da base acessa.
        </Txt>
      </Card>

      <Section title="Registro de atividade" />
      <Card>
        <Txt variant="body">
          Para a segurança de quem participa e para responder a pedido da Justiça, o app registra o que cada
          conta faz: entrar e sair, e criar, mudar ou apagar qualquer coisa (post, ação, presença, convite,
          dado do perfil). O registro guarda o que foi feito, quando, de qual IP e aparelho, e uma cópia do
          conteúdo. No caso de uma mudança, guarda o antes e o depois.
        </Txt>
        <Txt variant="body">
          Só o admin consegue ler esse registro. Ele é apagado sozinho depois de 6 meses, mesmo que você tenha
          apagado a conta antes. Não registramos o que você só lê, nem o texto colado na checagem de fatos.
        </Txt>
      </Card>

      <Section title="Avisos por e-mail" />
      <Card>
        <Txt variant="body">
          Se "Avisos por e-mail" estiver ligado no Perfil, os avisos do app vão para o seu e-mail pelo
          Resend, serviço de envio de e-mail (servidores nos EUA), que recebe só o seu endereço e o aviso. O e-mail leva só o aviso, com apelidos e bairros, como na tela. Dá
          para desligar no Perfil a qualquer hora.
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
          resultado. Esse resultado aparece só para quem pediu a checagem. Ele
          só fica público depois que alguém da equipe confere a fonte e valida.
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
        <Txt variant="body">
          Para barrar robôs, as telas de criar conta, entrar e recuperar senha
          usam a verificação "não sou robô" da Cloudflare (Turnstile). Ela
          analisa sinais técnicos do aparelho e do navegador naquele momento;
          não recebe seu e-mail, senha nem dado do perfil.
        </Txt>
        <Txt variant="body">
          Quando o app dá erro, um relatório técnico vai para o Sentry, para a
          equipe consertar. Ele não leva seu nome, e-mail, telefone, CEP, IP
          nem imagem da tela — esses dados são retirados antes do envio.
        </Txt>
      </Card>

      <Section title="Seus direitos (LGPD)" />
      <Txt variant="body">
        Você pode pedir acesso, correção ou exclusão dos seus dados, e sair do
        app apagando a conta. Exclusão de conta apaga perfil, posts e
        participações do app. O registro de atividade (veja acima) continua por
        até 6 meses a partir de cada ação e depois é apagado.
      </Txt>
    </Screen>
  );
}
