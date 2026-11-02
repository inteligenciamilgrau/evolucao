"""Ocupação humana: densidade de população numa grade de 0,5° ao longo do tempo.

- 1850 a 2021: grades reais do ISIMIP3a (derivadas da HYDE), files.isimip.org.
- 10.000 a.C. a 1850: totais por país do Our World in Data (HYDE 3.3), distribuídos
  dentro de cada país pelo padrão de 1850 (nas Américas e na Oceania, misturado com uma
  distribuição uniforme, já que o padrão de 1850 é colonial).
- Antes disso: só onde os sapiens já tinham chegado (tabela CHEGADA).

Saída: data/populacao.js
"""
import base64
import csv
import math
from collections import defaultdict

import h5py
import numpy as np
import requests
import shapefile
import shapely
from shapely.geometry import shape

from comum import BRUTOS, NE, escrever_js
from conteudo_humanos import POP_PLEISTOCENO, chegada

POP = BRUTOS / "populacao"
ISIMIP = "https://files.isimip.org/ISIMIP3a/InputData/socioeconomic/pop/histsoc/"
ARQUIVOS = ["population_histsoc_30arcmin_annual_1850_1900.nc", "population_histsoc_30arcmin_annual_1901_2021.nc"]
OWID = "https://ourworldindata.org/grapher/population.csv?v=1&csvType=full&useColumnShortNames=true"

ANOS_GRADE = [1850, 1880, 1900, 1925, 1950, 1975, 2000, 2021]
ANOS_PAISES = list(range(-10000, 0, 1000)) + list(range(0, 1800, 100)) + [1750, 1800, 1850]
ANOS_MUNDO = ANOS_PAISES + [1900, 1920, 1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020, 2023]
COLONIZADOS = {"North America", "South America", "Oceania"}  # padrão de 1850 é colonial
CODIGOS_NE = {"KOS": "OWID_KOS", "SOL": "SOM", "CYN": "CYP", "SDS": "SSD", "SAH": "ESH", "PSX": "PSE",
              "KAB": "KAZ", "ESB": "CYP", "WSB": "CYP", "CNM": "CYP", "IOA": "AUS", "ATC": "AUS"}


def baixar():
    POP.mkdir(parents=True, exist_ok=True)
    for nome in ARQUIVOS:
        if not (POP / nome).exists():
            print("baixando", nome)
            r = requests.get(ISIMIP + nome, timeout=1800)
            r.raise_for_status()
            (POP / nome).write_bytes(r.content)
    if not (POP / "owid_population.csv").exists():
        r = requests.get(OWID, timeout=300)
        r.raise_for_status()
        (POP / "owid_population.csv").write_bytes(r.content)


def ler_grades():
    """{ano: matriz 360x720 de pessoas por célula} (norte para cima, -180 a 180)."""
    grades = {}
    for nome in ARQUIVOS:
        with h5py.File(POP / nome, "r") as f:
            anos = (1850 + np.floor(f["time"][:])).astype(int)  # "anos desde 1850"
            lat = f["lat"][:]
            for ano in ANOS_GRADE:
                if ano in anos:
                    g = f["total-population"][list(anos).index(ano)].astype(np.float64)
                    g[~np.isfinite(g) | (g > 1e15) | (g < 0)] = 0
                    grades[ano] = g
    assert lat[0] > lat[-1], "esperava latitudes do norte para o sul"
    return grades


def ler_owid():
    series = defaultdict(dict)
    with open(POP / "owid_population.csv", encoding="utf-8") as f:
        for linha in csv.DictReader(f):
            chave = "MUNDO" if linha["entity"] == "World" else linha["code"]
            if chave and linha["population_historical"]:
                series[chave][int(linha["year"])] = float(linha["population_historical"])
    return series


def interp_serie(serie, anos):
    conhecidos = sorted(serie)
    saida = []
    for ano in anos:
        if ano in serie:
            saida.append(serie[ano])
            continue
        antes = [a for a in conhecidos if a < ano]
        depois = [a for a in conhecidos if a > ano]
        if not antes or not depois:
            saida.append(serie[antes[-1]] if antes else serie[depois[0]] if depois else 0)
            continue
        a, b = antes[-1], depois[0]
        va, vb = serie[a], serie[b]
        f = (ano - a) / (b - a)
        saida.append(math.exp(math.log(va) * (1 - f) + math.log(vb) * f) if va > 0 and vb > 0 else va + (vb - va) * f)
    return [round(v) for v in saida]


def paises_ne():
    r = shapefile.Reader(str(NE / "ne_50m_admin_0_countries"), encoding="utf-8")
    campos = [f[0] for f in r.fields[1:]]
    geoms, info = [], []
    for sr in r.iterShapeRecords():
        d = dict(zip(campos, sr.record))
        codigo = d["ISO_A3"] if d["ISO_A3"] not in ("-99", "", None) else d["ADM0_A3"]
        codigo = CODIGOS_NE.get(d["ADM0_A3"], CODIGOS_NE.get(codigo, codigo))
        geoms.append(shapely.make_valid(shape(sr.shape.__geo_interface__)))
        info.append((codigo, d["CONTINENT"], d["NAME_PT"] or d["NAME"]))
    return geoms, info


def b64(arr):
    return base64.b64encode(np.ascontiguousarray(arr).tobytes()).decode("ascii")


