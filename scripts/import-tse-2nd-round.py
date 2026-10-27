#!/usr/bin/env python3
"""
Resultado do 2º turno de 2026 direto da divulgação oficial do TSE
(resultados.tse.jus.br), sem esperar o zip de dados abertos.

    python3 scripts/import-tse-2nd-round.py > /tmp/2turno.sql

Lê o arquivo de cada cargo/abrangência (presidente no Brasil, governador em
cada UF), só aceita se o TSE marcou a totalização como final (`tf = "s"`) e
gera SQL para `elected_2026`: quem foi eleito vira ELEITO com os votos do 2º
turno; quem não foi sai da tabela, como no scripts/import-tse-elected.py.
Rodar o import-tse-elected.py depois, quando o zip consolidado sair, refaz a
tabela inteira e deve dar o mesmo resultado.
"""
import json
import sys
import urllib.error
import urllib.request

BASE = "https://resultados.tse.jus.br/oficial/ele2026"
# Códigos do 2º turno no índice do TSE (comum/config/ele-c.json, campo cdt2).
FEDERAL, ESTADUAL = "6258", "6260"
UFS = "ac al am ap ba ce df es go ma mg ms mt pa pb pe pi pr rj rn ro rr rs sc se sp to".split()


def fetch(ele: str, uf: str, cargo: int) -> dict | None:
    url = f"{BASE}/{ele}/dados/{uf}/{uf}-c{cargo:04d}-e{int(ele):06d}-u.json"
    try:
        with urllib.request.urlopen(url, timeout=30) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        if e.code == 404:  # UF sem 2º turno para o cargo
            return None
        raise


def candidates(d: dict):
    for c in d["carg"]:
        for a in c["agr"]:
            for p in a["par"]:
                yield from p["cand"]


def main() -> None:
    sources = [(FEDERAL, "br", 1)] + [(ESTADUAL, uf, 3) for uf in UFS]
    out = []
    for ele, uf, cargo in sources:
        d = fetch(ele, uf, cargo)
        if d is None:
            continue
        if d.get("tf") != "s":
            sys.exit(f"{uf} cargo {cargo}: totalização ainda não é final, nada gerado")
        out.append(f"-- {uf.upper()} cargo {cargo}: TSE {d['dg']} {d['hg']}")
        for k in candidates(d):
            sq = k["sqcand"]
            if k["e"] == "s":
                out.append(
                    f"update elected_2026 set situacao = 'ELEITO', votos = {int(k['vap'])} "
                    f"where sq_candidato = '{sq}' and situacao = '2º TURNO';"
                )
            else:
                out.append(f"delete from elected_2026 where sq_candidato = '{sq}' and situacao = '2º TURNO';")
            print(f"{uf.upper()} {k['nmu']}: {k['st']} ({k['pvap']}%)", file=sys.stderr)
    print("-- 2º turno 2026, gerado por scripts/import-tse-2nd-round.py. Não editar à mão.")
    print("begin;")
    print("\n".join(out))
    print("commit;")


if __name__ == "__main__":
    main()
