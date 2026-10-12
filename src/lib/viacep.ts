import { onlyDigits } from './format';

export type CepInfo = {
  cep: string;
  neighborhood: string;
  city: string;
  state: string;
};

/**
 * ViaCEP (fluxo 4.1/4.2 do contexto). So devolve bairro/cidade/UF — a rua
 * vem na resposta e e descartada de proposito: o app nunca guarda rua exata.
 */
export async function lookupCep(rawCep: string): Promise<CepInfo> {
  const cep = onlyDigits(rawCep);
  if (cep.length !== 8) throw new Error('CEP deve ter 8 dígitos.');

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: ctrl.signal });
    if (!res.ok) throw new Error('Não foi possível consultar o CEP agora.');
    const json = (await res.json()) as {
      erro?: boolean | string;
      bairro?: string;
      localidade?: string;
      uf?: string;
    };
    if (json.erro) throw new Error('CEP não encontrado.');
    return {
      cep,
      neighborhood: json.bairro?.trim() || 'Centro',
      city: json.localidade?.trim() ?? '',
      state: json.uf?.trim() ?? '',
    };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('CEP demorou para responder. Tente de novo.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