def classe(dens):
    """Densidade (hab/km²) -> 0..255 em escala logarítmica (0,01 a ~22 mil hab/km²)."""
    c = np.zeros(dens.shape, dtype=np.uint8)
    ok = dens >= 0.01
    c[ok] = np.clip(np.round((np.log10(dens[ok]) + 2) * 40) + 1, 1, 255)
    return c


def main():
    baixar()
    grades = ler_grades()
    owid = ler_owid()
    print(f"grades: {sorted(grades)}  séries OWID: {len(owid)}")

    lat = 89.75 - 0.5 * np.arange(360)
    lon = -179.75 + 0.5 * np.arange(720)
    area_linha = (6371.0 ** 2) * math.radians(0.5) * np.abs(np.sin(np.radians(lat + 0.25)) - np.sin(np.radians(lat - 0.25)))

    povoada = (grades[1850] > 0) | (grades[2021] > 0)
    iy, ix = np.nonzero(povoada)
    indices = iy * 720 + ix
    n = len(indices)
    print(f"células povoadas: {n}")

    # país de cada célula
    geoms, info = paises_ne()
    arvore = shapely.STRtree(geoms)
    pts = shapely.points(lon[ix], lat[iy])
    dentro, alvo = arvore.query(pts, predicate="within")
    pais_ne = np.full(n, -1)
    pais_ne[dentro] = alvo
    faltam = np.nonzero(pais_ne < 0)[0]
    if len(faltam):
        perto = arvore.query_nearest(pts[faltam], max_distance=2.0, return_distance=False)
        pais_ne[faltam[perto[0]]] = perto[1]
    sem = (pais_ne < 0).sum()
    print(f"células sem país (descartadas): {sem}")
    manter = pais_ne >= 0
    iy, ix, indices, pais_ne = iy[manter], ix[manter], indices[manter], pais_ne[manter]
    n = len(indices)

    # tabela de países usados
    codigos = []
    idx_codigo = {}
    pais = np.zeros(n, dtype=np.uint8)
    for k in range(n):
        codigo = info[pais_ne[k]][0]
        if codigo not in idx_codigo:
            idx_codigo[codigo] = len(codigos)
            codigos.append(codigo)
        pais[k] = idx_codigo[codigo]
    assert len(codigos) < 256

    area = area_linha[iy]
    p1850 = grades[1850][iy, ix]
    p2021 = grades[2021][iy, ix]
    r1850 = np.zeros(n)
    r_antigo = np.zeros(n)
    tabela = []
    mundo = owid["MUNDO"]
    for j, codigo in enumerate(codigos):
        m = pais == j
        a_total = area[m].sum()
        nome, continente = next((i[2], i[1]) for i in info if i[0] == codigo)
        dens_1850 = p1850[m] / area[m]
        media = p1850[m].sum() / a_total
        if media > 0:
            r = dens_1850 / media
        else:
            r = np.ones(m.sum())
        uniforme = (p2021[m] > 0).astype(float)
        if uniforme.sum() == 0:
            uniforme[:] = 1
        uniforme *= a_total / (uniforme * area[m]).sum()
        peso = 0.5 if continente in COLONIZADOS else 0.15
        ra = (1 - peso) * r + peso * uniforme
        ra *= a_total / (ra * area[m]).sum()
        r1850[m] = r
        r_antigo[m] = ra
        serie = owid.get(codigo)
        if serie:
            pops = interp_serie(serie, ANOS_PAISES)
        else:  # sem série: segue o mundo, a partir da soma de 1850
            base = p1850[m].sum() or p2021[m].sum() * 0.1
            pops = [round(base * v / mundo[1850]) for v in interp_serie(mundo, ANOS_PAISES)]
            print(f"  sem série OWID: {codigo} ({nome})")
        tabela.append({"c": codigo, "n": nome, "a": round(a_total), "p": pops})

    def cod_r(r):
        e = np.zeros(len(r), dtype=np.uint8)
        ok = r > 0
        e[ok] = np.clip(np.round((np.log2(r[ok]) + 12) * 10), 1, 255)
        return e

    # quando os sapiens chegaram a cada célula
    chegadas = []
    idx_cheg = {}
    cheg = np.zeros(n, dtype=np.uint8)
    for k in range(n):
        codigo, continente, _ = info[pais_ne[k]]
        v = round(chegada(codigo, continente, float(lon[ix[k]]), float(lat[iy[k]])), 7)
        if v not in idx_cheg:
            idx_cheg[v] = len(chegadas)
            chegadas.append(v)
        cheg[k] = idx_cheg[v]

    deltas = np.diff(np.concatenate([[0], indices]))
    assert deltas.max() < 65536
    classes = [b64(classe(grades[ano][iy, ix] / area)) for ano in ANOS_GRADE]

    escrever_js("populacao", {
        "resolucao": 0.5,
        "celulas": b64(deltas.astype("<u2")),
        "pais": b64(pais),
        "chegada": b64(cheg), "chegadas": chegadas,
        "r1850": b64(cod_r(r1850)), "rAntigo": b64(cod_r(r_antigo)),
        "anosPaises": ANOS_PAISES, "paises": tabela,
        "grade": {"anos": ANOS_GRADE, "classes": classes},
        "mundo": {"anos": ANOS_MUNDO, "pop": interp_serie(mundo, ANOS_MUNDO)},
        "pleistoceno": POP_PLEISTOCENO,
        "fonte": "ISIMIP3a / HYDE (grade 1850–2021), Our World in Data / HYDE 3.3 (países, 10.000 a.C.–1850)",
    })


if __name__ == "__main__":
    main()
