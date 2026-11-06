import type { Bancada, Legislatura } from '@/data/bancadas';

/**
 * Regras da tela Bancadas (YVY-124): soma por partido, maiorias, cor fixa de
 * cada partido e o desenho do plenário em meia-lua.
 */
export type Casa = 'camara' | 'senado';
export type PartySeats = { party: string; seats: number };

/** Soma as cadeiras de cada partido, de todo o Brasil ou de uma UF, da maior para a menor. */
export function seatsByParty(b: Bancada, uf: string | null = null): PartySeats[] {
  const total = new Map<string, number>();
  for (const [u, parties] of Object.entries(b)) {
    if (uf && u !== uf) continue;
    for (const [p, n] of Object.entries(parties)) total.set(p, (total.get(p) ?? 0) + n);
  }
  return [...total.entries()]
    .map(([party, seats]) => ({ party, seats }))
    .sort((a, b) => b.seats - a.seats || a.party.localeCompare(b.party));
}

/** Maioria absoluta (lei complementar) e 3/5 (emenda à Constituição) de uma casa com n cadeiras. */
export function thresholds(n: number): { majority: number; amendment: number } {
  return { majority: Math.floor(n / 2) + 1, amendment: Math.ceil((3 * n) / 5) };
}

export const TOP_COLORED = 6;

/**
 * Cor de cada partido, a mesma em todos os anos: cada partido que chegou entre
 * os 6 maiores de alguma casa em alguma legislatura ganha uma das `slots`
 * cores, e dois partidos que estiveram juntos nesse grupo nunca dividem cor
 * (coloração gulosa de grafo). Quem não cabe fica sem cor (cinza na tela).
 */
export function partyColorSlots(legs: Legislatura[], slots = 8): Map<string, number> {
  const groups: string[][] = [];
  for (const l of legs) {
    for (const b of [l.camara, l.senado]) {
      if (b) groups.push(seatsByParty(b).slice(0, TOP_COLORED).map((x) => x.party));
    }
  }
  const adj = new Map<string, Set<string>>();
  for (const g of groups) {
    for (const p of g) {
      const s = adj.get(p) ?? new Set<string>();
      for (const q of g) if (q !== p) s.add(q);
      adj.set(p, s);
    }
  }
  // DSatur: colore primeiro quem tem mais cores diferentes entre os vizinhos
  const slot = new Map<string, number>();
  const usedBy = (p: string) => new Set([...adj.get(p)!].map((q) => slot.get(q)).filter((x) => x !== undefined));
  const left = new Set(adj.keys());
  while (left.size) {
    const p = [...left].sort(
      (a, b) => usedBy(b).size - usedBy(a).size || adj.get(b)!.size - adj.get(a)!.size || a.localeCompare(b),
    )[0]!;
    left.delete(p);
    const used = usedBy(p);
    for (let i = 0; i < slots; i++) {
      if (!used.has(i)) {
        slot.set(p, i);
        break;
      }
    }
  }
  return slot;
}

export type Seat = { x: number; y: number };

/**
 * Plenário em meia-lua com n cadeiras: fileiras do raio 0,4 ao 1, cada uma
 * com cadeiras na proporção do comprimento. O número de fileiras é o que deixa
 * a distância entre cadeiras mais parecida com a distância entre fileiras.
 * Devolve as posições (centro em 0,0; y para cima) da esquerda para a
 * direita, e o raio de cada ponto.
 */
export function hemicycle(n: number): { seats: Seat[]; dot: number } {
  if (n <= 0) return { seats: [], dot: 0 };
  const inner = 0.4;
  let best: { rows: number[]; radii: number[]; score: number } | null = null;
  for (let k = 1; k <= 20; k++) {
    const radii = Array.from({ length: k }, (_, i) => (k === 1 ? 1 : inner + ((1 - inner) * i) / (k - 1)));
    const sum = radii.reduce((a, r) => a + r, 0);
    const rows = radii.map((r) => Math.max(1, Math.round((n * r) / sum)));
    rows[k - 1]! += n - rows.reduce((a, x) => a + x, 0);
    if (rows[k - 1]! < 1) continue;
    const gap = k === 1 ? 1 : (1 - inner) / (k - 1);
    const spacing = (Math.PI * radii[k - 1]!) / Math.max(1, rows[k - 1]! - 1);
    const score = Math.abs(Math.log(spacing / gap));
    if (!best || score < best.score) best = { rows, radii, score };
  }
  const { rows, radii } = best!;
  const all: (Seat & { a: number; r: number })[] = [];
  rows.forEach((m, i) => {
    const r = radii[i]!;
    for (let j = 0; j < m; j++) {
      const a = m === 1 ? Math.PI / 2 : Math.PI - (j * Math.PI) / (m - 1);
      all.push({ x: r * Math.cos(a), y: r * Math.sin(a), a, r });
    }
  });
  // da esquerda para a direita; no mesmo ângulo, de dentro para fora
  all.sort((p, q) => q.a - p.a || p.r - q.r);
  let min = Infinity;
  rows.forEach((m, i) => {
    if (m > 1) min = Math.min(min, (Math.PI * radii[i]!) / (m - 1));
  });
  if (rows.length > 1) min = Math.min(min, (1 - inner) / (rows.length - 1));
  return { seats: all.map(({ x, y }) => ({ x, y })), dot: (Number.isFinite(min) ? min : 0.1) * 0.42 };
}

/** Partido de cada cadeira, na ordem do desenho: cada partido num bloco seguido. */
export function assignSeats(parties: PartySeats[]): string[] {
  return parties.flatMap((p) => Array<string>(p.seats).fill(p.party));
}
