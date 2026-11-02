/* Ocupação humana: densidade de população numa grade de 0,5°.
 * 1850–2021: grades do ISIMIP (HYDE). 10.000 a.C.–1850: totais por país (Our World in
 * Data / HYDE 3.3) distribuídos pelo padrão de cada país. Antes: só onde os sapiens já
 * tinham chegado, com densidade de caçadores-coletores (maior onde a terra é mais rica,
 * crescendo aos poucos depois da chegada). De 9.000 a 5.000 a.C., com a agricultura, um
 * padrão vira o outro (os totais por país do começo do Holoceno são modelos muito incertos
 * e põem quase metade da humanidade nas Américas em 10.000 a.C.).
 * O desenho usa uma imagem 720x360 (lon x lat) copiada linha a linha: na projeção
 * Equal Earth cada paralelo é uma linha reta horizontal. */
(function () {
  const EVO = (window.EVO = window.EVO || {});
  const E = () => EVO.Escala;

  const LARG = 720, ALT = 360;
  const RAMPA = 0.004; // depois de chegar, um grupo leva ~4 mil anos para encher a região
  const TRANSICAO = [-9000, -5000]; // caçadores-coletores -> totais por país (anos)
  let D, n = 0, app;
  let indice, pais, chegada, r1850, rAntigo, classes, area, popsPais, riqueza;
  let imagem, imgCtx, pixels, dens, auxiliar, camada, tempoCalculado = null;
  let chegadas = []; // idade de chegada (Ma) de cada regra, já com os ajustes dos debates
  let americas = new Set(), iBrasil = -1, fatorBrasil = 1, fatorOutros = 1;
  let nucleoDaCelula = null; // núcleo de ocupação de cada célula (bolinhas do especial hominídeos)
  const LUT = [];

  function decodificar(b64, Tipo) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Tipo(bytes.buffer);
  }

  function iniciar(a) {
    app = a;
    D = EVO_DADOS.populacao;
    if (!D) return;
    const deltas = decodificar(D.celulas, Uint16Array);
    n = deltas.length;
    indice = new Uint32Array(n);
    let acc = 0;
    for (let i = 0; i < n; i++) { acc += deltas[i]; indice[i] = acc; }
    pais = decodificar(D.pais, Uint8Array);
    chegada = decodificar(D.chegada, Uint8Array);
    nucleoDaCelula = D.nucleo ? decodificar(D.nucleo, Uint8Array) : null;
    const decodR = (b64) => Float32Array.from(decodificar(b64, Uint8Array), (e) => (e ? Math.pow(2, e / 10 - 12) : 0));
    r1850 = decodR(D.r1850);
    rAntigo = decodR(D.rAntigo);
    classes = D.grade.classes.map((c) => decodificar(c, Uint8Array));
    area = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const lat = 89.75 - 0.5 * Math.floor(indice[i] / LARG);
      const rad = Math.PI / 180;
      area[i] = 6371 * 6371 * 0.5 * rad * Math.abs(Math.sin((lat + 0.25) * rad) - Math.sin((lat - 0.25) * rad));
    }
    popsPais = D.paises.map((p) => p.p);
    americas = new Set(D.americas || []);
    iBrasil = D.paises.findIndex((p) => p.c === "BRA");
    // quanto uma região sustenta caçadores-coletores: a densidade de 1850 bem comprimida
    // (tundra e deserto ~25 vezes menos gente que vales e costas ricas)
    riqueza = new Float32Array(n);
    for (let k = 0; k < n; k++) {
      const c = classes[0][k];
      riqueza[k] = c ? Math.max(0.15, Math.min(4, Math.pow(10, 0.35 * ((c - 1) / 40 - 2)))) : 0.15;
    }
    definirAjustes({});
    dens = new Float32Array(n);
    auxiliar = new Float32Array(n);
    imagem = document.createElement("canvas");
    imagem.width = LARG;
    imagem.height = ALT;
    imgCtx = imagem.getContext("2d");
    pixels = imgCtx.createImageData(LARG, ALT);
    // cores: do âmbar transparente (poucos habitantes) ao branco (metrópoles)
    const rampa = d3.scaleLinear().domain([0, 0.3, 0.55, 0.8, 1])
      .range(["#8a3b12", "#e8590c", "#ffad1f", "#ffe79a", "#ffffff"]).clamp(true);
    for (let k = 0; k < 256; k++) {
      const u = k / 255;
      const c = d3.rgb(rampa(u));
      // pouca gente quase transparente; só as regiões densas brilham
      LUT.push([c.r, c.g, c.b, Math.round(255 * Math.min(0.92, 0.04 + 0.9 * Math.pow(u, 1.5)))]);
    }
    EVO.Mapa.registrar({ ordem: 5, desenhar, escolher });
  }

  const ano = (t) => E().ANO - t * 1e6;

  /** Ajustes vindos dos debates: {chegada: {regiao: Ma}, americas1500, brasil1500: pessoas}.
   *  A data de uma região desloca todas as regras dela juntas (mantém a ordem interna). */
  function definirAjustes(aj) {
    const porRegiao = (aj && aj.chegada) || {};
    const referencia = {};
    for (const [regiao, idade] of D.regras) referencia[regiao] = Math.max(referencia[regiao] || 0, idade);
    chegadas = D.regras.map(([regiao, idade]) =>
      regiao in porRegiao ? Math.max(0.0001, idade + (porRegiao[regiao] - referencia[regiao])) : idade);
    // população das Américas em 1500: total e Brasil (os outros países completam o total)
    const baseBr = iBrasil >= 0 ? interpLog(D.anosPaises, popsPais[iBrasil], 1500) : 0;
    const baseTotal = populacaoAmericas1500();
    const alvoBr = (aj && aj.brasil1500) || baseBr;
    const alvoTotal = (aj && aj.americas1500) || baseTotal - baseBr + alvoBr;
    fatorBrasil = baseBr > 0 ? alvoBr / baseBr : 1;
    fatorOutros = Math.max(0.01, (alvoTotal - alvoBr) / (baseTotal - baseBr));
    tempoCalculado = null;
  }

  /** Fator de um país no ano y (só muda as Américas antes da conquista). */
  function fatorPais(j, y) {
    if (!americas.has(j)) return 1;
    return fatorAmericasNoAno(j === iBrasil ? fatorBrasil : fatorOutros, y);
  }

  /** Fator do debate até 1500, sumindo até 1650 (quando as epidemias já tinham agido). */
  function fatorAmericasNoAno(fator, y) {
    if (fator === 1 || y >= 1650) return 1;
    if (y <= 1500) return fator;
    return Math.exp(Math.log(fator) * (1650 - y) / 150);
  }

  function populacaoAmericas1500() {
    let soma = 0;
    for (const j of americas) soma += interpLog(D.anosPaises, popsPais[j], 1500);
    return soma;
  }

  function interpLog(xs, ys, x) {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
    let i = 1;
    while (xs[i] < x) i++;
    const f = (x - xs[i - 1]) / (xs[i] - xs[i - 1]);
    const a = ys[i - 1], b = ys[i];
    return a > 0 && b > 0 ? Math.exp(Math.log(a) * (1 - f) + Math.log(b) * f) : a + (b - a) * f;
  }

  /** Totais por país (ano y) espalhados pelo padrão de cada país, onde já há gente em t. */
  function padraoPaises(y, t, saida) {
    const anos = D.anosPaises;
    const porPais = popsPais.map((p, j) => (interpLog(anos, p, y) * fatorPais(j, y)) / D.paises[j].a);
    const mistura = Math.max(0, Math.min(1, (y - 1500) / 350)); // padrão antigo -> 1850
    for (let k = 0; k < n; k++) {
      if (t > chegadas[chegada[k]] + 1e-9) { saida[k] = 0; continue; }
      const r = rAntigo[k] + (r1850[k] - rAntigo[k]) * mistura;
      saida[k] = porPais[pais[k]] * r;
    }
  }

  /** Caçadores-coletores: mais gente onde a terra é rica; quem acabou de chegar ainda é pouco. */
  function padraoCacadores(t, saida) {
    for (let k = 0; k < n; k++) {
      const desde = chegadas[chegada[k]] - t;
      saida[k] = desde < -1e-9 ? 0 : riqueza[k] * Math.max(0.1, Math.min(1, desde / RAMPA));
    }
  }

  /** Ajusta o padrão para somar `total` pessoas. */
  function escalar(v, total) {
    let s = 0;
    for (let k = 0; k < n; k++) s += v[k] * area[k];
    const f = s > 0 ? total / s : 0;
    for (let k = 0; k < n; k++) v[k] *= f;
  }

  /** Densidade (hab/km²) de cada célula no tempo t. */
  function calcular(t) {
    if (t === tempoCalculado) return;
    tempoCalculado = t;
    const y = ano(t);
    if (y >= 1850) {
      const anos = D.grade.anos;
      let i = 1;
      while (i < anos.length - 1 && anos[i] < y) i++;
      const f = Math.max(0, Math.min(1, (y - anos[i - 1]) / (anos[i] - anos[i - 1])));
      const c0 = classes[i - 1], c1 = classes[i];
      for (let k = 0; k < n; k++) {
        const v0 = c0[k] ? (c0[k] - 1) / 40 - 2 : -3, v1 = c1[k] ? (c1[k] - 1) / 40 - 2 : -3;
        const v = v0 + (v1 - v0) * f;
        dens[k] = v > -2.2 ? Math.pow(10, v) : 0;
      }
    } else if (y >= TRANSICAO[1]) {
      padraoPaises(y, t, dens);
    } else {
      const total = mundo(t) || 0;
      padraoCacadores(t, dens);
      escalar(dens, total);
      if (y > TRANSICAO[0]) {
        // o mapa dos caçadores-coletores vira, aos poucos, o dos totais por país
        const f = (y - TRANSICAO[0]) / (TRANSICAO[1] - TRANSICAO[0]);
        padraoPaises(y, t, auxiliar);
        escalar(auxiliar, total);
        for (let k = 0; k < n; k++) dens[k] += (auxiliar[k] - dens[k]) * f;
      }
    }
    // pinta a imagem
    // onde já há gente fica um tom âmbar mínimo (caçadores-coletores são poucos demais para
    // a escala de densidade); ele some aos poucos enquanto o mapa vira "Terra à noite"
    const piso = Math.round(95 * (1 - noite(t)));
    const px = pixels.data;
    px.fill(0);
    for (let k = 0; k < n; k++) {
      const d = dens[k];
      if (!(d > 0) || (d < 0.01 && !piso)) continue;
      const u = d < 0.01 ? 0 : Math.max(0, Math.min(255, Math.round(((Math.log10(d) + 2) / 6.3) * 255)));
      const cor = LUT[u];
      const o = indice[k] * 4;
      if (cor[3] < piso) { px[o] = 255; px[o + 1] = 173; px[o + 2] = 31; px[o + 3] = piso; }
      else { px[o] = cor[0]; px[o + 1] = cor[1]; px[o + 2] = cor[2]; px[o + 3] = cor[3]; }
    }
    imgCtx.putImageData(pixels, 0, 0);
  }

  /** 0 a 1: o quanto o mapa já virou "Terra à noite" (de 12 mil a 6 mil anos atrás). */
  const noite = (t) => Math.max(0, Math.min(1, (0.012 - t) / 0.006));

  function desenhar(ctx, proj, t) {
    if (!D || !app.estado.camadas.populacao || t > 0.32) return;
    calcular(t);
    // aparece aos poucos no começo da história humana
    const alfa = t > 0.25 ? (0.32 - t) / 0.07 : 1;
    ctx.save();
    // "Terra à noite": no Holoceno o mapa escurece e as populações brilham
    const escuro = 0.55 * noite(t);
    if (escuro > 0) {
      ctx.beginPath();
      EVO.Mapa.tracarEsfera(ctx);
      ctx.fillStyle = `rgba(4,8,18,${escuro})`;
      ctx.fill();
    }
    // monta a população projetada numa camada à parte (em pixels do aparelho)
    const W = ctx.canvas.width, H = ctx.canvas.height;
    if (!camada || camada.width !== W || camada.height !== H) {
      camada = document.createElement("canvas");
      camada.width = W;
      camada.height = H;
    }
    const c2 = camada.getContext("2d");
    c2.setTransform(1, 0, 0, 1, 0, 0);
    c2.clearRect(0, 0, W, H);
    c2.setTransform(ctx.getTransform());
    // sem suavização: ela misturaria cada linha com as vizinhas transparentes
    c2.imageSmoothingEnabled = false;
    for (let row = 0; row < ALT; row++) {
      const lat = 89.75 - 0.5 * row;
      const a = proj([-180, lat]), b = proj([180, lat]);
      const yTopo = proj([0, lat + 0.25])[1], yBase = proj([0, lat - 0.25])[1];
      // bordas arredondadas iguais entre linhas vizinhas: sem vão e sem sobreposição
      const y0 = Math.round(yTopo), y1 = Math.round(yBase);
      if (y1 > y0) c2.drawImage(imagem, 0, row, LARG, 1, a[0], y0, b[0] - a[0], y1 - y0);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (escuro > 0) {
      // brilho em volta das regiões densas, como nas fotos noturnas de satélite
      ctx.globalCompositeOperation = "lighter";
      ctx.filter = `blur(${Math.max(2, Math.round(W / 500))}px)`;
      ctx.globalAlpha = Math.min(1, escuro * 1.6) * alfa;
      ctx.drawImage(camada, 0, 0);
      ctx.filter = "none";
      ctx.globalCompositeOperation = "source-over";
    }
    ctx.globalAlpha = 0.92 * alfa;
    ctx.drawImage(camada, 0, 0);
    ctx.restore();
  }

  function celulaEm(lon, lat) {
    const row = Math.floor((90 - lat) / 0.5), col = Math.floor((lon + 180) / 0.5);
    const alvo = row * LARG + col;
    let lo = 0, hi = n - 1;
    while (lo <= hi) {
      const m = (lo + hi) >> 1;
      if (indice[m] === alvo) return m;
      if (indice[m] < alvo) lo = m + 1;
      else hi = m - 1;
    }
    return -1;
  }

  function textoDensidade(d) {
    if (d < 0.1) return "menos de 1 pessoa a cada 10 km²";
    if (d < 1) return `~${Math.round(d * 10)} pessoas a cada 10 km²`;
    return `~${d < 10 ? d.toFixed(1).replace(".", ",") : Math.round(d).toLocaleString("pt-BR")} hab/km²`;
  }

  function escolher(x, y, proj) {
    const t = app.estado.tempo;
    if (!D || !app.estado.camadas.populacao || t > 0.3) return null;
    const ll = proj.invert([x, y]);
    if (!ll) return null;
    const k = celulaEm(ll[0], ll[1]);
    if (k < 0 || !(dens[k] > 0)) return null;
    const p = D.paises[pais[k]];
    const a = ano(t);
    const fonte = a >= 1850 ? "grade ISIMIP/HYDE" : a >= TRANSICAO[1] ? "estimativa pelo total do país"
      : a > TRANSICAO[0] ? "transição: caçadores-coletores → totais por país" : "caçadores-coletores (estimativa)";
    return { html: `<b>${p.n}</b><br>${textoDensidade(dens[k])}<br><span class="sub">${fonte}</span>` };
  }

  /** População mundial estimada no tempo t (pessoas). */
  function mundo(t) {
    if (!D) return null;
    const y = ano(t);
    if (y >= -10000) {
      let total = interpLog(D.mundo.anos, D.mundo.pop, y);
      for (const j of americas) {
        const f = fatorPais(j, y);
        if (f !== 1) total += interpLog(D.anosPaises, popsPais[j], y) * (f - 1);
      }
      return total;
    }
    // [[Ma, pessoas], ...] do mais antigo ao mais recente, emendado no total de 10.000 a.C.
    const pl = D.pleistoceno.concat([[(E().ANO + 10000) / 1e6, interpLog(D.mundo.anos, D.mundo.pop, -10000)]]);
    if (t > pl[0][0]) return null;
    for (let i = 1; i < pl.length; i++) {
      if (t >= pl[i][0]) {
        const f = (pl[i - 1][0] - t) / (pl[i - 1][0] - pl[i][0]);
        return Math.exp(Math.log(pl[i - 1][1]) * (1 - f) + Math.log(pl[i][1]) * f);
      }
    }
    return pl[pl.length - 1][1];
  }

  function textoPopulacao(p) {
    if (p == null) return "";
    const num = (v, casas) => v.toLocaleString("pt-BR", { maximumFractionDigits: casas });
    if (p >= 1e9) return `${num(p / 1e9, 1)} ${p < 2e9 ? "bilhão" : "bilhões"}`;
    if (p >= 0.995e6) {
      const m = p / 1e6;
      return `${num(m, m < 10 ? 1 : 0)} ${m < 1.95 ? "milhão" : "milhões"}`;
    }
    return `${num(Math.round(p / 1e3), 0)} mil`;
  }

  /** Núcleos de ocupação dos sapiens: posição e data de chegada (com os debates). */
  function nucleos() {
    if (!D || !D.nucleos) return [];
    return D.nucleos.map(([lon, lat, regra, n], i) => ({ i, lon, lat, n, chegada: chegadas[regra], regiao: D.regras[regra][0] }));
  }

  /** Pessoas em cada núcleo no tempo t (soma das células, escalada para a população mundial). */
  function populacaoPorNucleo(t) {
    const soma = new Float64Array(D && D.nucleos ? D.nucleos.length : 0);
    if (!soma.length || t > 0.32) return soma;
    calcular(t);
    let total = 0;
    for (let k = 0; k < n; k++) {
      const v = dens[k] * area[k];
      soma[nucleoDaCelula[k]] += v;
      total += v;
    }
    const escala = total > 0 ? (mundo(t) || 0) / total : 0;
    for (let i = 0; i < soma.length; i++) soma[i] *= escala;
    return soma;
  }

  /** Há terra habitável (célula da grade) neste ponto? */
  const temTerra = (lon, lat) => !!D && celulaEm(lon, lat) >= 0;

  EVO.Populacao = { iniciar, mundo, textoPopulacao, definirAjustes, populacaoAmericas1500, nucleos, populacaoPorNucleo, temTerra, noite };
})();
