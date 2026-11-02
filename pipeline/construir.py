"""Gera todos os dados do mapa (pasta data/), na ordem certa.

Uso (de dentro da pasta do projeto):
    .venv312/Scripts/python.exe pipeline/construir.py
"""
import runpy
import sys
from pathlib import Path

PASTA = Path(__file__).resolve().parent
sys.path.insert(0, str(PASTA))

# rotacoes.py vem por último: ele junta as placas usadas por todos os outros
for etapa in ("baixar", "geo", "conteudo", "fosseis", "limites", "populacao", "rotacoes"):
    print(f"\n=== {etapa} ===")
    runpy.run_path(str(PASTA / f"{etapa}.py"), run_name="__main__")
