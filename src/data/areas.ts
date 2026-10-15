/** Áreas dos cards, na ordem em que aparecem. */
export const AREAS = [
  { key: 'trabalho', label: 'Trabalho' },
  { key: 'saude', label: 'Saúde' },
  { key: 'educacao', label: 'Educação' },
  { key: 'judiciario', label: 'Judiciário' },
  { key: 'economia', label: 'Economia' },
  { key: 'meio_ambiente', label: 'Meio Ambiente' },
] as const;

export type AreaKey = (typeof AREAS)[number]['key'];

export function areaLabel(key: string): string {
  return AREAS.find((a) => a.key === key)?.label ?? key;
}
