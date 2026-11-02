"""Monta data/conteudo.js a partir de conteudo_fonte.py: acha a placa de cada ponto."""
from comum import escrever_js, placa_do_ponto, registrar_placas
from conteudo_fonte import EVENTOS, GRUPOS, HISTORIAS, ROTAS, ROTULOS, A
from conteudo_humanos import CIDADES, HISTORIAS_HUMANAS, MIGRACOES, POVOS

placas = set()


def ponto(lon, lat, *extra):
    placa, idade = placa_do_ponto(lon, lat)
    placas.add(placa)
    return [round(lon, 3), round(lat, 3), placa, idade, *extra]


def main():
    grupos = [{k: v for k, v in g.items() if k != "pbdb"} | {"fosseis": bool(g.get("pbdb"))} for g in GRUPOS]
    eventos = []
    for e in EVENTOS:
        e = dict(e)
        e["locais"] = [ponto(lon, lat, nome) for lon, lat, nome in e.get("locais", [])]
        eventos.append(e)
    rotas = []
    for r in ROTAS + [dict(m, humana=True) for m in MIGRACOES]:
        r = dict(r)
        r["ramos"] = [[ponto(lon, lat) for lon, lat in ramo] for ramo in r["ramos"]]
        rotas.append(r)
    rotulos = []
    for r in ROTULOS:
        r = dict(r)
        r["ancoras"] = [ponto(lon, lat) for lon, lat in r["ancoras"]]
        rotulos.append(r)
    povos = [dict(p, pos=ponto(*p["pos"])) for p in POVOS]
    cidades = [ponto(lon, lat, nome, A(de), A(ate) if ate is not None else 0) for nome, lon, lat, de, ate in CIDADES]
    historias = []
    for h in HISTORIAS + HISTORIAS_HUMANAS:
        h = dict(h)
        h["passos"] = [dict(p, foco=ponto(*p["foco"])) for p in h["passos"]]
        historias.append(h)
    registrar_placas("conteudo", placas)
    escrever_js("conteudo", {"grupos": grupos, "eventos": eventos, "rotas": rotas, "rotulos": rotulos,
                             "historias": historias, "povos": povos, "cidades": cidades})


if __name__ == "__main__":
    main()
