"""Geografia "fatiada" pelas placas tectônicas.

Pega a geografia de hoje (países, estados, crosta continental, plataformas que ficam
expostas quando o mar baixa) e corta cada polígono nos limites das placas do modelo
Cao 2024. Cada pedaço guarda o id da sua placa e a idade da crosta, para o navegador
poder levá-lo de volta no tempo.

Saída: data/geo.js
"""
import math
import time
from collections import defaultdict

import numpy as np
import pygplates
import shapefile
import shapely
from shapely import affinity
from shapely.geometry import LineString, MultiPolygon, Polygon, box, shape
from shapely.ops import unary_union

from comum import (MODELO, NE, codificar_linha, desembrulhar, escrever_js, idade,
                   modelo_rotacao, placa_do_ponto, poligonos_estaticos, registrar_placas)
from conteudo_fonte import ILHAS


def idade_ilha(lon, lat, idade_crosta):
    """Ilhas vulcânicas são mais novas que a placa oceânica onde estão."""
    lon = ((lon + 180) % 360) - 180
    for _, x0, x1, y0, y1, idade_ilha in ILHAS:
        if x0 <= lon <= x1 and y0 <= lat <= y1:
            return min(idade_crosta, idade_ilha)
    return idade_crosta

CONTINENTES = {
    "Africa": "África", "Asia": "Ásia", "Europe": "Europa", "North America": "América do Norte",
    "South America": "América do Sul", "Oceania": "Oceania", "Antarctica": "Antártida",
    "Seven seas (open ocean)": "Oceano",
}

ESTADOS_DE = ("BRA", "USA", "RUS", "CHN")
NOME_PAIS = {"BRA": "Brasil", "USA": "Estados Unidos", "RUS": "Rússia", "CHN": "China"}

REGIOES_BR = {
    "Norte": "AC AP AM PA RO RR TO", "Nordeste": "AL BA CE MA PB PE PI RN SE",
    "Centro-Oeste": "DF GO MT MS", "Sudeste": "ES MG RJ SP", "Sul": "PR RS SC",
}
REGIOES_BR = {sigla: reg for reg, siglas in REGIOES_BR.items() for sigla in siglas.split()}

REGIOES_EUA = {"West": "Oeste", "Midwest": "Meio-Oeste", "South": "Sul", "Northeast": "Nordeste"}

# Distritos federais russos (2018+), a partir das regiões do Natural Earth
REGIOES_RUS = {"Central": "Central", "Northwestern": "Noroeste", "Urals": "Urais",
               "Siberian": "Sibéria", "Far Eastern": "Extremo Oriente"}

REGIOES_CHN = {
    "Norte": "Beijing Tianjin Hebei Shanxi Inner",
    "Nordeste": "Liaoning Jilin Heilongjiang",
    "Leste": "Shanghai Jiangsu Zhejiang Anhui Fujian Jiangxi Shandong",
    "Centro-Sul": "Henan Hubei Hunan Guangdong Guangxi Hainan Paracel",
    "Sudoeste": "Chongqing Sichuan Guizhou Yunnan Xizang Tibet",
    "Noroeste": "Shaanxi Gansu Qinghai Ningxia Xinjiang",
}


def regiao_do_estado(reg):
    pais = reg["adm0_a3"]
    if pais == "BRA":
        return REGIOES_BR.get(reg["postal"], "?")
    if pais == "USA":
        return REGIOES_EUA.get(reg["region"], "?")
    if pais == "RUS":
        nome = reg["name"]
        if any(k in nome for k in ("Buryat", "Zabaykal")):
            return "Extremo Oriente"
        if reg["region"] == "Volga":
            return "Sul e Cáucaso" if reg["region_sub"] == "North Caucasus" else "Volga"
        return REGIOES_RUS.get(reg["region"], "?")
    if pais == "CHN":
        for regiao, chaves in REGIOES_CHN.items():
            if any(k in reg["name"] for k in chaves.split()):
                return regiao
        return "?"
    return ""


