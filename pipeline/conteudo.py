"""Monta data/conteudo.js a partir dos arquivos de conteúdo: acha a placa de cada ponto."""
import copy

from comum import escrever_js, placa_do_ponto, registrar_placas
from conteudo_fonte import EVENTOS, GRUPOS, HISTORIAS, ROTAS, ROTULOS, A
from conteudo_humanos import CIDADES, HISTORIAS_HUMANAS, MIGRACOES, POVOS
from hominideos import ENCONTROS, ESPECIES, FAZENDAS, HISTORIA as HISTORIA_HOMINIDEOS, ROTAS_HOMINIDEOS
from perspectivas import PERSPECTIVAS
from revisao import carregar_revisoes

placas = set()
ROTAS_DE_HOMINIDEOS = {"erectus", "h_africa", "h_levante", "sapiens_saida", "sapiens_europa", "h_siberia"}


def ponto(lon, lat, *extra):
    placa, idade = placa_do_ponto(lon, lat)
    placas.add(placa)
    return [round(lon, 3), round(lat, 3), placa, idade, *extra]


def local(lon, lat, nome, rocha=0):
    """Lugar de um marco. rocha (opcional, Ma): idade mínima da rocha do lugar, quando o modelo
    de placas só registra a crosta depois disso (Avalon, na Terra Nova, só existe nele desde
    420 Ma, mas tem fósseis de 565 Ma); sem isso o mapa esconde o pino."""
    p = ponto(lon, lat, nome)
    p[3] = max(p[3], rocha)
    return p


def preparar_evento(e):
    e = dict(e)
    if "ano" in e:
        e["t"] = A(e.pop("ano"))
    if "locais" in e:
        e["locais"] = [local(*l) for l in e["locais"]]
    return e


def preparar_rota(r, humana=False):
    r = dict(r)
    if "de_ano" in r:
        r["de"] = A(r.pop("de_ano"))
    if "ate_ano" in r:
        r["ate"] = A(r.pop("ate_ano"))
    if "ramos" in r:
        r["ramos"] = [[ponto(lon, lat) for lon, lat in ramo] for ramo in r["ramos"]]
    if humana:
        r["humana"] = True
    r.pop("fontes", None)
    return r


def preparar_povo(p):
    p = dict(p)
    if "de_ano" in p:
        p["de"] = A(p.pop("de_ano"))
    if "ate_ano" in p:
        ate = p.pop("ate_ano")
        p["ate"] = A(ate) if ate else 0  # 0/None = até hoje
    if "pos" in p:
        p["pos"] = ponto(*p["pos"])
    p.pop("fontes", None)
    return p


def preparar_perspectiva(pv):
    pv = copy.deepcopy(pv)
    rotas_humanas = {m["id"] for m in MIGRACOES} | {"erectus", "sapiens_saida", "sapiens_europa", "sapiens_america", "austronesios"}
    # rotas extras humanas: do grupo sapiens/hominíneos ou com id de migração (h_...)
    for op in pv["opcoes"]:
        alt = op.get("alteracoes", {})
        for k, e in alt.get("eventos", {}).items():
            alt["eventos"][k] = preparar_evento(e)
        for k, r in alt.get("rotas", {}).items():
            alt["rotas"][k] = preparar_rota(r)
        for k, p in alt.get("povos", {}).items():
            alt["povos"][k] = preparar_povo(p)
        alt["eventos_extra"] = [preparar_evento(e) for e in alt.get("eventos_extra", [])]
        alt["rotas_extra"] = [preparar_rota(r, humana=r.get("grupo") in ("sapiens", "hominineos") or r["id"] in rotas_humanas)
                              for r in alt.get("rotas_extra", [])]
        op["alteracoes"] = alt
    return pv


def main():
    rev = carregar_revisoes()  # pipeline/revisoes/*.json, já validadas
    grupos = [{k: v for k, v in g.items() if k != "pbdb"} | {"fosseis": bool(g.get("pbdb"))}
              for g in GRUPOS + rev["novos_grupos"]]
    eventos = [preparar_evento(dict(e, locais=e.get("locais", []))) for e in EVENTOS + rev["novos_eventos"]]
    rotas = ([preparar_rota(r) for r in ROTAS + rev["novas_rotas"]]
             + [preparar_rota(m, humana=True) for m in MIGRACOES + rev["novas_migracoes"]]
             + [dict(preparar_rota(r), hominideo=True, exclusiva="hominideos") for r in ROTAS_HOMINIDEOS])
    # rotas de hominíneos que também aparecem na camada especial
    for r in rotas:
        if r["id"] in ROTAS_DE_HOMINIDEOS:
            r["hominideo"] = True
    hominideos = {
        "especies": [dict(e, sitios=[ponto(lon, lat, nome, de, ate) for nome, lon, lat, de, ate in e["sitios"]],
                          nucleos=[ponto(lon, lat, nome, de, ate, peso) for nome, lon, lat, de, ate, peso in e.get("nucleos", [])])
                     for e in ESPECIES],
        "fazendas": [dict(f, t=A(f["ano"]), lugar=ponto(f["lon"], f["lat"])) for f in FAZENDAS],
        "encontros": [dict(e, lugar=ponto(*e["lugar"])) for e in ENCONTROS],
    }
    rotulos = []
    for r in ROTULOS:
        r = dict(r)
        r["ancoras"] = [ponto(lon, lat) for lon, lat in r["ancoras"]]
        rotulos.append(r)
    povos = [preparar_povo(p) for p in POVOS + rev["novos_povos"]]
    novas_cidades = [(c["nome"], c["lon"], c["lat"], c["fundacao"], c.get("abandono")) for c in rev["novas_cidades"]]
    cidades = [ponto(lon, lat, nome, A(de), A(ate) if ate is not None else 0)
               for nome, lon, lat, de, ate in CIDADES + novas_cidades]
    historias = []
    for h in HISTORIAS + HISTORIAS_HUMANAS + [HISTORIA_HOMINIDEOS]:
        h = dict(h)
        h["passos"] = [dict(p, foco=ponto(*p["foco"])) for p in h["passos"]]
        historias.append(h)
    perspectivas = [preparar_perspectiva(pv) for pv in PERSPECTIVAS + rev["perspectivas"]]
    registrar_placas("conteudo", placas)
    escrever_js("conteudo", {"grupos": grupos, "eventos": eventos, "rotas": rotas, "rotulos": rotulos,
                             "historias": historias, "povos": povos, "cidades": cidades,
                             "perspectivas": perspectivas, "hominideos": hominideos})


if __name__ == "__main__":
    main()
