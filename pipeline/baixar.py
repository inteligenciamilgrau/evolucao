"""Baixa os dados brutos usados pelo pipeline.

- Modelo de placas Cao et al. 2024 (1,8 bilhão de anos -> hoje), via plate-model-manager
- Natural Earth: países (1:50m), estados/províncias (1:10m), batimetria de 200 m (1:10m)
- D3 v7 (biblioteca de desenho do mapa), copiada para js/vendor

Uso:  .venv312/Scripts/python.exe pipeline/baixar.py
"""
import io
import zipfile
from pathlib import Path

import requests

RAIZ = Path(__file__).resolve().parent.parent
BRUTOS = RAIZ / "pipeline" / "brutos"
NE = BRUTOS / "naturalearth"

NATURAL_EARTH = {
    "ne_50m_admin_0_countries": "https://naciscdn.org/naturalearth/50m/cultural/ne_50m_admin_0_countries.zip",
    "ne_10m_admin_1_states_provinces": "https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_1_states_provinces.zip",
    "ne_10m_bathymetry_L_0": "https://naciscdn.org/naturalearth/10m/physical/ne_10m_bathymetry_L_0.zip",
    "ne_10m_bathymetry_K_200": "https://naciscdn.org/naturalearth/10m/physical/ne_10m_bathymetry_K_200.zip",
    "ne_50m_rivers_lake_centerlines": "https://naciscdn.org/naturalearth/50m/physical/ne_50m_rivers_lake_centerlines.zip",
}

D3_URL = "https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js"


def baixar_natural_earth():
    NE.mkdir(parents=True, exist_ok=True)
    for nome, url in NATURAL_EARTH.items():
        if (NE / f"{nome}.shp").exists():
            print("ok (já existe):", nome)
            continue
        print("baixando", nome)
        r = requests.get(url, timeout=300, headers={"User-Agent": "evolucao-pipeline"})
        r.raise_for_status()
        with zipfile.ZipFile(io.BytesIO(r.content)) as z:
            for membro in z.namelist():
                if Path(membro).stem == nome:
                    (NE / Path(membro).name).write_bytes(z.read(membro))


def baixar_modelo():
    from plate_model_manager import PlateModelManager

    m = PlateModelManager().get_model("cao2024", data_dir=str(BRUTOS / "modelos"))
    for camada in ("StaticPolygons", "Coastlines", "ContinentalPolygons", "Topologies"):
        m.get_layer(camada)
    m.get_rotation_model()
    print("ok: modelo cao2024")


def baixar_d3():
    destino = RAIZ / "js" / "vendor" / "d3.min.js"
    if destino.exists():
        return
    r = requests.get(D3_URL, timeout=120)
    r.raise_for_status()
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_bytes(r.content)
    print("ok: d3")


if __name__ == "__main__":
    baixar_modelo()
    baixar_natural_earth()
    baixar_d3()
