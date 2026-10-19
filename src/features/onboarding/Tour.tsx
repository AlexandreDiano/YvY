import { useRouter } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  Animated,
  BackHandler,
  Platform,
  Easing,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type ViewProps,
} from 'react-native';
import { useAuth } from '@/features/auth/AuthProvider';
import { TOUR_MISSION, TOUR_STEPS, confirmedSteps, type TourStep } from '@/features/onboarding/steps';
import { markAwaitingConfirm, takeAwaitingConfirm, takeTutorialPending } from '@/features/onboarding/tutorial';
import { Button, Row, Txt, YvyLogo, color, radius, space } from '@/ui';
import { ScreenScrollContext, type ScreenScroll } from '@/ui/layout';

/**
 * Tour do primeiro acesso: passa pelas telas de verdade, recorta cada item
 * com um véu escuro em volta e explica para que serve. No fim, o recado de
 * por que o YvY existe. Começa sozinho depois do cadastro (marca em
 * tutorial.ts) e pelo Perfil › Sobre. Quem estava pendente ganha um tour
 * curto, só com as abas novas, quando aparece confirmado.
 *
 * Posição sai de measureInWindow, então o véu fica na raiz do app (fora de
 * Modal, que no Android edge-to-edge desloca pela barra de status).
 */

type Rect = { x: number; y: number; w: number; h: number };
type Target = { ref: RefObject<View | null>; scroll: ScreenScroll | null };

type TourApi = {
  start: () => void;
  register: (id: string, t: Target) => () => void;
  relayout: (id: string) => void;
};

const TourCtx = createContext<TourApi | null>(null);

export function useTour() {
  return useContext(TourCtx);
}

