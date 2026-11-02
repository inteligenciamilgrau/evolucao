/* Peças de geografia que viajam com as placas.
 * Cada peça: anel de vértices (posição atual, como vetores 3D), placa, idade da crosta.
 * A cada quadro, as peças visíveis são giradas e montadas em objetos GeoJSON que o D3
 * desenha (os arrays de coordenadas são reaproveitados para não gerar lixo). */
(function () {
  const EVO = (window.EVO = window.EVO || {});
  const R = () => EVO.Rotacao;

  function decodificar(deltas, escala) {
    const n = deltas.length >> 1;
    const pts = new Array(n);
    let x = 0, y = 0;
    for (let i = 0; i < n; i++) {
      x += deltas[2 * i];
      y += deltas[2 * i + 1];
      pts[i] = [x / escala, y / escala];
    }
    return pts;
  }

  /** Prepara um anel: tira o ponto repetido, acerta o sentido (D3: externo horário,
   *  buraco anti-horário) e marca os segmentos de corte (sem contorno). */
  function prepararAnel(deltas, escala, cortes, buraco) {
    const anel = decodificar(deltas, escala);
    const a = anel[0], b = anel[anel.length - 1];
    if (a[0] === b[0] && a[1] === b[1]) anel.pop();
    const n = anel.length;
    let corte = null;
    if (cortes && cortes.length) {
      corte = new Uint8Array(n);
      for (let i = 0; i < cortes.length; i += 2) for (let k = 0; k < cortes[i + 1]; k++) corte[(cortes[i] + k) % n] = 1;
    }
    const grande = d3.geoArea({ type: "Polygon", coordinates: [anel.concat([anel[0]])] }) > 2 * Math.PI;
    if (grande !== !!buraco) {
      anel.reverse();
      if (corte) {
        const c2 = new Uint8Array(n);
        for (let i = 0; i < n; i++) c2[(n - 2 - i + n) % n] = corte[i];
        corte = c2;
      }
    }
    return { anel, corte, n };
  }

  /** Cria uma peça: aneis = [externo, buracos...] codificados; cortes = um por anel. */
  function criarPeca(placa, inicio, fim, aneis, escala, cortes, extra) {
    const prep = aneis.map((d, j) => prepararAnel(d, escala, cortes && cortes[j], j > 0));
    const total = prep.reduce((s, r) => s + r.n, 0);
    const xyz = new Float64Array(3 * total);
    const coords = [];
    const linhas = [];
    let o = 0;
    for (const { anel, corte, n } of prep) {
      const c = anel.map((pt) => {
        const v = R().paraXYZ(pt[0], pt[1]);
        xyz[o++] = v[0]; xyz[o++] = v[1]; xyz[o++] = v[2];
        return [pt[0], pt[1]];
      });
      c.push(c[0]); // GeoJSON repete o primeiro ponto (mesmo objeto: atualiza junto)
      coords.push(c);
      if (!corte) { linhas.push(c); continue; }
      // trechos contínuos que pertencem à fronteira original
      const ini = corte.indexOf(1);
      let atual = null;
      for (let k = 0; k < n; k++) {
        const i = (ini + 1 + k) % n;
        if (corte[i]) { atual = null; continue; }
        if (!atual) { atual = [c[i]]; linhas.push(atual); }
        atual.push(c[i + 1]);
      }
    }
    const poli = { type: "Polygon", coordinates: coords };
    return Object.assign({ placa, inicio, fim, total, xyz, coords, linhas, poli, visivel: false }, extra || {});
  }

  /** Gira as peças para o tempo atual. Retorna as visíveis. */
  function atualizar(pecas, t) {
    const vis = [];
    const g = R().girarXYZ;
    for (const p of pecas) {
      p.visivel = false;
      if (t > p.inicio + 1e-9 || t < p.fim - 1e-9) continue;
      const q = R().quat(p.placa);
      if (!q) continue;
      const xyz = p.xyz;
      let i = 0;
      let cruza = false; // atravessa a linha de data (ou contorna um polo)?
      let x0 = 999, x1 = -999, y0 = 999, y1 = -999; // caixa (para achar a peça sob o mouse)
      for (const c of p.coords) {
        for (let k = 0; k < c.length - 1; k++, i++) {
          const pt = g(q, xyz[3 * i], xyz[3 * i + 1], xyz[3 * i + 2], c[k]);
          if (k && Math.abs(pt[0] - c[k - 1][0]) > 180) cruza = true;
          if (pt[0] < x0) x0 = pt[0];
          if (pt[0] > x1) x1 = pt[0];
          if (pt[1] < y0) y0 = pt[1];
          if (pt[1] > y1) y1 = pt[1];
        }
        if (Math.abs(c[0][0] - c[c.length - 2][0]) > 180) cruza = true;
      }
      p.cruza = cruza;
      p.caixa = [x0, y0, x1, y1];
      p.visivel = true;
      vis.push(p);
    }
    return vis;
  }

  /** MultiPolygon com os anéis das peças dadas (reaproveita o objeto). */
  function multiPoligono(pecas, alvo) {
    alvo = alvo || { type: "MultiPolygon", coordinates: [] };
    alvo.coordinates.length = 0;
    for (const p of pecas) alvo.coordinates.push(p.coords);
    return alvo;
  }

  function multiLinha(pecas, alvo) {
    alvo = alvo || { type: "MultiLineString", coordinates: [] };
    alvo.coordinates.length = 0;
    for (const p of pecas) for (const l of p.linhas) alvo.coordinates.push(l);
    return alvo;
  }

  /** Ponto (rótulo, fóssil, sítio) que viaja com a placa: [lon, lat, placa, idadeCrosta]. */
  function posicaoPonto(l) {
    if (EVO.Rotacao.tempo > l[3] + 1e-9) return null;
    return R().reconstruir(l[0], l[1], l[2]);
  }

  EVO.Geometria = { decodificar, criarPeca, atualizar, multiPoligono, multiLinha, posicaoPonto };
})();
