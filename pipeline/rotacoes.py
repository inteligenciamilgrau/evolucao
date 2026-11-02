"""Tabela de rotações das placas para o navegador.

Para cada placa usada por algum dado (geo, fósseis, conteúdo), calcula a rotação total
(placa -> referencial absoluto) em instantes fixos e guarda como quatérnions Int16 em
base64. O navegador interpola (slerp) entre os instantes.

Saída: data/rotacoes.js
"""
import base64
import json
import math

import numpy as np

from comum import CACHE, escrever_js, modelo_rotacao

TEMPOS = list(range(0, 100)) + list(range(100, 1801, 5))
AUSENTE = 32767  # x=y=z=32767 é impossível num quatérnion unitário -> placa não existe


def quaternion(rot):
    if rot.represents_identity_rotation():
        return (1.0, 0.0, 0.0, 0.0)
    lat, lon, ang = rot.get_lat_lon_euler_pole_and_angle_degrees()
    lat, lon, ang = map(math.radians, (lat, lon, ang))
    s = math.sin(ang / 2)
    q = (math.cos(ang / 2), s * math.cos(lat) * math.cos(lon), s * math.cos(lat) * math.sin(lon), s * math.sin(lat))
    return q if q[0] >= 0 else tuple(-c for c in q)


def main():
    placas = set()
    for arq in CACHE.glob("placas_*.json"):
        placas |= set(json.loads(arq.read_text()))
    placas.discard(0)
    placas = sorted(placas)
    modelo = modelo_rotacao()
    tabela = {}
    for pid in placas:
        dados = np.empty((len(TEMPOS), 3), dtype="<i2")
        for i, t in enumerate(TEMPOS):
            rot = modelo.get_rotation(float(t), pid, anchor_plate_id=0, use_identity_for_missing_plate_ids=False)
            if rot is None:
                dados[i] = AUSENTE
            else:
                _, x, y, z = quaternion(rot)
                dados[i] = [round(x * 32766), round(y * 32766), round(z * 32766)]
        tabela[pid] = base64.b64encode(dados.tobytes()).decode("ascii")
    print(f"{len(placas)} placas x {len(TEMPOS)} instantes")
    escrever_js("rotacoes", {"tempos": TEMPOS, "escala": 32766, "placas": tabela})


if __name__ == "__main__":
    main()
