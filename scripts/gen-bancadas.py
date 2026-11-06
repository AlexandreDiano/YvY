#!/usr/bin/env python3
"""
Gera src/data/bancadas.ts: quantas cadeiras cada partido ganhou na Câmara e no
Senado em cada eleição, por UF, dos dados abertos do TSE (consulta_cand).

    for a in 1994 1998 2002 2006 2010 2014 2018 2022 2026; do
      curl -o /tmp/tse/consulta_cand_$a.zip \\
        https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_$a.zip
    done
    python3 -I scripts/gen-bancadas.py /tmp/tse > src/data/bancadas.ts

É o resultado da eleição, com o partido do dia da eleição. Não entram
suplentes que assumiram, troca de partido depois nem cassação. Partido que
mudou de nome (PFL, DEM, UNIÃO) fica com o nome de cada época: juntar seria
decisão editorial.

Senado: a legislatura junta os eleitos de duas eleições (1/3 e 2/3). O TSE
não tem o arquivo de 1990, então a série do Senado começa na legislatura de
1999.

O script para (exit 1) se a conta não fechar: 513 na Câmara, a mesma
bancada por UF todo ano, 81 no Senado com 3 por UF.
"""
import csv
import io
import json
import os
import sys
import zipfile
from collections import Counter, defaultdict

ANOS = list(range(1994, 2027, 4))
# rótulo de "eleito" muda de ano para ano ("MÉDIA" em 1998, "ELEITO POR QP" desde 2014)
ELEITO = {"ELEITO", "ELEITO POR QP", "ELEITO POR MÉDIA", "MÉDIA"}


def falha(msg: str) -> None:
    print(f"gen-bancadas: {msg}", file=sys.stderr)
    sys.exit(1)


def le(pasta: str, ano: int) -> tuple[dict, dict, str]:
    z = zipfile.ZipFile(os.path.join(pasta, f"consulta_cand_{ano}.zip"))
    nome = next(n for n in z.namelist() if n.endswith("_BRASIL.csv"))
    cam: dict[str, Counter] = defaultdict(Counter)
    sen: dict[str, Counter] = defaultdict(Counter)
    gerado = ""
    with z.open(nome) as fh:
        for r in csv.DictReader(io.TextIOWrapper(fh, encoding="latin-1"), delimiter=";"):
            gerado = r["DT_GERACAO"]
            cargo = r["DS_CARGO"].upper()
            if cargo not in ("DEPUTADO FEDERAL", "SENADOR") or r["DS_SIT_TOT_TURNO"] not in ELEITO:
                continue
            # vaga de quem renunciou ou morreu aparece de novo com o substituto (1998: PR e ES)
            sit = r["DS_SITUACAO_CANDIDATURA"].upper()
            if r["NM_URNA_CANDIDATO"].startswith("#NULO") or "RENÚNCIA" in sit or "FALECIDO" in sit:
                continue
            (cam if cargo == "DEPUTADO FEDERAL" else sen)[r["SG_UF"]][r["SG_PARTIDO"]] += 1
    return cam, sen, gerado


def total(d: dict) -> int:
    return sum(sum(c.values()) for c in d.values())


def main() -> None:
    pasta = sys.argv[1]
    cam, sen, gerado = {}, {}, {}
    for a in ANOS:
        cam[a], sen[a], gerado[a] = le(pasta, a)

    por_uf = {uf: sum(c.values()) for uf, c in cam[ANOS[-1]].items()}
    for a in ANOS:
        if total(cam[a]) != 513:
            falha(f"Câmara {a}: {total(cam[a])} cadeiras, esperado 513")
        dif = {uf: sum(c.values()) for uf, c in cam[a].items() if sum(c.values()) != por_uf.get(uf)}
        if dif:
            falha(f"Câmara {a}: bancada por UF diferente de {ANOS[-1]}: {dif}")

    saida = []
    for i, a in enumerate(ANOS):
        senado = None
        if i > 0:
            junto: dict[str, Counter] = defaultdict(Counter)
            for d in (sen[a], sen[ANOS[i - 1]]):
                for uf, c in d.items():
                    junto[uf].update(c)
            ruins = {uf: sum(c.values()) for uf, c in junto.items() if sum(c.values()) != 3}
            if total(junto) != 81 or len(junto) != 27 or ruins:
                falha(f"Senado {a + 1}: {total(junto)} cadeiras, UFs fora de 3: {ruins}")
            senado = {uf: dict(sorted(c.items())) for uf, c in sorted(junto.items())}
        saida.append({
            "legislatura": a + 1,
            "eleicao": a,
            "camara": {uf: dict(sorted(c.items())) for uf, c in sorted(cam[a].items())},
            "senado": senado,
        })

    datas = ", ".join(f"{a}: {gerado[a]}" for a in ANOS)
    print("// Gerado por scripts/gen-bancadas.py. Não editar à mão.")
    print("// Fonte: TSE, dados abertos, consulta_cand (candidatos eleitos), arquivos gerados em")
    print(f"// {datas}.")
    print("// Partido do dia da eleição; sem suplentes, trocas de partido nem cassações depois dela.")
    print("")
    print("export type Bancada = Record<string, Record<string, number>>; // UF → partido → cadeiras")
    print("export type Legislatura = {")
    print("  /** Ano em que a legislatura começa (1º de fevereiro). */")
    print("  legislatura: number;")
    print("  eleicao: number;")
    print("  camara: Bancada;")
    print("  /** null: o TSE não tem o arquivo da eleição anterior (1990). */")
    print("  senado: Bancada | null;")
    print("};")
    print("")
    print("export const LEGISLATURAS: Legislatura[] = " + json.dumps(saida, ensure_ascii=False, indent=2) + ";")


if __name__ == "__main__":
    main()
