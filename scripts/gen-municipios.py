#!/usr/bin/env python3
"""
Gera a parte de dados da migration 0043 (municípios e região imediata do IBGE).

A região geográfica imediata é a divisão do IBGE (2017) que junta cada cidade
com as vizinhas que dependem dela: Curitiba, São José dos Pinhais, Pinhais,
Colombo etc. ficam na mesma. Cobre todos os municípios, e cada região fica
dentro de uma UF só.

    curl -o /tmp/municipios.json https://servicodados.ibge.gov.br/api/v1/localidades/municipios
    python3 scripts/gen-municipios.py /tmp/municipios.json > /tmp/municipios.sql

O servidor do IBGE não manda o certificado intermediário. Se o curl reclamar,
baixe o intermediário que aparece no próprio certificado (Sectigo DV R36) e
passe com --cacert junto com o bundle do sistema, em vez de usar -k.
"""
import json
import sys


def q(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"


def main() -> None:
    data = json.load(open(sys.argv[1], encoding="utf-8"))
    rows = []
    for m in data:
        ri = m["regiao-imediata"]
        uf = ri["regiao-intermediaria"]["UF"]["sigla"]
        rows.append((m["id"], m["nome"], uf, ri["id"], ri["nome"]))
    rows.sort()
    print(f"-- {len(rows)} municípios, gerado por scripts/gen-municipios.py (IBGE, API de localidades)")
    print("insert into municipios (ibge, nome, uf, regiao_id, regiao_nome) values")
    print(",\n".join(f"  ({i}, {q(n)}, {q(u)}, {r}, {q(rn)})" for i, n, u, r, rn in rows))
    print("on conflict (ibge) do update set nome = excluded.nome, uf = excluded.uf,")
    print("  regiao_id = excluded.regiao_id, regiao_nome = excluded.regiao_nome;")


if __name__ == "__main__":
    main()
