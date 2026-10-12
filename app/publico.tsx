import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { myClaimChecks } from '../src/api/claims';
import { FLAG } from '../src/api/flags';
import { PlanCompare } from '../src/features/plans/PlanCompare';
import { useAuth } from '../src/features/auth/AuthProvider';
import { daysToElection, electionLabel } from '../src/lib/format';
import {
  Banner,
  Button,
  Card,
  Row,
  Screen,
  Section,
  Txt,
  YvyMark,
  color,
  space,
} from '../src/ui';
import { IconBallot, IconSearch } from '../src/ui/icons';

/**
 * Área pública — sem conta, sem sessão.
 *
 * É o que o app oferece a quem não tem convite: as propostas com fonte e a
 * checagem de boato, que é justamente o material feito para circular no
 * WhatsApp (seção 10.2). Estrutura de mobilização não aparece aqui.
 */
export default function Publico() {
  const router = useRouter();
  const { flags } = useAuth();
  const [readyChecks, setReadyChecks] = useState(0);

  useFocusEffect(
    useCallback(() => {
      void myClaimChecks().then((list) => setReadyChecks(list.filter((c) => c.unseen).length));
    }, []),
  );

  const dias = daysToElection();

  return (
    <Screen>
      <View>
        <YvyMark size={34} />
        <Txt variant="small" muted>
          Do guarani: terra
        </Txt>
      </View>

      <Card stripe={color.accent}>
        <Txt variant="heading">
          {dias > 0 ? `${dias} ${dias === 1 ? 'dia' : 'dias'} para o 2º turno` : 'Hoje é dia de votar'}
        </Txt>
        <Txt variant="small" muted>
          Votação: {electionLabel()}
        </Txt>
      </Card>

      {readyChecks > 0 ? (
        <Banner
          title={readyChecks === 1 ? 'Sua checagem ficou pronta' : `${readyChecks} checagens ficaram prontas`}
          detail="O resultado está na tela de checagem."
          action={<Button title="Ver resultado" small block={false} onPress={() => router.push('/checar')} />}
        />
      ) : null}

      <PlanCompare />
      <Button title="Ver propostas e planos" kind="outline" onPress={() => router.push('/propostas')} />

      {flags[FLAG.checagem] ? (
        <>
          <Section title="Checar fake news" />
          <Card onPress={() => router.push('/checar')}>
            <Row>
              <IconSearch size={20} color={color.primary} />
              <Txt variant="heading">Colou um print? Cheque aqui.</Txt>
            </Row>
            <Txt variant="small" muted>
              Cole o texto e veja o selo: verdade, meio verdade, exagero ou mentira — com fonte.
            </Txt>
          </Card>
        </>
      ) : null}

      {flags[FLAG.transparencia] ? (
        <>
          <Section title="De olho em quem foi eleito" />
          <Card onPress={() => router.push('/congresso')}>
            <Row>
              <IconBallot size={20} color={color.primary} />
              <Txt variant="heading">Consultas e votações no Congresso</Txt>
            </Row>
            <Txt variant="small" muted>
              Dê sua opinião nas consultas públicas do Senado e veja o que a Câmara e o Senado votaram.
            </Txt>
          </Card>
        </>
      ) : null}

      {/*<Row style={{ justifyContent: 'center' }}>*/}
      {/*  <Button title="Entrar" kind="ghost" small block={false} onPress={() => router.push('/entrar')} />*/}
      {/*  <Button*/}
      {/*    title="Tenho um convite"*/}
      {/*    kind="ghost"*/}
      {/*    small*/}
      {/*    block={false}*/}
      {/*    onPress={() => router.push('/cadastro/convite')}*/}
      {/*  />*/}
      {/*</Row>*/}
      {/*<View style={{ height: space.md }} />*/}
    </Screen>
  );
}