def ler_shp(nome):
    r = shapefile.Reader(str(NE / nome), encoding="utf-8")
    campos = [f[0] for f in r.fields[1:]]
    for sr in r.iterShapeRecords():
        if sr.shape.shapeType == shapefile.NULL:
            continue
        yield dict(zip(campos, sr.record)), shape(sr.shape.__geo_interface__)


def poligonos(geom):
    if geom is None or geom.is_empty:
        return []
    if isinstance(geom, Polygon):
        return [geom]
    if hasattr(geom, "geoms"):
        return [p for g in geom.geoms for p in poligonos(g)]
    return []


def unir_linha_de_data(geom):
    """Junta partes cortadas em ±180° (Chukotka, Aleutas, Fiji) para não sobrar uma
    "costura" desenhada quando o pedaço viaja no tempo."""
    partes = poligonos(geom)
    if not partes:
        return partes
    minx = min(p.bounds[0] for p in partes)
    maxx = max(p.bounds[2] for p in partes)
    if minx > -179.9 or maxx < 179.9 or any(p.bounds[2] - p.bounds[0] > 350 for p in partes):
        return partes
    deslocadas = [affinity.translate(p, 360) if p.centroid.x < 0 else p for p in partes]
    return poligonos(unary_union([p.buffer(0) for p in deslocadas]))


def adensar(coords, passo=0.5):
    """Insere pontos em segmentos longos para que fronteiras retas (ex.: paralelo 49°N)
    não virem arcos de grande círculo."""
    saida = []
    for (x0, y0), (x1, y1) in zip(coords, coords[1:]):
        saida.append((x0, y0))
        n = int(max(abs(x1 - x0), abs(y1 - y0)) / passo)
        for i in range(1, n + 1):
            f = i / (n + 1)
            saida.append((x0 + (x1 - x0) * f, y0 + (y1 - y0) * f))
    saida.append(coords[-1])
    return saida


def preparar(geom, tolerancia, area_minima):
    """Simplifica, descarta ilhotas e adensa. Sempre mantém o maior polígono."""
    partes = unir_linha_de_data(geom)
    partes = poligonos(unary_union([p.simplify(tolerancia, preserve_topology=True) for p in partes]))
    if not partes:
        return []
    maior = max(partes, key=lambda p: p.area)
    aneis = []
    for p in partes:
        if p is not maior and p.area < area_minima:
            continue
        pts = [(x, y) for x, y in p.exterior.coords if abs(y) < 89.9]
        pts = adensar(pts)
        if len(pts) >= 4:
            aneis.append(pts)
    return aneis


class Placas:
    """Polígonos estáticos do modelo (posição atual) como polígonos planos em lon/lat,
    com cópias deslocadas de ±360° para cobrir geometrias que passam da linha de data.
    (O partition_into_plates do pygplates devolve só as bordas dos polígonos cortados,
    por isso o recorte é feito aqui com shapely.)"""

    def __init__(self):
        self.polys, self.info = [], []
        for f in poligonos_estaticos():
            b, e = f.get_valid_time()
            info = (f.get_reconstruction_plate_id(), idade(b), idade(e))
            for g in f.get_geometries():
                if not isinstance(g, pygplates.PolygonOnSphere):
                    continue
                anel = desembrulhar([(lon, lat) for lat, lon in (p.to_lat_lon() for p in g.get_exterior_ring_points())])
                if abs(anel[-1][0] - anel[0][0]) > 180:  # contorna um polo
                    polo = 90 if sum(y for _, y in anel) > 0 else -90
                    anel += [(anel[-1][0], polo), (anel[0][0], polo)]
                p = Polygon(anel)
                if not p.is_valid:
                    p = p.buffer(0)
                # menos vértices nos cortes; a folga (< 5 km) não aparece no mapa
                p = p.simplify(0.05, preserve_topology=True)
                for dx in (-360, 0, 360):
                    for q in poligonos(affinity.translate(p, dx)):
                        self.polys.append(q)
                        self.info.append(info)
        self.arvore = shapely.STRtree(self.polys)
        area = sum(p.area for p, i in zip(self.polys, range(len(self.polys)))) / 3
        print(f"  polígonos estáticos: {len(self.polys) // 3}, área coberta ~{area:.0f} de 64800 graus²")

    def recortar(self, poly):
        """Divide um polígono pelas placas -> [(Polygon, placa, inicio, fim)]."""
        saida, cobertos = [], []
        minima = min(0.003, poly.area * 0.05)  # descarta lascas do recorte
        for i in self.arvore.query(poly, predicate="intersects"):
            for q in poligonos(poly.intersection(self.polys[i])):
                if q.area > minima:
                    saida.append((q, *self.info[i]))
                    cobertos.append(q)
        resto = poly.difference(unary_union(cobertos)) if cobertos else poly
        for q in poligonos(resto):
            if q.area < max(minima, 0.01):
                continue
            pt = q.representative_point()
            placa, b = placa_do_ponto(((pt.x + 180) % 360) - 180, pt.y)
            saida.append((q, placa, b, 0))
        return saida


