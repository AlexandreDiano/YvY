# YVY

*Do guarani: terra.*

App de organização de base: militante encontra militante no próprio bairro,
marca ação local, conversa com quem está do lado e organiza puxada de voto.
Também traz o que os candidatos disseram, com fonte citada, e uma base de
checagem de boato.

> **A terra é de quem a organiza.**

Documento de contexto do projeto: [`docs/CONTEXT.md`](docs/CONTEXT.md).

## Como se entra

Duas portas, e só duas:

- **Sem convite:** propostas e checagem de fatos, sem conta e sem sessão. O app
  não guarda nada de quem só lê.
- **Com convite:** um militante mostra o QRCode presencialmente; quem escaneia
  cria a própria conta (e-mail + senha), aceita os termos e entra como militante
  *pendente* até o convidador confirmar, em até 24h.

Não existe cadastro avulso: sem QRCode válido, a RPC `redeem_invite` recusa e
nenhum perfil é criado — não há policy de INSERT em `profiles` para cliente.

## Rodar agora (sem backend)

```bash
npm install
npm start          # depois: w (web), a (Android)
```

Sem `.env`, o app entra em **modo local**: propostas e checagem funcionam (o
conteúdo está no bundle), e perfil, ações, feed e puxada ficam salvos só no
aparelho. Qualquer código na tela de convite é aceito nesse modo — serve para
navegar todas as telas antes de existir Supabase.

## Rodar com backend

1. Criar projeto em [supabase.com](https://supabase.com).
2. No **SQL Editor**, rodar em ordem:
   - `supabase/migrations/0001_extensions.sql` … `0011_trigger_grants.sql`
     (`0010_cron.sql` liga o pg_cron e agenda as rotinas de tempo)
   - `supabase/seed/0001_feature_flags.sql` … `0003_fact_checks.sql`
3. **Authentication › Providers**: habilitar *Email* (e-mail + senha). Em
   *Email › Confirm email*, **desligar** a confirmação: o convite expira em 24h
   e o cadastro precisa terminar na hora, com o camarada ainda do lado.
   *Anonymous sign-ins* fica desligado — o app não usa.
4. **Storage**: o bucket privado `post-images` é criado pela migration
   `0008_storage.sql`, junto com as policies de upload e leitura.
5. Copiar `.env.example` para `.env` e preencher `EXPO_PUBLIC_SUPABASE_URL` e
   `EXPO_PUBLIC_SUPABASE_ANON_KEY` (Project Settings › API).
6. `npm start`.

### Primeiro admin

Perfil só nasce por convite, e convite só sai de militante confirmado — então o
primeiro perfil entra pelo SQL Editor:

1. **Authentication › Users › Add user**: e-mail + senha, com *Auto Confirm User*.
2. No SQL Editor (bairro e cidade precisam bater com os da base: as policies de
   área comparam esse texto):

```sql
insert into profiles (id, role, membership_status, display_name, email,
                      neighborhood, city, state, terms_accepted_at)
select id, 'admin', 'active', 'Camarada X.Y.', email,
       'Bairro', 'Cidade', 'UF', now()
  from auth.users where email = 'admin@exemplo.org';
```

Daí em diante a base cresce por QRCode. Para promover alguém que já tem perfil:

```sql
update profiles set role = 'admin', membership_status = 'active'
 where email = 'pessoa@exemplo.org';
```

## Scripts

| Comando | O que faz |
|---|---|
| `npm start` | Servidor de desenvolvimento do Expo |
| `npm run android` / `web` | Abre direto na plataforma |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test:rls` | Testa as policies contra um projeto Supabase de teste |
| `node --experimental-strip-types scripts/gen-seed-sql.mjs` | Regera os seeds de conteúdo |
| `python3 scripts/gen-icons.py` | Regera ícone, splash, favicon e adaptive icon a partir de `assets/yvy-logo.png` |

## Como está organizado

```
app/                  rotas (expo-router)
  (tabs)/             Início · Ações · Base · Votar · Perfil
  cadastro/           visitante, leitura de QRCode, cadastro de militante
  propostas/ acoes/   listas e detalhes
  sobre/              quem somos, privacidade, termos
src/ui/               tokens, componentes, ícones SVG, marca (YvyLogo)
src/api/              acesso a dados (Supabase ou modo local)
src/data/             conteúdo editorial (fonte única dos seeds)
src/features/auth/    sessão e papéis
src/lib/              supabase, cache, formato, ViaCEP, tipos do banco
supabase/migrations/  schema, funções, views, RLS, retenção
supabase/tests/       teste das policies
```

## Papéis

Papéis são `militant`, `moderator` e `admin`. Quem não tem convite não tem
papel: não tem conta. (`visitor` segue no enum do banco para contas rejeitadas,
mas não é mais uma porta de entrada.)

`role` e `membership_status` **não** podem ser alterados pelo cliente: o
`authenticated` não tem privilégio de UPDATE nessas colunas. Papel muda só por
RPC `SECURITY DEFINER` (`redeem_invite`, `decide_invitee`) ou pelo SQL Editor —
senão qualquer sessão anônima se promoveria a admin com a anon key do bundle.

## Segurança, em uma linha

O app embute a chave anônima do Supabase: qualquer pessoa pode extraí-la. O que
separa conteúdo público de estrutura de mobilização são as policies de
`supabase/migrations/0006_rls.sql`. Mudou policy, roda `npm run test:rls`.

## Dados pessoais

- Quem não tem conta não deixa dado nenhum: o conteúdo público é lido pelo
  papel `anon`, que tem select apenas em `proposal_cards`, `fact_checks` e
  `feature_flags`.
- O que circula entre militantes é apelido e bairro. Nome completo, telefone,
  e-mail e CEP ficam só com a pessoa (e com a administração).
- Endereço do cadastro para no CEP (bairro/cidade/UF; a rua da ViaCEP é descartada). Exceção: na puxada, o campo opcional `address_hint` guarda uma referência livre ("prédio azul em frente à padaria") digitada por quem cadastra.
- A tabela `voters` (puxada de voto) guarda nome e local de votação de pessoas
  que podem não usar o app. Ela é lida apenas pelo puxador da rota e pela
  administração, não vai para cache em disco, e é expurgada depois da votação:
  `select * from public.purge_pull_data();`

## Licença

A definir — ver seção 12 de `docs/CONTEXT.md` (recomendação do documento: MIT).
