"""Revisões científicas (pipeline/revisoes/*.json): lê, junta e valida.

Cada arquivo de revisão tem:
  sobre            quem revisou, quando, sobre o quê
  correcoes        registro das correções do conteúdo existente (aplicadas à mão nos
                   arquivos-fonte; "status": aplicada | mantida, com "nota")
  novos_eventos, novos_grupos, novas_rotas, novas_migracoes, novos_povos, novas_cidades
  perspectivas     debates com opções (ver perspectivas.py)
Para incluir uma revisão nova, basta pôr outro .json na pasta e rodar conteudo.py:
a validação aponta ids repetidos, referências quebradas, regiões inexistentes etc.
"""
import json
import re
from pathlib import Path

from conteudo_fonte import EVENTOS, GRUPOS, ROTAS
from conteudo_humanos import CHEGADA, MIGRACOES, POVOS
from hominideos import ESPECIES, ROTAS_HOMINIDEOS

PASTA = Path(__file__).resolve().parent / "revisoes"
LISTAS = ("novos_eventos", "novos_grupos", "novas_rotas", "novas_migracoes", "novos_povos", "novas_cidades", "perspectivas")
CHAVES_ALTERACOES = {"eventos", "grupos", "rotas", "povos", "chegada", "populacao", "clima", "hominideos",
                     "eventos_extra", "rotas_extra"}
CHAVES_CLIMA = {"bola_de_neve_lat"}
CHAVES_POPULACAO = {"americas_1500", "brasil_1500"}
BANDEIRA = re.compile("[\U0001F1E6-\U0001F1FF]")  # emojis de bandeira não aparecem no Windows


def carregar_revisoes():
    rev = {k: [] for k in LISTAS}
    for arq in sorted(PASTA.glob("*.json")):
        dados = json.loads(arq.read_text(encoding="utf-8"))
        for k in LISTAS:
            rev[k] += dados.get(k, [])
    erros = validar(rev)
    if erros:
        raise SystemExit("Revisões com problemas:\n  - " + "\n  - ".join(erros))
    return rev


