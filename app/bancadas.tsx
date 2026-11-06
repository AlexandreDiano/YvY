import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { LEGISLATURAS } from '@/data/bancadas';
import {
  TOP_COLORED,
  assignSeats,
  hemicycle,
  partyColorSlots,
  seatsByParty,
  thresholds,
  type Casa,
} from '@/features/bancadas/seats';
import { Card, Chip, EmptyState, Row, Screen, Txt, color, radius, space } from '@/ui';

const CASA_LABEL: Record<Casa, string> = { camara: 'Câmara', senado: 'Senado' };
const SLOTS = partyColorSlots(LEGISLATURAS);

/**
 * Partidos no Congresso (YVY-124): quantas cadeiras cada partido ganhou na
 * Câmara e no Senado em cada eleição desde 1994, no Brasil ou por UF, dos
 * dados abertos do TSE (src/data/bancadas.ts, gerado por
 * scripts/gen-bancadas.py). Área pública, sem conta e sem servidor.
 *
 * A tabela é o principal: 513 pontos num celular são pequenos para tocar. O
 * desenho mostra a proporção, e tocar num partido (na tabela ou no desenho)
 * destaca as cadeiras dele.
 */
export default function Bancadas() {
  // largura medida no próprio cartão: na página estática a janela ainda não tem tamanho
  const [width, setWidth] = useState(0);
  const [casa, setCasa] = useState<Casa>('camara');
  const [ano, setAno] = useState(LEGISLATURAS[LEGISLATURAS.length - 1]!.legislatura);
  const [uf, setUf] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);

  const leg = LEGISLATURAS.find((l) => l.legislatura === ano)!;
  const bancada = leg[casa];
  const ufs = useMemo(() => Object.keys(leg.camara).sort(), [leg]);
  const parties = useMemo(() => (bancada ? seatsByParty(bancada, uf) : []), [bancada, uf]);
  const total = parties.reduce((a, p) => a + p.seats, 0);
  const max = parties[0]?.seats ?? 1;
  // cor fixa do partido, só para os maiores deste ano (os outros ficam em cinza)
  const colored = new Set(parties.slice(0, TOP_COLORED).map((p) => p.party));
  const colorOf = (party: string) => {
    const s = SLOTS.get(party);
    return s !== undefined && colored.has(party) ? color.seats[s]! : color.neutral;
  };

  const chart = useMemo(() => hemicycle(total), [total]);
  const owners = useMemo(() => assignSeats(parties), [parties]);
  const limits = thresholds(total);
  const size = Math.min(width, 560);
  // margem do tamanho da bolinha, senão as das pontas saem cortadas
  const box = { pad: chart.dot + 0.02, w: 2 + 2 * (chart.dot + 0.02), h: 1 + 2 * (chart.dot + 0.02) };

  function pick(party: string) {
    setFocus((f) => (f === party ? null : party));
  }

  return (
    <Screen>
      <Txt variant="small" muted>
        Quantas cadeiras cada partido ganhou na eleição, de {LEGISLATURAS[0]!.eleicao} a{' '}
        {LEGISLATURAS[LEGISLATURAS.length - 1]!.eleicao}. Escolha o ano em que a legislatura começa.
      </Txt>

      <Row>
        {(['camara', 'senado'] as Casa[]).map((c) => (
          <Chip key={c} label={CASA_LABEL[c]} active={casa === c} onPress={() => setCasa(c)} />
        ))}
      </Row>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
        {[...LEGISLATURAS].reverse().map((l) => (
          <Chip
            key={l.legislatura}
            label={String(l.legislatura)}
            active={ano === l.legislatura}
            onPress={() => {
              setAno(l.legislatura);
              setFocus(null);
            }}
          />
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
        <Chip label="Brasil" active={uf === null} onPress={() => setUf(null)} />
        {ufs.map((u) => (
          <Chip key={u} label={u} active={uf === u} onPress={() => setUf(u)} />
        ))}
      </ScrollView>

      {!bancada ? (
        <EmptyState
          title="Sem dado aberto"
          detail={`O Senado de ${leg.legislatura} juntava eleitos de 1990 e 1994, e o TSE não publica a eleição de 1990 em dados abertos.`}
        />
      ) : (
        <>
          <Card>
            <Txt variant="heading">
              {CASA_LABEL[casa]} {leg.legislatura}
              {uf ? ` · ${uf}` : ''}
            </Txt>
            <Txt variant="small" muted>
              {total} {total === 1 ? 'cadeira' : 'cadeiras'} de {parties.length}{' '}
              {parties.length === 1 ? 'partido' : 'partidos'}, eleitas em {leg.eleicao}
              {casa === 'senado' ? ` e ${leg.eleicao - 4}` : ''}.
            </Txt>
            <View style={{ alignItems: 'center' }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
              {size > 0 ? (
                <Svg
                  width={size}
                  height={size * box.h / box.w}
                  viewBox={`${-box.w / 2} ${-1 - box.pad} ${box.w} ${box.h}`}
                  accessibilityLabel={`Desenho do plenário: ${parties
                    .slice(0, 5)
                    .map((p) => `${p.party} ${p.seats}`)
                    .join(', ')}`}
                >
                  {chart.seats.map((p, i) => {
                    const party = owners[i]!;
                    return (
                      <Circle
                        key={i}
                        cx={p.x}
                        cy={-p.y}
                        r={chart.dot}
                        fill={colorOf(party)}
                        opacity={focus && focus !== party ? 0.18 : 1}
                        onPress={() => pick(party)}
                      />
                    );
                  })}
                </Svg>
              ) : null}
            </View>
            {uf ? null : (
              <Txt variant="small" muted>
                Maioria absoluta: {limits.majority} votos (lei complementar). Mudar a Constituição: {limits.amendment}{' '}
                (3 de cada 5).
              </Txt>
            )}
          </Card>

          <Card>
            {parties.map((p) => {
              const on = focus === p.party;
              return (
                <Pressable
                  key={p.party}
                  onPress={() => pick(p.party)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${p.party}, ${p.seats} cadeiras`}
                  style={[s.row, on && { backgroundColor: color.primarySoft }]}
                >
                  <View style={[s.swatch, { backgroundColor: colorOf(p.party) }]} />
                  <Txt variant="body" style={s.party} numberOfLines={1}>
                    {p.party}
                  </Txt>
                  <View style={s.track}>
                    <View style={[s.bar, { width: `${(p.seats / max) * 100}%`, backgroundColor: colorOf(p.party) }]} />
                  </View>
                  <Txt variant="body" style={s.num}>
                    {p.seats}
                  </Txt>
                  <Txt variant="small" muted style={s.pct}>
                    {((p.seats / total) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
                  </Txt>
                </Pressable>
              );
            })}
          </Card>
        </>
      )}

      <Txt variant="small" muted>
        O lado do desenho não quer dizer direita ou esquerda: os partidos vão do maior para o menor. Os{' '}
        {TOP_COLORED} maiores de cada ano têm cor, e cada partido tem a mesma cor em todos os anos. Vale o partido
        do dia da eleição, com o nome da época (PFL, DEM e UNIÃO aparecem separados). Não entram suplentes que
        assumiram, trocas de partido nem cassações depois da eleição.
      </Txt>
      <Txt variant="small" muted>
        Fonte: TSE, dados abertos (candidatos eleitos, consulta_cand), eleições de 1994 a 2026.
      </Txt>
    </Screen>
  );
}

const s = StyleSheet.create({
  chips: { gap: space.sm, paddingVertical: space.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.xs,
    paddingHorizontal: space.xs,
    borderRadius: radius.sm,
  },
  swatch: { width: 12, height: 12, borderRadius: 6 },
  party: { width: 116 },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: color.border, overflow: 'hidden' },
  bar: { height: 8, borderRadius: 4 },
  num: { width: 36, textAlign: 'right' },
  pct: { width: 44, textAlign: 'right' },
});
