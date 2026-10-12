/** Areas editoriais dos cards (fluxo 4.7). Ordem fixa de exibicao. */
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