_placas = None


def placas():
    global _placas
    if _placas is None:
        _placas = Placas()
    return _placas


def trechos_de_corte(anel, original, tolerancia=0.005):
    """Segmentos do anel que NÃO estão na fronteira original (foram criados pelo corte
    nas placas). O navegador não desenha contorno neles. Retorna [inicio, tamanho, ...]."""
    if original is None:
        return []
    meio = np.array([((x0 + x1) / 2, (y0 + y1) / 2)
                     for (x0, y0), (x1, y1) in zip(anel, anel[1:] + anel[:1])])
    dist = np.full(len(meio), np.inf)
    for dx in (-360, 0, 360):
        pts = shapely.points(meio[:, 0] + dx, meio[:, 1])
        dist = np.minimum(dist, shapely.distance(pts, original))
    corte = dist > tolerancia
    trechos = []
    i = 0
    while i < len(corte):
        if corte[i]:
            j = i
            while j < len(corte) and corte[j]:
                j += 1
            trechos += [i, j - i]
            i = j
        else:
            i += 1
    return trechos


def processar(itens_geom, tolerancia, area_minima, com_corte=True):
    """Corta cada geometria pelas placas.
    Retorna peças [indice, placa, inicio, fim, [anéis codificados], [cortes por anel]]."""
    t0 = time.time()
    pecas = []
    for i, geom in enumerate(itens_geom):
        for anel in preparar(geom, tolerancia, area_minima):
            poly = Polygon(anel)
            if not poly.is_valid:
                poly = poly.buffer(0)
            original = LineString(anel) if com_corte else None
            for parte in poligonos(poly):
                for q, placa, b, e in placas().recortar(parte):
                    aneis = [list(q.exterior.coords)[:-1]] + [list(h.coords)[:-1] for h in q.interiors if Polygon(h).area > 1e-4]
                    aneis = [a for a in aneis if len(a) >= 3]
                    if not aneis:
                        continue
                    cortes = [trechos_de_corte(a, original) for a in aneis] if com_corte else []
                    c = q.representative_point()
                    b = idade_ilha(c.x, c.y, b)
                    pecas.append([i, placa, b, e, [codificar_linha(a) for a in aneis], cortes])
    print(f"  {len(itens_geom)} itens -> {len(pecas)} peças em {time.time() - t0:.0f}s")
    return pecas


def rotulo(lon, lat):
    placa, b = placa_do_ponto(lon, lat)
    return [round(lon, 2), round(lat, 2), placa, idade_ilha(lon, lat, b)]


def paises():
    print("países")
    itens, geoms = [], []
    for reg, geom in ler_shp("ne_50m_admin_0_countries"):
        nome = reg["NAME_PT"] or reg["NAME"]
        itens.append({
            "n": nome, "c": reg["ADM0_A3"], "ct": CONTINENTES.get(reg["CONTINENT"], reg["CONTINENT"]),
            "mc": reg["MAPCOLOR7"], "lr": reg["LABELRANK"],
            "l": rotulo(reg["LABEL_X"], reg["LABEL_Y"]), "a": round(geom.area, 1),
        })
        geoms.append(geom)
    pecas = processar(geoms, 0.03, 0.004)
    return itens, pecas


