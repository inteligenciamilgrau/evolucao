"""Funções compartilhadas pelo pipeline: caminhos, modelo de placas, codificação dos dados."""
import json
import math
from pathlib import Path

import pygplates

RAIZ = Path(__file__).resolve().parent.parent
BRUTOS = RAIZ / "pipeline" / "brutos"
CACHE = RAIZ / "pipeline" / "cache"
DADOS = RAIZ / "data"
MODELO = BRUTOS / "modelos" / "cao2024"
NE = BRUTOS / "naturalearth"

IDADE_MAXIMA = 4600  # "desde sempre" (idade da Terra, em milhões de anos)

_rotacao = None
_particionador = None


def modelo_rotacao():
    global _rotacao
    if _rotacao is None:
        arquivos = sorted(str(p) for p in (MODELO / "Rotations").glob("*.rot"))
        _rotacao = pygplates.RotationModel(arquivos)
    return _rotacao


def poligonos_estaticos():
    return pygplates.FeatureCollection(str(MODELO / "StaticPolygons" / "static_polygons.gpmlz"))


def particionador():
    global _particionador
    if _particionador is None:
        _particionador = pygplates.PlatePartitioner(poligonos_estaticos(), modelo_rotacao())
    return _particionador


def idade(t):
    """Normaliza um tempo do GPlates (pode ser infinito) para milhões de anos."""
    if t is None or t == float("inf") or t > IDADE_MAXIMA:
        return IDADE_MAXIMA
    if t == float("-inf") or t < 0:
        return 0
    return round(t, 1)


def placa_do_ponto(lon, lat):
    """Retorna (id_da_placa, idade_da_crosta) do ponto, na posição atual."""
    rg = particionador().partition_point(pygplates.PointOnSphere(lat, lon))
    if rg is None:
        return 0, IDADE_MAXIMA
    f = rg.get_feature() if hasattr(rg, "get_feature") else rg
    b, _ = f.get_valid_time()
    return f.get_reconstruction_plate_id(), idade(b)


def codificar_linha(pontos, escala=100):
    """[(lon, lat), ...] -> inteiros com delta (0,01° de precisão por padrão)."""
    saida = []
    px = py = 0
    for lon, lat in pontos:
        x = round(lon * escala)
        y = round(lat * escala)
        saida.append(x - px)
        saida.append(y - py)
        px, py = x, y
    return saida


def desembrulhar(pontos):
    """Torna as longitudes contínuas (sem saltos de 360° na linha de data)."""
    if not pontos:
        return pontos
    saida = [pontos[0]]
    deslocamento = 0.0
    for (lon0, _), (lon, lat) in zip(pontos, pontos[1:]):
        d = lon - lon0
        if d > 180:
            deslocamento -= 360
        elif d < -180:
            deslocamento += 360
        saida.append((lon + deslocamento, lat))
    return saida


def escrever_js(nome, objeto):
    """Grava data/<nome>.js como script clássico (funciona abrindo o index.html direto)."""
    DADOS.mkdir(parents=True, exist_ok=True)
    texto = json.dumps(objeto, ensure_ascii=False, separators=(",", ":"))
    destino = DADOS / f"{nome}.js"
    destino.write_text(
        f"window.EVO_DADOS=window.EVO_DADOS||{{}};EVO_DADOS[{json.dumps(nome)}]={texto};\n",
        encoding="utf-8",
    )
    print(f"gravado {destino.relative_to(RAIZ)}  ({destino.stat().st_size / 1024:.0f} KB)")


def registrar_placas(nome, placas):
    """Guarda as placas usadas por um conjunto de dados; rotacoes.py junta todas."""
    CACHE.mkdir(parents=True, exist_ok=True)
    (CACHE / f"placas_{nome}.json").write_text(json.dumps(sorted(int(p) for p in placas)))


def distancia_graus(lon1, lat1, lon2, lat2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dl = math.radians(lon2 - lon1)
    c = math.sin(p1) * math.sin(p2) + math.cos(p1) * math.cos(p2) * math.cos(dl)
    return math.degrees(math.acos(max(-1.0, min(1.0, c))))
