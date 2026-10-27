import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { myClaimChecks } from '@/api/claims';
import { FLAG } from '@/api/flags';
import { ElectionCard } from '@/features/plans/ElectionCard';
import { PlanCompare } from '@/features/plans/PlanCompare';
import { useAuth } from '@/features/auth/AuthProvider';
import { electionOver } from '@/lib/format';
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
} from '@/ui';
import { IconBallot, IconSearch } from '@/ui/icons';

/**
 * Área pública, sem conta nem sessão.
 *
 * É o que tem para quem não recebeu convite: planos de governo com fonte e a checagem
 * de boato, que é o material feito para circular no WhatsApp. Nada da
 * estrutura de mobilização aparece aqui.
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

  return (
    <Screen>
      <View>
        <YvyMark size={34} />
        <Txt variant="small" muted>
          Do guarani: terra
        </Txt>
      </View>

      <ElectionCard />

      {readyChecks > 0 ? (
        <Banner
          title={readyChecks === 1 ? 'Sua checagem ficou pronta' : `${readyChecks} checagens ficaram prontas`}
          detail="O resultado está na tela de checagem."
          action={<Button title="Ver resultado" small block={false} onPress={() => router.push('/checar')} />}
        />
      ) : null}

      <PlanCompare />
      <Button
        title={electionOver() ? 'Presidente eleito e plano de governo' : 'Ver propostas e planos'}
        kind="outline"
        onPress={() => router.push('/propostas')}
      />

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


