"""Limites de placas (dorsais, zonas de subducção, falhas transformantes, riftes) em
instantâneos ao longo do tempo, resolvidos com as topologias do modelo Cao 2024.

Saída: data/limites.js
"""
import time
from collections import Counter

import pygplates
from shapely.geometry import LineString

from comum import MODELO, codificar_linha, desembrulhar, escrever_js, modelo_rotacao

TEMPOS = list(range(0, 250, 5)) + list(range(250, 1801, 10))

TIPOS = {
    "MidOceanRidge": "d",  # dorsal (as placas se afastam)
    "SubductionZone": "s",  # subducção (uma placa mergulha sob a outra)
    "Transform": "t",  # transformante (deslizam lado a lado)
    "ContinentalRift": "r",  # rifte (continente rasgando)
}


def main():
    arquivos = sorted(str(p) for p in (MODELO / "Topologies").glob("*.gpml*"))
    t0 = time.time()
    modelo = pygplates.TopologicalModel([pygplates.FeatureCollection(a) for a in arquivos], modelo_rotacao())
    print(f"topologias carregadas em {time.time() - t0:.0f}s")
    instantes = []
    contagem = Counter()
    for t in TEMPOS:
        snap = modelo.topological_snapshot(float(t))
        linhas = []
        for secao in snap.get_resolved_topological_sections():
            f = secao.get_topological_section_feature()
            nome_tipo = f.get_feature_type().get_name()
            tipo = TIPOS.get(nome_tipo, "o")
            contagem[nome_tipo] += 1
            pol = 0
            if tipo == "s":
                p = f.get_enumeration(pygplates.PropertyName.gpml_subduction_polarity, "Unknown")
                pol = 1 if p == "Left" else -1 if p == "Right" else 0
            for seg in secao.get_shared_sub_segments():
                g = seg.get_resolved_geometry()
                pts = desembrulhar([(lon, lat) for lat, lon in (p.to_lat_lon() for p in g.get_points())])
                if len(pts) < 2:
                    continue
                s = LineString(pts).simplify(0.25)
                coords = list(s.coords)
                if len(coords) < 2:
                    continue
                linhas.append([tipo, pol, codificar_linha(coords, escala=10)])
        instantes.append(linhas)
        if t % 100 == 0:
            print(f"  {t} Ma: {len(linhas)} trechos ({time.time() - t0:.0f}s)")
    print("tipos encontrados:", contagem.most_common(12))
    escrever_js("limites", {"tempos": TEMPOS, "escala": 10, "instantes": instantes})


if __name__ == "__main__":
    main()