def _textos(obj):
    if isinstance(obj, str):
        yield obj
    elif isinstance(obj, dict):
        for v in obj.values():
            yield from _textos(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from _textos(v)


def _coord_ok(lon, lat):
    return -180 <= lon <= 180 and -90 <= lat <= 90


def _tempo(item, campo, campo_ano):
    from conteudo_fonte import A
    if campo_ano in item:
        return A(item[campo_ano]) if item[campo_ano] else 0
    return item.get(campo)


def validar(rev):
    erros = []
    ids_eventos = {e["id"] for e in EVENTOS}
    ids_grupos = {g["id"] for g in GRUPOS}
    ids_rotas = {r["id"] for r in ROTAS + MIGRACOES + ROTAS_HOMINIDEOS}
    ids_especies = {e["id"] for e in ESPECIES}
    nomes_povos = {p["n"] for p in POVOS}
    regioes = {regra[0] for regra in CHEGADA} | {"africa"}

    def novo_id(conjunto, i, tipo):
        if i in conjunto:
            erros.append(f"{tipo} '{i}' repetido")
        conjunto.add(i)

    def checar_evento(e, onde):
        if "t" not in e and "ano" not in e:
            erros.append(f"{onde}: evento '{e.get('id')}' sem t/ano")
        t = _tempo(e, "t", "ano")
        if t is not None and not (0 <= t <= 4600):
            erros.append(f"{onde}: evento '{e.get('id')}' com tempo fora de 0–4600 Ma")
        for lon, lat, _ in e.get("locais", []):
            if not _coord_ok(lon, lat):
                erros.append(f"{onde}: evento '{e.get('id')}' com coordenada inválida")

    def checar_rota(r, onde):
        de, ate = _tempo(r, "de", "de_ano"), _tempo(r, "ate", "ate_ano")
        if de is None or ate is None or de < ate:
            erros.append(f"{onde}: rota '{r.get('id')}' com janela de/ate inválida")
        for ramo in r.get("ramos", []):
            if len(ramo) < 2 or not all(_coord_ok(lon, lat) for lon, lat in ramo):
                erros.append(f"{onde}: rota '{r.get('id')}' com ramo inválido")

    for e in rev["novos_eventos"]:
        novo_id(ids_eventos, e["id"], "evento")
        checar_evento(e, "novos_eventos")
    for g in rev["novos_grupos"]:
        novo_id(ids_grupos, g["id"], "grupo")
    for g in rev["novos_grupos"]:
        if g.get("pai") not in ids_grupos:
            erros.append(f"grupo '{g['id']}' com pai inexistente '{g.get('pai')}'")
    for r in rev["novas_rotas"] + rev["novas_migracoes"]:
        novo_id(ids_rotas, r["id"], "rota")
        checar_rota(r, "rotas novas")
        if r.get("grupo") not in ids_grupos:
            erros.append(f"rota '{r['id']}' com grupo inexistente '{r.get('grupo')}'")
    for p in rev["novos_povos"]:
        novo_id(nomes_povos, p["n"], "povo")
        if not _coord_ok(*p["pos"]):
            erros.append(f"povo '{p['n']}' com posição inválida")
    for c in rev["novas_cidades"]:
        if not _coord_ok(c["lon"], c["lat"]):
            erros.append(f"cidade '{c['nome']}' com coordenada inválida")

    ids_debates = set()
    for pv in rev["perspectivas"]:
        novo_id(ids_debates, pv["id"], "debate")
        opcoes = pv.get("opcoes", [])
        if len(opcoes) < 2:
            erros.append(f"debate '{pv['id']}' com menos de 2 opções")
        if sum(1 for o in opcoes if o.get("padrao")) != 1:
            erros.append(f"debate '{pv['id']}' precisa de exatamente 1 opção padrão")
        ids_op = set()
        for o in opcoes:
            onde = f"debate '{pv['id']}', opção '{o.get('id')}'"
            novo_id(ids_op, o["id"], f"opção de {pv['id']}")
            alt = o.get("alteracoes", {})
            for chave in set(alt) - CHAVES_ALTERACOES:
                erros.append(f"{onde}: chave desconhecida '{chave}'")
            for i in alt.get("eventos", {}):
                if i not in ids_eventos:
                    erros.append(f"{onde}: evento inexistente '{i}'")
            for i in alt.get("grupos", {}):
                if i not in ids_grupos:
                    erros.append(f"{onde}: grupo inexistente '{i}'")
            for i in alt.get("rotas", {}):
                if i not in ids_rotas:
                    erros.append(f"{onde}: rota inexistente '{i}'")
            for i in alt.get("hominideos", {}):
                if i not in ids_especies:
                    erros.append(f"{onde}: espécie de hominídeo inexistente '{i}'")
            for i in alt.get("povos", {}):
                if i not in nomes_povos:
                    erros.append(f"{onde}: povo inexistente '{i}'")
            for regiao, v in alt.get("chegada", {}).items():
                if regiao not in regioes:
                    erros.append(f"{onde}: região de chegada inexistente '{regiao}'")
                if not (0 < v <= 2):
                    erros.append(f"{onde}: chegada '{regiao}' fora de 0–2 Ma")
            for chave, v in alt.get("clima", {}).items():
                if chave not in CHAVES_CLIMA or not (0 <= v <= 45):
                    erros.append(f"{onde}: clima '{chave}' inválido")
            for chave, v in alt.get("populacao", {}).items():
                if chave not in CHAVES_POPULACAO or not v or v <= 0:
                    erros.append(f"{onde}: populacao '{chave}' inválida")
            for e in alt.get("eventos_extra", []):
                if e["id"] in {x["id"] for x in EVENTOS} | {x["id"] for x in rev["novos_eventos"]}:
                    erros.append(f"{onde}: evento extra '{e['id']}' repete um evento existente")
                checar_evento(e, onde)
            for r in alt.get("rotas_extra", []):
                if r["id"] in ids_rotas:
                    erros.append(f"{onde}: rota extra '{r['id']}' repete uma rota existente")
                checar_rota(r, onde)

    for texto in _textos({k: rev[k] for k in LISTAS}):
        if BANDEIRA.search(texto):
            erros.append(f"emoji de bandeira em: {texto[:40]}")
    return erros


if __name__ == "__main__":
    rev = carregar_revisoes()
    print("revisões ok:", {k: len(v) for k, v in rev.items()})
