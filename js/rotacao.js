/* Reconstrução de placas tectônicas no navegador.
 * Lê a tabela de quatérnions (data/rotacoes.js) e gira pontos da posição atual
 * para a posição que tinham há t milhões de anos. */
(function () {
  const EVO = (window.EVO = window.EVO || {});
  const RAD = Math.PI / 180;

  let tempos = [];
  let escala = 32766;
  const tabelas = new Map(); // placa -> Int16Array [x,y,z, x,y,z, ...]
  const cache = new Map(); // placa -> quatérnion no tempo atual (ou null)
  let tempoAtual = 0;
  let indice = 0;
  let fracao = 0;

  function decodificar(b64) {
    const bin = atob(b64);
    const n = bin.length >> 1;
    const saida = new Int16Array(n);
    for (let i = 0; i < n; i++) {
      saida[i] = ((bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8)) << 16) >> 16;
    }
    return saida;
  }

  function iniciar(dados) {
    tempos = dados.tempos;
    escala = dados.escala;
    for (const [placa, b64] of Object.entries(dados.placas)) tabelas.set(+placa, decodificar(b64));
    definirTempo(0);
  }

  function definirTempo(t) {
    t = Math.max(0, Math.min(tempos[tempos.length - 1], t));
    tempoAtual = t;
    let lo = 0;
    let hi = tempos.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (tempos[m] <= t) lo = m;
      else hi = m;
    }
    indice = lo;
    fracao = hi === lo ? 0 : (t - tempos[lo]) / (tempos[hi] - tempos[lo]);
    if (fracao >= 1) { indice = hi; fracao = 0; }
    cache.clear();
  }

  function lerQuat(tab, i) {
    const x = tab[3 * i];
    if (x === 32767 && tab[3 * i + 1] === 32767) return null;
    const qx = x / escala;
    const qy = tab[3 * i + 1] / escala;
    const qz = tab[3 * i + 2] / escala;
    const w = Math.sqrt(Math.max(0, 1 - qx * qx - qy * qy - qz * qz));
    return [w, qx, qy, qz];
  }

  function slerp(a, b, f) {
    let dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
    let s = 1;
    if (dot < 0) { dot = -dot; s = -1; }
    let k0, k1;
    if (dot > 0.9995) {
      k0 = 1 - f;
      k1 = f;
    } else {
      const th = Math.acos(dot);
      const sn = Math.sin(th);
      k0 = Math.sin((1 - f) * th) / sn;
      k1 = Math.sin(f * th) / sn;
    }
    const q = [k0 * a[0] + s * k1 * b[0], k0 * a[1] + s * k1 * b[1], k0 * a[2] + s * k1 * b[2], k0 * a[3] + s * k1 * b[3]];
    const n = Math.hypot(q[0], q[1], q[2], q[3]);
    return [q[0] / n, q[1] / n, q[2] / n, q[3] / n];
  }

  /** Quatérnion [w,x,y,z] da placa no tempo atual, ou null se a placa não existe. */
  function quat(placa) {
    if (cache.has(placa)) return cache.get(placa);
    const tab = tabelas.get(placa);
    let q = null;
    if (placa === 0) q = [1, 0, 0, 0];
    else if (tab) {
      const a = lerQuat(tab, indice);
      const b = fracao > 0 ? lerQuat(tab, indice + 1) : a;
      if (a && b) q = fracao > 0 ? slerp(a, b, fracao) : a;
      else q = a || b;
    }
    cache.set(placa, q);
    return q;
  }

  /** Gira o vetor unitário (x,y,z) pelo quatérnion q; escreve [lon,lat] em saida. */
  function girarXYZ(q, x, y, z, saida) {
    const w = q[0], qx = q[1], qy = q[2], qz = q[3];
    const tx = 2 * (qy * z - qz * y);
    const ty = 2 * (qz * x - qx * z);
    const tz = 2 * (qx * y - qy * x);
    const rx = x + w * tx + (qy * tz - qz * ty);
    const ry = y + w * ty + (qz * tx - qx * tz);
    const rz = z + w * tz + (qx * ty - qy * tx);
    saida[0] = Math.atan2(ry, rx) / RAD;
    saida[1] = Math.asin(Math.max(-1, Math.min(1, rz))) / RAD;
    return saida;
  }

  function paraXYZ(lon, lat) {
    const l = lon * RAD;
    const f = lat * RAD;
    const c = Math.cos(f);
    return [c * Math.cos(l), c * Math.sin(l), Math.sin(f)];
  }

  /** Posição [lon,lat] no tempo atual de um ponto atual (lon,lat) na placa dada. */
  function reconstruir(lon, lat, placa) {
    const q = quat(placa);
    if (!q) return null;
    const v = paraXYZ(lon, lat);
    return girarXYZ(q, v[0], v[1], v[2], [0, 0]);
  }

  EVO.Rotacao = {
    iniciar, definirTempo, quat, girarXYZ, paraXYZ, reconstruir,
    get tempo() { return tempoAtual; },
    get tempoMaximo() { return tempos[tempos.length - 1]; },
  };
})();