/** Embrulha o item que o tour destaca. Fora do tour não muda nada na tela. */
export function TourTarget({ id, children, style }: { id: string; children: ReactNode; style?: ViewProps['style'] }) {
  const tour = useContext(TourCtx);
  const scroll = useContext(ScreenScrollContext);
  const ref = useRef<View>(null);

  useEffect(() => tour?.register(id, { ref, scroll }), [tour, id, scroll]);

  return (
    // collapsable: sem isso o Android achata a View e a medida volta vazia
    <View ref={ref} collapsable={false} style={style} onLayout={() => tour?.relayout(id)}>
      {children}
    </View>
  );
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function measure(ref: RefObject<View | null>): Promise<Rect | null> {
  return new Promise((resolve) => {
    const node = ref.current;
    if (!node) return resolve(null);
    // no site o measureInWindow soma offsetTop e erra dentro de rolagem; a View é o próprio elemento DOM
    const dom = node as unknown as { getBoundingClientRect?: () => DOMRect };
    if (Platform.OS === 'web' && dom.getBoundingClientRect) {
      const b = dom.getBoundingClientRect();
      return resolve(b.width > 0 && b.height > 0 ? { x: b.left, y: b.top, w: b.width, h: b.height } : null);
    }
    node.measureInWindow((x, y, w, h) => resolve(w > 0 && h > 0 ? { x, y, w, h } : null));
  });
}

export function TourProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { profile, isBaseMember, membership, flags } = useAuth();
  const { width, height } = useWindowDimensions();

  const targets = useRef(new Map<string, Target>());
  const [steps, setSteps] = useState<TourStep[]>([]);
  const [idx, setIdx] = useState(-1);
  const [rect, setRect] = useState<Rect | null>(null);
  // passo cujo alvo já foi achado (o balão só aparece depois)
  const [shown, setShown] = useState(-1);
  const [rootH, setRootH] = useState(height);

  const rootRef = useRef<View>(null);
  const run = useRef(0);
  // sentido do último passo, para pular item que não está na tela
  const dir = useRef(1);
  const current = useRef<{ step: TourStep; token: number } | null>(null);

  // o roteiro depende de quem é a pessoa na hora em que o tour começa
  const who = useRef({ isBaseMember, membership, flags });
  who.current = { isBaseMember, membership, flags };

  const begin = useCallback((list: TourStep[]) => {
    setSteps(list);
    setRect(null);
    setShown(-1);
    dir.current = 1;
    setIdx(0);
  }, []);

  const start = useCallback(() => {
    const c = {
      member: who.current.isBaseMember,
      pending: who.current.membership === 'pending',
      flags: who.current.flags,
    };
    begin(TOUR_STEPS.filter((st) => !st.when || st.when(c)));
  }, [begin]);

  const go = useCallback((to: number) => {
    setIdx((cur) => {
      dir.current = to < cur ? -1 : 1;
      return to;
    });
  }, []);

  const finish = useCallback(() => {
    run.current++;
    current.current = null;
    setIdx(-1);
    setShown(-1);
    setRect(null);
    router.navigate('/(tabs)');
  }, [router]);

  // posição do alvo relativa à raiz (onde o véu é desenhado). A raiz é medida
  // junto toda vez: uma origem guardada fica velha se a página rolar.
  const place = useCallback(async (ref: RefObject<View | null>) => {
    const [r, o] = await Promise.all([measure(ref), measure(rootRef)]);
    return r ? { ...r, x: r.x - (o?.x ?? 0), y: r.y - (o?.y ?? 0) } : null;
  }, []);

  const toRect = useCallback((r: Rect, step: TourStep): Rect => {
    // ícone de aba: cresce para pegar o rótulo embaixo
    const pad = step.tab ? { x: 20, top: 6, bottom: 26 } : { x: space.sm, top: space.sm, bottom: space.sm };
    const x = Math.max(0, r.x - pad.x);
    const y = Math.max(0, r.y - pad.top);
    return { x, y, w: r.w + pad.x * 2, h: r.h + pad.top + pad.bottom };
  }, []);

  // achar o alvo: espera a tela montar, rola até ele se estiver fora da vista
  const locate = useCallback(
    async (step: TourStep, token: number) => {
      const t0 = Date.now();
      while (Date.now() - t0 < 1500) {
        if (run.current !== token) return;
        const target = targets.current.get(step.id);
        let r = target ? await place(target.ref) : null;
        if (target && r) {
          if (target.scroll && (r.y < height * 0.12 || r.y + r.h > height - 220)) {
            target.scroll.scrollBy(r.y - height * 0.22);
            // a rolagem animada não avisa quando acaba: mede até parar de mexer
            let prev = r;
            for (let k = 0; k < 12; k++) {
              await wait(k === 0 ? 300 : 100);
              r = await place(target.ref);
              if (!r || (r.y === prev.y && r.x === prev.x)) break;
              prev = r;
            }
          }
          if (run.current !== token) return;
          if (r) {
            setRect(toRect(r, step));
            setShown(idx);
            return;
          }
        }
        await wait(100);
      }
      // item não está na tela (lista vazia, sem região): sai do roteiro, para o
      // contador não pular número, e segue no mesmo sentido
      if (run.current !== token) return;
      if (idx === 0 && dir.current < 0) {
        // voltando e nem o primeiro está na tela: balão no meio, sem recorte
        setRect(null);
        setShown(idx);
        return;
      }
      setSteps((list) => list.filter((_, k) => k !== idx));
      if (dir.current < 0) setIdx(idx - 1);
    },
    [height, idx, toRect, place],
  );

  useEffect(() => {
    if (idx < 0 || idx >= steps.length) return;
    const step = steps[idx]!;
    const token = ++run.current;
    current.current = { step, token };
    setShown(-1);
    if (step.route) router.navigate(step.route);
    void locate(step, token);
  }, [idx, steps, router, locate]);

  const api = useMemo<TourApi>(
    () => ({
      start,
      register: (id, t) => {
        targets.current.set(id, t);
        return () => {
          if (targets.current.get(id) === t) targets.current.delete(id);
        };
      },
      // banner que chega depois empurra o item: acompanha sem rolar de novo
      relayout: (id) => {
        const cur = current.current;
        const t = targets.current.get(id);
        if (!cur || cur.step.id !== id || !t) return;
        void place(t.ref).then((r) => {
          if (!r || run.current !== cur.token) return;
          const next = toRect(r, cur.step);
          setRect((old) =>
            old && Math.abs(old.x - next.x) < 1 && Math.abs(old.y - next.y) < 1 && Math.abs(old.h - next.h) < 1
              ? old
              : next,
          );
        });
      },
    }),
    [start, toRect, place],
  );

  // conteúdo que carrega depois (ou a rolagem que ainda assenta) move o item
  // sem disparar o onLayout dele: confere a posição enquanto o balão está aberto
  useEffect(() => {
    if (shown < 0 || shown !== idx) return;
    const t = setInterval(() => {
      const cur = current.current;
      if (cur) api.relayout(cur.step.id);
    }, 400);
    return () => clearInterval(t);
  }, [shown, idx, api]);

  // começa sozinho no primeiro acesso depois do cadastro
  useEffect(() => {
    if (!profile?.id) return;
    let alive = true;
    void takeTutorialPending().then((pending) => {
      if (pending && alive) setTimeout(start, 600);
    });
    return () => {
      alive = false;
    };
  }, [profile?.id, start]);

  const active = idx >= 0;
  const mission = active && idx >= steps.length;

  // pendente: lembra no aparelho. Confirmado depois (com o app aberto ou não):
  // tour só das abas que abriram. Espera o tour do cadastro terminar.
  useEffect(() => {
    if (membership === 'pending') {
      void markAwaitingConfirm();
      return;
    }
    if (!isBaseMember || active) return;
    let alive = true;
    void takeAwaitingConfirm().then((was) => {
      if (!was || !alive) return;
      const list = confirmedSteps(who.current.flags);
      if (list.length > 1) setTimeout(() => begin(list), 600);
    });
    return () => {
      alive = false;
    };
  }, [membership, isBaseMember, active, begin]);

  // voltar do Android: pula para o recado final; no recado, fecha
  useEffect(() => {
    if (!active) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (mission) finish();
      else go(steps.length);
      return true;
    });
    return () => sub.remove();
  }, [active, mission, steps.length, finish, go]);

  // ---- animação ----
  const hx = useRef(new Animated.Value(0)).current;
  const hy = useRef(new Animated.Value(0)).current;
  const hw = useRef(new Animated.Value(0)).current;
  const hh = useRef(new Animated.Value(0)).current;
  const tip = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const placed = useRef(false);

  useEffect(() => {
    if (!active || mission) {
      placed.current = false;
      return;
    }
    // sem alvo, o buraco fecha no meio e o véu cobre tudo
    const to = rect ?? { x: width / 2, y: rootH / 2, w: 0, h: 0 };
    if (!placed.current) {
      hx.setValue(to.x);
      hy.setValue(to.y);
      hw.setValue(to.w);
      hh.setValue(to.h);
      placed.current = true;
      return;
    }
    const go = (v: Animated.Value, n: number) =>
      Animated.timing(v, { toValue: n, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    Animated.parallel([go(hx, to.x), go(hy, to.y), go(hw, to.w), go(hh, to.h)]).start();
  }, [rect, active, mission, width, rootH, hx, hy, hw, hh]);

  useEffect(() => {
    tip.setValue(0);
    if (!active || shown !== idx) return;
    Animated.timing(tip, {
      toValue: 1,
      duration: 260,
      delay: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [shown, idx, active, tip]);

  useEffect(() => {
    if (!active) return;
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: false }),
    );
    loop.start();
    return () => {
      loop.stop();
      pulse.setValue(0);
    };
  }, [active, pulse]);

  const step = active && !mission ? steps[idx] : undefined;
  const tipWidth = Math.min(width - space.lg * 2, 440);
  const tipLeft = (width - tipWidth) / 2;
  const tipPos = !rect
    ? { top: rootH * 0.3 }
    : rect.y + rect.h / 2 > rootH / 2
      ? { bottom: rootH - rect.y + space.md }
      : { top: rect.y + rect.h + space.md };

  return (
    <TourCtx.Provider value={api}>
      <View
        ref={rootRef}
        style={s.root}
        collapsable={false}
        onLayout={(e) => {
          setRootH(e.nativeEvent.layout.height);
        }}
      >
        {children}

        {active && !mission ? (
          <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
            <Animated.View style={[s.dim, { left: 0, right: 0, top: 0, height: hy }]} />
            <Animated.View style={[s.dim, { left: 0, right: 0, top: Animated.add(hy, hh), bottom: 0 }]} />
            <Animated.View style={[s.dim, { left: 0, top: hy, height: hh, width: hx }]} />
            <Animated.View style={[s.dim, { left: Animated.add(hx, hw), right: 0, top: hy, height: hh }]} />

            {rect ? (
              <>
                <Animated.View style={[s.ring, { left: hx, top: hy, width: hw, height: hh }]} />
                <Animated.View
                  style={[
                    s.ring,
                    {
                      left: hx,
                      top: hy,
                      width: hw,
                      height: hh,
                      opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
                      transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }],
                    },
                  ]}
                />
              </>
            ) : null}

            {step && shown === idx ? (
              <Animated.View
                accessibilityLiveRegion="polite"
                style={[
                  s.tip,
                  tipPos,
                  {
                    left: tipLeft,
                    width: tipWidth,
                    opacity: tip,
                    transform: [{ translateY: tip.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
                  },
                ]}
              >
                <Txt variant="label" muted upper>
                  {`${idx + 1} de ${steps.length}`}
                </Txt>
                <Txt variant="heading">{step.title}</Txt>
                <Txt variant="body">{step.text}</Txt>
                <Row style={s.tipActions}>
                  <Button title="Pular" kind="ghost" small block={false} onPress={() => go(steps.length)} />
                  <Row>
                    {idx > 0 ? (
                      <Button title="Voltar" kind="outline" small block={false} onPress={() => go(idx - 1)} />
                    ) : null}
                    <Button
                      title={idx === steps.length - 1 ? 'Concluir' : 'Próximo'}
                      small
                      block={false}
                      onPress={() => go(idx + 1)}
                    />
                  </Row>
                </Row>
              </Animated.View>
            ) : null}
          </View>
        ) : null}

        {mission ? <Mission onDone={finish} /> : null}
      </View>
    </TourCtx.Provider>
  );
}

function Mission({ onDone }: { onDone: () => void }) {
  const show = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(show, {
      toValue: 1,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [show]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, s.scrim, { opacity: show }]} accessibilityViewIsModal>
      <ScrollView contentContainerStyle={s.missionWrap}>
        <Animated.View
          style={[
            s.mission,
            { transform: [{ scale: show.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }] },
          ]}
        >
          <View style={s.center}>
            <YvyLogo size={72} />
          </View>
          <Txt variant="title" center>
            {TOUR_MISSION.title}
          </Txt>
          {TOUR_MISSION.intro.map((p) => (
            <Txt key={p} variant="body">
              {p}
            </Txt>
          ))}
          <Txt variant="heading">{TOUR_MISSION.ask}</Txt>
          <View style={s.rules}>
            {TOUR_MISSION.rules.map((r) => (
              <Row key={r} style={s.rule}>
                <View style={s.bullet} />
                <Txt variant="body" style={s.ruleText}>
                  {r}
                </Txt>
              </Row>
            ))}
          </View>
          <Txt variant="body" muted>
            {TOUR_MISSION.close}
          </Txt>
          <Button title={TOUR_MISSION.button} onPress={onDone} />
        </Animated.View>
      </ScrollView>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  dim: { position: 'absolute', backgroundColor: color.scrim },
  scrim: { backgroundColor: color.scrim },
  ring: {
    position: 'absolute',
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: color.accent,
  },
  tip: {
    position: 'absolute',
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.sm,
  },
  tipActions: { justifyContent: 'space-between', marginTop: space.xs },
  missionWrap: { flexGrow: 1, justifyContent: 'center', padding: space.lg },
  mission: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 440,
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    padding: space.xl,
    gap: space.md,
  },
  center: { alignItems: 'center' },
  rules: { gap: space.sm },
  rule: { alignItems: 'flex-start' },
  bullet: {
    width: space.sm,
    height: space.sm,
    borderRadius: radius.pill,
    backgroundColor: color.accent,
    marginTop: space.sm,
  },
  ruleText: { flex: 1 },
});
