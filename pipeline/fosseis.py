"""Fósseis reais da Paleobiology Database (paleobiodb.org) para cada grupo da árvore.

Baixa as ocorrências, agrupa as muito próximas (mesmo lugar e mesma idade) e descobre a
placa de cada ponto, para o navegador levá-lo à posição que tinha quando o ser vivia.

Saída: data/fosseis.js
"""
import json
import time
from collections import Counter, defaultdict

import requests
import shapefile

from comum import BRUTOS, NE, escrever_js, placa_do_ponto, registrar_placas
from conteudo_fonte import GRUPOS as GRUPOS_BASE
from revisao import carregar_revisoes

GRUPOS = GRUPOS_BASE + carregar_revisoes()["novos_grupos"]

PBDB = BRUTOS / "pbdb"
URL = "https://paleobiodb.org/data1.2/occs/list.json"
MAXIMO = 2000  # pontos por grupo
MAXIMO_GRUPO = {"dinossauros": 3500}  # grupos centrais nas histórias: mais detalhe


def baixar(grupo):
    PBDB.mkdir(parents=True, exist_ok=True)
    arq = PBDB / f"{grupo['id']}.json"
    if arq.exists():
        return json.loads(arq.read_text(encoding="utf-8"))
    t0 = time.time()
    r = requests.get(URL, params={"base_name": grupo["pbdb"], "show": "coords,loc,strat", "vocab": "com", "limit": "all"},
                     timeout=900, headers={"User-Agent": "evolucao-mapa (projeto educativo)"})
    r.raise_for_status()
    registros = r.json().get("records", [])
    # guarda só os campos usados
    enxuto = [{k: x.get(k) for k in ("tna", "eag", "lag", "lng", "lat", "cc2", "stp", "sfm")} for x in registros]
    arq.write_text(json.dumps(enxuto, ensure_ascii=False), encoding="utf-8")
    print(f"  {grupo['id']}: {len(enxuto)} ocorrências baixadas em {time.time() - t0:.0f}s")
    return enxuto


def nomes_paises():
    r = shapefile.Reader(str(NE / "ne_50m_admin_0_countries"), encoding="utf-8")
    campos = [f[0] for f in r.fields[1:]]
    saida = {}
    for rec in r.iterRecords():
        d = dict(zip(campos, rec))
        if d["ISO_A2"] and d["ISO_A2"] != "-99":
            saida[d["ISO_A2"]] = d["NAME_PT"] or d["NAME"]
    saida.update({"FR": "França", "NO": "Noruega", "UK": "Reino Unido", "GB": "Reino Unido"})
    return saida


def faixa_idade(eag, lag):
    """Largura do intervalo de idades que pode ser fundido (cresce com a idade)."""
    meio = (eag + lag) / 2
    return 5 if meio > 66 else 1 if meio > 2.58 else 0.1 if meio > 0.0117 else 0.001


def agrupar(ocorrencias, passo, juntar_idades):
    """Junta ocorrências do mesmo lugar (grade de 'passo' graus) e da mesma idade.
    Com juntar_idades, idades parecidas também se fundem."""
    grupos = defaultdict(list)
    for o in ocorrencias:
        try:
            lng, lat, eag, lag = float(o["lng"]), float(o["lat"]), float(o["eag"]), float(o["lag"])
        except (TypeError, ValueError):
            continue
        if juntar_idades:
            w = faixa_idade(eag, lag)
            idade = (round((eag + lag) / 2 / w),)
        else:
            idade = (round(eag, 1), round(lag, 1))
        grupos[(round(lng / passo), round(lat / passo), *idade)].append(o)
    return grupos


def main():
    paises = nomes_paises()
    placas = set()
    saida = []
    cache_placa = {}
    for g in GRUPOS:
        if not g.get("pbdb"):
            continue
        ocorrencias = baixar(g)
        for passo, juntar in ((0.5, False), (0.5, True), (1, True), (2, True), (4, True)):
            pontos = agrupar(ocorrencias, passo, juntar)
            if len(pontos) <= MAXIMO_GRUPO.get(g["id"], MAXIMO):
                break
        nomes, locais = [], []
        idx_nome, idx_local = {}, {}

        def indice(tabela, idx, texto):
            if texto not in idx:
                idx[texto] = len(tabela)
                tabela.append(texto)
            return idx[texto]

        itens = []
        for obs in pontos.values():
            eag = max(float(o["eag"]) for o in obs)
            lag = min(float(o["lag"]) for o in obs)
            # posição real (média) do agrupamento
            lng_m = sum(float(o["lng"]) for o in obs) / len(obs)
            lat_m = sum(float(o["lat"]) for o in obs) / len(obs)
            chave = (round(lng_m, 1), round(lat_m, 1))
            if chave not in cache_placa:
                cache_placa[chave] = placa_do_ponto(lng_m, lat_m)
            placa, _ = cache_placa[chave]
            placas.add(placa)
            especies = [n for n, _ in Counter(o["tna"] for o in obs if o.get("tna")).most_common(3)]
            o = obs[0]
            local = ", ".join(x for x in (o.get("stp") or "", paises.get(o.get("cc2") or "", o.get("cc2") or "")) if x)
            if o.get("sfm"):
                local = f"Formação {o['sfm']} · {local}"
            itens.append([round(lng_m, 2), round(lat_m, 2), placa, eag, lag, len(obs),
                          [indice(nomes, idx_nome, n) for n in especies], indice(locais, idx_local, local)])
        itens.sort(key=lambda x: -x[3])
        print(f"  {g['id']}: {len(ocorrencias)} ocorrências -> {len(itens)} pontos (grade {passo}°, idades {'agrupadas' if juntar else 'exatas'})")
        saida.append({"id": g["id"], "pontos": itens, "nomes": nomes, "locais": locais})
    registrar_placas("fosseis", placas)
    escrever_js("fosseis", {"grupos": saida, "fonte": "Paleobiology Database (paleobiodb.org), CC BY 4.0"})


if __name__ == "__main__":
    main()
