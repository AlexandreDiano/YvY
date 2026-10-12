#!/usr/bin/env python3
"""
Eleitos de 2026 a partir dos dados abertos do TSE.

    curl -o /tmp/votacao_2026.zip \
      https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_candidato_munzona/votacao_candidato_munzona_2026.zip
    python3 scripts/import-tse-elected.py /tmp/votacao_2026.zip > supabase/seed/0004_elected_2026.sql

Lê o arquivo nacional (votação por município/zona), soma os votos de cada
candidatura e fica só com quem foi eleito ou foi ao 2º turno. Rodar de novo
depois do 2º turno (25/10) e quando o TSE atualizar o arquivo.

Só dado público de candidatura (nome de urna, partido, cargo, UF, votos).
"""
import csv
import io
import json
import sys
import zipfile

KEEP = {"ELEITO", "ELEITO POR QP", "ELEITO POR MÉDIA", "2º TURNO"}
CARGOS = {"Presidente", "Governador", "Senador", "Deputado Federal", "Deputado Estadual", "Deputado Distrital"}


def main(path: str) -> None:
    z = zipfile.ZipFile(path)
    name = next(n for n in z.namelist() if n.endswith("_BRASIL.csv"))
    gen = ""
    rows: dict[str, dict] = {}
    with z.open(name) as fh:
        for r in csv.DictReader(io.TextIOWrapper(fh, encoding="latin-1"), delimiter=";"):
            gen = f"{r['DT_GERACAO']} {r['HH_GERACAO']}"
            if r["DS_CARGO"] not in CARGOS:
                continue
            key = r["SQ_CANDIDATO"]
            cur = rows.get(key)
            votes = int(r["QT_VOTOS_NOMINAIS"] or 0)
            if cur:
                cur["v"] += votes
                # 2º turno vira "ELEITO" depois; fica a situação mais recente (maior turno).
                if int(r["NR_TURNO"]) >= cur["t"]:
                    cur["s"], cur["t"] = r["DS_SIT_TOT_TURNO"], int(r["NR_TURNO"])
                continue
            rows[key] = {
                "q": key,
                "c": r["DS_CARGO"],
                "u": r["SG_UF"] if r["DS_CARGO"] != "Presidente" else "BR",
                "n": r["NM_URNA_CANDIDATO"].title(),
                "f": r["NM_CANDIDATO"].title(),
                "p": r["SG_PARTIDO"],
                "s": r["DS_SIT_TOT_TURNO"],
                "t": int(r["NR_TURNO"]),
                "v": votes,
            }
    keep = sorted((r for r in rows.values() if r["s"] in KEEP), key=lambda r: (r["c"], r["u"], -r["v"]))
    for r in keep:
        r.pop("t")
    data = json.dumps(keep, ensure_ascii=False, separators=(",", ":")).replace("'", "''")
    print(f"-- Eleitos 2026 (TSE, arquivo gerado em {gen}). Gerado por scripts/import-tse-elected.py.")
    print("-- Não editar à mão: rodar o script de novo.")
    print("truncate elected_2026;")
    print("insert into elected_2026 (sq_candidato, cargo, uf, nome_urna, nome, partido, situacao, votos)")
    print("select q, c, u, n, f, p, s, v from json_to_recordset('" + data + "')")
    print("  as x(q text, c text, u text, n text, f text, p text, s text, v int);")
    print(f"-- {len(keep)} candidaturas", file=sys.stderr)


if __name__ == "__main__":
    main(sys.argv[1])