def estados():
    print("estados")
    itens, geoms = [], []
    uniao_regioes = defaultdict(list)
    for reg, geom in ler_shp("ne_10m_admin_1_states_provinces"):
        if reg["adm0_a3"] not in ESTADOS_DE:
            continue
        regiao = regiao_do_estado(reg)
        if regiao == "?":
            print("  sem região:", reg["adm0_a3"], reg["name"])
        itens.append({
            "n": reg["name"], "s": reg["postal"] or reg["abbrev"], "p": reg["adm0_a3"], "rg": regiao,
            "l": rotulo(reg["longitude"], reg["latitude"]), "a": round(geom.area, 2),
        })
        geoms.append(geom)
        uniao_regioes[(reg["adm0_a3"], regiao)].append(geom.simplify(0.05))
    pecas = processar(geoms, 0.04, 0.004)
    regioes = []
    for (pais, nome), gs in uniao_regioes.items():
        partes = unir_linha_de_data(unary_union([g.buffer(0) for g in gs]))
        maior = max(partes, key=lambda p: p.area)
        pt = maior.representative_point()
        lon = pt.x - 360 if pt.x > 180 else pt.x
        regioes.append({"n": nome, "p": pais, "l": rotulo(lon, pt.y)})
    return itens, pecas, regioes


def crosta_continental():
    """Polígonos de crosta continental do modelo (inclui plataformas submersas)."""
    print("crosta continental")
    fc = pygplates.FeatureCollection(str(MODELO / "ContinentalPolygons" / "shapes_continents.gpmlz"))
    pecas = []
    for f in fc:
        b, e = f.get_valid_time()
        placa = f.get_reconstruction_plate_id()
        for g in f.get_geometries():
            if not isinstance(g, pygplates.PolygonOnSphere):
                continue
            anel = desembrulhar([(lon, lat) for lat, lon in (p.to_lat_lon() for p in g.get_exterior_ring_points())])
            p = Polygon(anel)
            if not p.is_valid:
                p = p.buffer(0)
            for q in poligonos(p.simplify(0.08, preserve_topology=True)):
                if q.area < 0.05:
                    continue
                pecas.append([placa, idade(b), idade(e), [codificar_linha(list(q.exterior.coords)[:-1])]])
    return pecas


def plataformas_expostas():
    """Plataforma continental rasa (0 a 200 m de profundidade). Fica exposta quando o mar
    baixa ~120 m nas glaciações: Beríngia, Sunda, Sahul, Doggerland..."""
    print("plataformas (nível do mar baixo)")
    agua = unary_union([shapely.make_valid(g) for _, g in ler_shp("ne_10m_bathymetry_L_0")])
    fundo = unary_union([shapely.make_valid(g) for _, g in ler_shp("ne_10m_bathymetry_K_200")])
    raso = agua.difference(fundo).simplify(0.04)
    geoms = [p for p in poligonos(raso) if p.area > 0.03]
    print(f"  {len(geoms)} polígonos de plataforma, área {sum(p.area for p in geoms):.0f} graus²")
    pecas = processar(geoms, 0.06, 0.03, com_corte=False)
    return [p[1:5] for p in pecas]


def main():
    itens_p, pecas_p = paises()
    itens_e, pecas_e, regioes = estados()
    crosta = crosta_continental()
    raso = plataformas_expostas()

    placas = set()
    for p in pecas_p + pecas_e:
        placas.add(p[1])
    for p in crosta + raso:
        placas.add(p[0])
    for it in itens_p + itens_e + regioes:
        placas.add(it["l"][2])
    registrar_placas("geo", placas)

    pontos = sum(len(a) for p in pecas_p + pecas_e for a in p[4]) // 2 + sum(len(a) for p in crosta + raso for a in p[3]) // 2
    print(f"total de vértices: {pontos}, placas: {len(placas)}")
    escrever_js("geo", {
        "escala": 100,
        "paises": {"itens": itens_p, "pecas": pecas_p},
        "estados": {"itens": itens_e, "pecas": pecas_e, "nomesPais": NOME_PAIS},
        "regioes": regioes,
        "crosta": crosta,
        "raso": raso,
    })


if __name__ == "__main__":
    main()
