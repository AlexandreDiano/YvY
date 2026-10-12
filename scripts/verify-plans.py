#!/usr/bin/env python3
"""
Confere os itens dos planos de governo (tabela government_plans, migration
0027) palavra a palavra contra o texto do PDF oficial.

A IA só localiza trechos; o que aparece no app tem que estar LITERALMENTE no
plano (regra editorial: transcrição, nunca resumo). Item que não bate com o
texto do PDF (na página indicada ou nas vizinhas) é descartado; a página é
corrigida para onde o trecho de fato está.

    python3 scripts/verify-plans.py plans.json > verified.json

`plans.json`: lista de linhas de government_plans (sq_candidato, pdf_url,
items). Saída: mesma lista com `items` filtrados, `pages` e `verified=true`.
Precisa de `pdftotext` (poppler) instalado.
"""
import json
import re
import subprocess
import sys
import tempfile
import unicodedata
import urllib.request


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKC", s)
    s = re.sub(r"-\s*\n\s*", "", s)  # hifenização de quebra de linha
    s = re.sub(r"[“”\"'‘’]", "", s)
    s = re.sub(r"[•●▪◦•●]", " ", s)
    return re.sub(r"\s+", " ", s).strip().lower()


def page_texts(pdf_path: str) -> list[str]:
    out = subprocess.run(["pdftotext", "-q", pdf_path, "-"], capture_output=True, text=True).stdout
    return [norm(p) for p in out.split("\f")]


def main(path: str) -> None:
    plans = json.load(open(path))
    result = []
    for plan in plans:
        with tempfile.NamedTemporaryFile(suffix=".pdf") as tmp:
            urllib.request.urlretrieve(plan["pdf_url"], tmp.name)
            pages = page_texts(tmp.name)
        kept = []
        for item in plan.get("items") or []:
            text = norm(item.get("texto", ""))
            if len(text) < 20:
                continue
            hint = int(item.get("pagina") or 0)
            order = [hint - 1, hint - 2, hint] + list(range(len(pages)))
            found = next((i for i in order if 0 <= i < len(pages) and text in pages[i]), None)
            if found is None:
                continue
            kept.append({"tema": item.get("tema", "").strip(), "texto": item["texto"].strip(), "pagina": found + 1})
        print(f"{plan['sq_candidato']}: {len(kept)}/{len(plan.get('items') or [])} itens conferidos", file=sys.stderr)
        result.append({**plan, "items": kept, "pages": len([p for p in pages if p]), "verified": True})
    json.dump(result, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main(sys.argv[1])
