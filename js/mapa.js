/* Mapa 2D (projeção Equal Earth, de áreas iguais) desenhado em canvas.
 * Ordem das camadas: oceano > gelo marinho > crosta continental > plataformas expostas >
 * terra (vegetação ou países) > gelo > estados > fronteiras > limites de placas >
 * grade de paleolatitude > camadas extras (fósseis, rotas) > nomes. */
(function () {
  const EVO = (window.EVO = window.EVO || {});
  const G = () => EVO.Geometria;

  let canvas, ctx, W = 0, H = 0, DPR = 1;
  let proj, projSuave, caminho, caminhoRapido;
  const base = { s: 1, tx: 0, ty: 0 };
  let zt = d3.zoomIdentity;
  let zoom, selecao;
  let estado;
  let pedido = false;
  let ultimoTempo = null;

  const pecas = { paises: [], estados: [], crosta: [], raso: [] };
  const vis = { paises: [], estados: [], crosta: [], raso: [] };
  let itensPaises = [], itensEstados = [], regioes = [], nomesPais = {};
  let limites = null;
  const limitesCache = new Map();
  const extras = [];

  const CORES_PAIS = ["#d9a66b", "#a3c47a", "#e3c86d", "#7fb3a6", "#c98f8f", "#9fa8d6", "#c7a6d9"];
  const CORES_REGIAO = {
    Norte: "#6fbf73", Nordeste: "#e8b04b", "Centro-Oeste": "#d98c5f", Sudeste: "#6fa8dc", Sul: "#b48ad9",
    Oeste: "#d98c5f", "Meio-Oeste": "#e8b04b", Leste: "#6fa8dc", "Centro-Sul": "#6fbf73", Sudoeste: "#d9768a",
    Noroeste: "#c9b458", Central: "#6fa8dc", Urais: "#b48ad9", "Sibéria": "#6fbf73", "Extremo Oriente": "#d9768a",
    "Sul e Cáucaso": "#e8b04b", Volga: "#d98c5f",
  };
  const SIGLA_PAIS = { BRA: "BR", USA: "EUA", RUS: "RU", CHN: "CN" };
  const COR_LIMITE = { d: "#ff6b5b", s: "#ffd04a", t: "#6fe3a0", r: "#ff9f43", o: "rgba(200,210,230,.35)" };

  // ------------------------------------------------------------------ carga
  function iniciar(el, est) {
    canvas = el;
    ctx = canvas.getContext("2d");
    estado = est;
    const geo = EVO_DADOS.geo;
    const esc = geo.escala;
    itensPaises = geo.paises.itens;
    itensEstados = geo.estados.itens;
    nomesPais = geo.estados.nomesPais;
    regioes = geo.regioes;
    const ordenar = (lista, itens) => lista.sort((a, b) => itens[b.indice].a - itens[a.indice].a);
    pecas.paises = ordenar(geo.paises.pecas.map(([k, pl, b, e, d, c]) =>
      G().criarPeca(pl, b, e, d, esc, c, { indice: k })), itensPaises);
    pecas.estados = ordenar(geo.estados.pecas.map(([k, pl, b, e, d, c]) =>
      G().criarPeca(pl, b, e, d, esc, c, { indice: k })), itensEstados);
    pecas.crosta = geo.crosta.map(([pl, b, e, d]) => G().criarPeca(pl, b, e, d, esc, null));
    pecas.raso = geo.raso.map(([pl, b, e, d]) => G().criarPeca(pl, b, e, d, esc, null));
    limites = EVO_DADOS.limites || null;

    // duas projeções iguais: a rápida (sem reamostragem) para a geografia, que já tem
    // vértices densos, e a suave para contorno do globo, grade, gelo e limites de placas
    proj = d3.geoEqualEarth().precision(0);
    projSuave = d3.geoEqualEarth();
    caminho = d3.geoPath(projSuave, ctx);
    caminhoRapido = d3.geoPath(proj, ctx);
    zoom = d3.zoom().scaleExtent([1, 24]).on("zoom", (ev) => { zt = ev.transform; aplicarZoom(); pedir(); });
    selecao = d3.select(canvas).call(zoom).on("dblclick.zoom", null);
    new ResizeObserver(redimensionar).observe(canvas);
    redimensionar();
  }

  function redimensionar() {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = r.width;
    H = r.height;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    proj.scale(1).translate([0, 0]).fitExtent([[12, 12], [W - 12, H - 12]], { type: "Sphere" });
    base.s = proj.scale();
    [base.tx, base.ty] = proj.translate();
    zoom.translateExtent([[0, 0], [W, H]]).extent([[0, 0], [W, H]]);
    aplicarZoom();
    pedir();
  }

  function aplicarZoom() {
    proj.scale(base.s * zt.k).translate([base.tx * zt.k + zt.x, base.ty * zt.k + zt.y]);
    projSuave.scale(proj.scale()).translate(proj.translate());
  }

  function irPara(lon, lat, k, ms = 900) {
    if (lon == null) {
      selecao.transition().duration(ms).call(zoom.transform, d3.zoomIdentity);
      return;
    }
    // posição em pixels do ponto com zoom 1
    proj.scale(base.s).translate([base.tx, base.ty]);
    const [x, y] = proj([lon, lat]);
    aplicarZoom();
    const t = d3.zoomIdentity.translate(W / 2 - x * k, H / 2 - y * k).scale(k);
    if (ms) selecao.transition().duration(ms).call(zoom.transform, t);
    else selecao.interrupt().call(zoom.transform, t);
  }

  function zoomPor(f) {
    if (!f) return irPara(null);
    selecao.transition().duration(350).call(zoom.scaleBy, f);
  }

  function pedir() {
    if (pedido) return;
    pedido = true;
    requestAnimationFrame(() => { pedido = false; desenhar(); });
  }

  // ------------------------------------------------------------------ geometria do instante
  function atualizarGeometria(t) {
    const tPos = Math.min(t, EVO.Rotacao.tempoMaximo);
    EVO.Rotacao.definirTempo(tPos);
    const filtro = (lista) => {
      const v = G().atualizar(lista, t);
      // antes da crosta mais antiga conhecida (Hadeano), nada de continentes
      return t > 4031 ? [] : v;
    };
    for (const k of Object.keys(pecas)) {
      if (k === "raso") vis[k] = t < 3 ? filtro(pecas[k]) : [];
      else vis[k] = filtro(pecas[k]);
    }
    ultimoTempo = t;
  }

  function limitesNoTempo(t) {
    if (!limites || t > 1800) return null;
    const ts = limites.tempos;
    let i = 0;
    for (let k = 0; k < ts.length; k++) if (Math.abs(ts[k] - t) < Math.abs(ts[i] - t)) i = k;
    if (!limitesCache.has(i)) {
      const linhas = limites.instantes[i].map(([tipo, pol, d]) => {
        const pts = G().decodificar(d, limites.escala).map(([lon, lat]) => [((lon + 540) % 360) - 180, lat]);
        return { tipo, pol, pts };
      });
      limitesCache.set(i, { t: ts[i], linhas });
    }
    return limitesCache.get(i);
  }

  // ------------------------------------------------------------------ desenho
  function corOceano(t) {
    if (t > 4400) return "#3b1a10";
    if (t > 2400) return "#123a3c"; // oceano rico em ferro, esverdeado
    if (t > 1800) return d3.interpolateRgb("#123a3c", "#123552")((2400 - t) / 600);
    return "#123552";
  }

  function caminhoDe(obj) {
    const p = new Path2D();
    d3.geoPath(proj, p)(obj);
    return p;
  }

  /** Traça peças projetando os vértices direto (rápido). Só as que cruzam a linha de
   *  data passam pelo recorte esférico do D3, que é caro. */
  function tracarPecas(pecas, alvo) {
    let lento = null;
    for (const p of pecas) {
      if (p.cruza) {
        lento = lento || d3.geoPath(proj, alvo);
        lento(p.poli);
        continue;
      }
      for (const c of p.coords) {
        for (let k = 0; k < c.length - 1; k++) {
          const xy = proj(c[k]);
          if (k) alvo.lineTo(xy[0], xy[1]);
          else alvo.moveTo(xy[0], xy[1]);
        }
        // sem closePath(): fill() e clip() já fecham, e closePath() com milhares de
        // sub-caminhos custa ~100x mais no Chrome
      }
    }
    return alvo;
  }

  function preencherPecas(pecas, cor, alfa = 1) {
    if (!pecas.length) return;
    ctx.globalAlpha = alfa;
    ctx.beginPath();
    tracarPecas(pecas, ctx);
    ctx.fillStyle = cor;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function preencher(obj, cor, alfa = 1) {
    ctx.globalAlpha = alfa;
    ctx.beginPath();
    caminho(obj);
    ctx.fillStyle = cor;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function yLat(lat) {
    return proj([0, lat])[1];
  }

  /** Faixas de vegetação por latitude (do equador ao polo), ajustadas pela temperatura
   *  global: em climas quentes as florestas chegam perto dos polos. */
  function faixasBiomas(t) {
    const T = EVO.Clima.temperatura(t);
    const s = Math.max(-1.2, Math.min(1.6, (T - 15) / 8));
    const veg = EVO.Clima.vegetacao(t);
    const campo = EVO.Clima.campos(t);
    const rocha = "#7f6b5d";
    const mistura = (c) => d3.interpolateRgb(rocha, c)(veg);
    const savana = d3.interpolateRgb("#4f8a3c", "#a39d58")(campo);
    const cap = (v) => Math.min(89, v);
    return [
      [cap(11 + 3 * s), mistura("#2f7a3a")], // floresta tropical
      [cap(17 + 3 * s), mistura(savana)], // savana / floresta seca
      [cap(32 + 4 * s), d3.interpolateRgb(rocha, "#c2a46c")(Math.max(0.35, veg))], // desertos subtropicais
      [cap(54 + 12 * s), mistura("#5d8c48")], // temperado
      [cap(64 + 14 * s), mistura("#46694f")], // boreal
      [90, mistura("#8c9a8a")], // tundra
    ];
  }

  /** Degradê vertical com as faixas espelhadas nos dois hemisférios. */
  function gradienteBiomas(t) {
    const faixas = faixasBiomas(t);
    const yN = yLat(90), yS = yLat(-90);
    const gr = ctx.createLinearGradient(0, yN, 0, yS);
    const pos = (lat) => Math.max(0, Math.min(1, (yLat(lat) - yN) / (yS - yN)));
    const mistura = 2.5; // graus de transição entre biomas
    const paradas = [];
    let ini = 0;
    for (const [fim, cor] of faixas) {
      if (fim > ini) paradas.push([ini + (ini ? mistura : 0), fim - (fim < 89 ? mistura : 0), cor]);
      ini = fim;
    }
    for (const [a, b, cor] of paradas) {
      for (const lat of [a, b, -a, -b]) gr.addColorStop(pos(lat), cor);
    }
    return gr;
  }

  /** Terra + vegetação + gelo continental, com UM único traçado dos continentes
   *  (traçar 70 mil vértices é o passo mais caro do quadro). */
  function desenharTerra(t, c) {
    if (!vis.paises.length) return;
    if (c.cores) {
      const grupos = CORES_PAIS.map(() => []);
      for (const p of vis.paises) grupos[(itensPaises[p.indice].mc - 1 + 7) % 7].push(p);
      grupos.forEach((g, i) => preencherPecas(g, CORES_PAIS[i]));
    }
    ctx.beginPath();
    tracarPecas(vis.paises, ctx);
    ctx.save();
    ctx.clip();
    if (!c.cores) {
      ctx.fillStyle = gradienteBiomas(t);
      ctx.fillRect(0, 0, W, H);
    }
    if (c.clima) {
      const g = EVO.Clima.gelo(t);
      ctx.fillStyle = "rgba(244,250,255,.92)";
      if (g.norte < 5 && g.sul < 5) ctx.fillRect(0, 0, W, H);
      else {
        if (g.norte < 90 && t > 2.7) ctx.fillRect(0, 0, W, yLat(g.norte));
        if (g.sul < 90) { const y = yLat(-g.sul); ctx.fillRect(0, y, W, H - y); }
      }
    }
    if (t > 1800) {
      // posições desconhecidas: esmaecer
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = corOceano(t);
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  /** Mantos de gelo das glaciações recentes (Laurentide, Escandinavo...). */
  function desenharMantos(t) {
    if (t > 2.7) return;
    const gl = EVO.Clima.glacial(t);
    for (const m of EVO.Clima.MANTOS) {
      const a = m.fixo ? 0.92 : Math.max(0, (gl - 0.25) / 0.75) * 0.9;
      if (a > 0.02) preencher(m.geo, "#f4faff", a);
    }
  }

  function desenharGeloMarinho(t) {
    const g = EVO.Clima.gelo(t);
    if (g.norte >= 90 && g.sul >= 90) return;
    ctx.save();
    ctx.beginPath();
    caminho({ type: "Sphere" });
    ctx.clip();
    if (g.norte < 5 && g.sul < 5) {
      ctx.fillStyle = "rgba(225,242,255,.82)";
      ctx.fillRect(0, 0, W, H);
    } else {
      ctx.fillStyle = "rgba(225,242,255,.35)";
      const yn = yLat(Math.min(90, g.norte + 6));
      if (g.norte < 84) ctx.fillRect(0, 0, W, yn);
      const ys = yLat(-Math.min(90, g.sul + 4));
      if (g.sul < 86) ctx.fillRect(0, ys, W, H - ys);
    }
    ctx.restore();
  }

  function desenharLimites(t) {
    const snap = limitesNoTempo(t);
    if (!snap) return;
    const porTipo = { d: [], s: [], t: [], r: [], o: [] };
    for (const l of snap.linhas) porTipo[l.tipo].push(l);
    const k = Math.min(2, 0.8 + zt.k * 0.25);
    for (const tipo of ["o", "t", "r", "d", "s"]) {
      const ls = porTipo[tipo];
      if (!ls.length) continue;
      ctx.beginPath();
      caminho({ type: "MultiLineString", coordinates: ls.map((l) => l.pts) });
      ctx.strokeStyle = COR_LIMITE[tipo];
      ctx.lineWidth = (tipo === "d" ? 1.8 : tipo === "s" ? 1.6 : tipo === "o" ? 0.8 : 1.1) * k;
      ctx.setLineDash(tipo === "r" ? [4, 3] : tipo === "o" ? [2, 3] : []);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // "dentes" das zonas de subducção, do lado da placa que fica por cima
    ctx.fillStyle = COR_LIMITE.s;
    const passo = 14, tam = 4.2 * k;
    for (const l of porTipo.s) {
      if (!l.pol) continue;
      let resto = passo / 2;
      let ant = null;
      for (const pt of l.pts) {
        const p = proj(pt);
        if (!p) { ant = null; continue; }
        if (ant) {
          const dx = p[0] - ant[0], dy = p[1] - ant[1];
          const d = Math.hypot(dx, dy);
          if (d > 0 && d < 200) {
            const ux = dx / d, uy = dy / d;
            // normal "à esquerda" no sentido geográfico vira (uy, -ux) na tela (eixo y invertido)
            const nx = uy * l.pol, ny = -ux * l.pol;
            let s = resto;
            while (s < d) {
              const cx = ant[0] + ux * s, cy = ant[1] + uy * s;
              ctx.beginPath();
              ctx.moveTo(cx - ux * tam * 0.6, cy - uy * tam * 0.6);
              ctx.lineTo(cx + ux * tam * 0.6, cy + uy * tam * 0.6);
              ctx.lineTo(cx + nx * tam, cy + ny * tam);
              ctx.fill();
              s += passo;
            }
            resto = s - d;
          }
        }
        ant = p;
      }
    }
  }

  function desenharGrade(t) {
    ctx.save();
    ctx.beginPath();
    caminho(d3.geoGraticule10());
    ctx.strokeStyle = "rgba(160,190,225,.07)";
    ctx.lineWidth = 0.6;
    ctx.stroke();
    const linhas = [
      [0, "Equador", "rgba(255,214,120,.55)", []],
      [23.44, "Trópico", "rgba(255,214,120,.32)", [5, 4]],
      [-23.44, "Trópico", "rgba(255,214,120,.32)", [5, 4]],
      [66.56, "Círculo polar", "rgba(170,220,255,.35)", [2, 4]],
      [-66.56, "Círculo polar", "rgba(170,220,255,.35)", [2, 4]],
    ];
    ctx.font = "10px Segoe UI, sans-serif";
    for (const [lat, nome, cor, traco] of linhas) {
      ctx.beginPath();
      caminho({ type: "LineString", coordinates: d3.range(-180, 181, 2).map((lon) => [lon, lat]) });
      ctx.strokeStyle = cor;
      ctx.lineWidth = lat === 0 ? 1.1 : 0.8;
      ctx.setLineDash(traco);
      ctx.stroke();
      const p = proj([-176, lat]);
      if (p && zt.k < 3) {
        ctx.fillStyle = cor;
        ctx.fillText(nome, p[0] + 4, p[1] - 3);
      }
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------ nomes
  function rotulo(texto, x, y, ocupados, estilo) {
    ctx.font = estilo.fonte;
    const w = ctx.measureText(texto).width;
    const h = estilo.altura;
    const r = [x - w / 2 - 2, y - h / 2 - 1, x + w / 2 + 2, y + h / 2 + 1];
    if (r[0] < 0 || r[2] > W || r[1] < 0 || r[3] > H) return false;
    for (const o of ocupados) if (r[0] < o[2] && r[2] > o[0] && r[1] < o[3] && r[3] > o[1]) return false;
    ocupados.push(r);
    ctx.lineWidth = 3;
    ctx.strokeStyle = estilo.halo;
    ctx.fillStyle = estilo.cor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeText(texto, x, y);
    ctx.fillText(texto, x, y);
    return true;
  }

  function desenharNomes(t, c) {
    const ocupados = [];
    const k = zt.k;
    // supercontinentes e oceanos antigos
    for (const r of EVO.Vida ? EVO.Vida.rotulosPaleo(t) : []) {
      const p = proj(r.pos);
      const oceano = r.tipo === "oceano";
      rotulo(oceano ? r.n.toUpperCase().split("").join(" ") : r.n.toUpperCase(), p[0], p[1], ocupados, {
        fonte: oceano ? "italic 12px Georgia, serif" : "bold 15px Georgia, serif",
        altura: oceano ? 14 : 18,
        cor: oceano ? "rgba(150,200,240,.85)" : "rgba(255,240,210,.95)",
        halo: oceano ? "rgba(10,25,45,.6)" : "rgba(40,25,10,.7)",
      });
    }
    for (const r of EVO.Vida ? EVO.Vida.rotulosPovos(t) : []) {
      const p = proj(r.pos);
      rotulo(r.n, p[0], p[1], ocupados, {
        fonte: "italic 600 12px Georgia, serif", altura: 14,
        cor: r.arcaico ? "#cfd8dc" : "#ffcc80", halo: "rgba(25,15,5,.75)",
      });
    }
    if (!c.nomes || t > 1800) return;
    const estiloRegiao = { fonte: "bold 12px Segoe UI, sans-serif", altura: 14, cor: "#fff", halo: "rgba(0,0,0,.65)" };
    if (c.regioes) {
      for (const r of regioes) {
        const pos = G().posicaoPonto(r.l);
        const p = pos && proj(pos);
        if (p) rotulo(`${r.n} (${SIGLA_PAIS[r.p]})`, p[0], p[1], ocupados, estiloRegiao);
      }
    }
    if (c.estados && k >= 2.2) {
      const estilo = { fonte: "10px Segoe UI, sans-serif", altura: 12, cor: "#f2f2f2", halo: "rgba(0,0,0,.6)" };
      for (const it of itensEstados) {
        const pos = G().posicaoPonto(it.l);
        const p = pos && proj(pos);
        if (p) rotulo(k >= 4 ? it.n : it.s, p[0], p[1], ocupados, estilo);
      }
    }
    const limite = k < 1.5 ? 2 : k < 2.5 ? 3 : k < 4 ? 4 : k < 7 ? 5 : 9;
    const estilo = { fonte: "11px Segoe UI, sans-serif", altura: 13, cor: "#fdf6e3", halo: "rgba(20,15,10,.7)" };
    for (const it of itensPaises) {
      if (it.lr > limite) continue;
      const pos = G().posicaoPonto(it.l);
      const p = pos && proj(pos);
      if (p) rotulo(it.n, p[0], p[1], ocupados, estilo);
    }
  }

  // ------------------------------------------------------------------ quadro
  const medidas = { quadros: 0, ms: 0, etapas: {} };
  let marcaT = 0;
  const marca = (nome) => { const a = performance.now(); medidas.etapas[nome] = Math.round((a - marcaT) * 10) / 10; marcaT = a; };
  function desenhar() {
    if (!W) return;
    const t0 = performance.now();
    desenharQuadro();
    medidas.quadros++;
    medidas.ms = performance.now() - t0;
  }

  function desenharQuadro() {
    const t = estado.tempo;
    const c = estado.camadas;
    marcaT = performance.now();
    if (t !== ultimoTempo) atualizarGeometria(t);
    marca("girar");
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);

    preencher({ type: "Sphere" }, corOceano(t));
    if (t > 4400) {
      ctx.save();
      ctx.beginPath(); caminho({ type: "Sphere" }); ctx.clip();
      const gr = ctx.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, W / 2);
      gr.addColorStop(0, "rgba(255,140,40,.55)");
      gr.addColorStop(1, "rgba(120,20,0,.2)");
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    if (c.clima) desenharGeloMarinho(t);
    if (c.crosta) preencherPecas(vis.crosta, "#2a5f82", t > 1800 ? 0.35 : 0.75);
    if (c.mar && vis.raso.length) {
      const a = EVO.Clima.glacial(t);
      if (a > 0.02) {
        preencherPecas(vis.raso, "#b9aa7c", 0.85 * a);
      }
    }

    marca("oceano+crosta");
    desenharTerra(t, c);
    marca("terra");
    if (c.clima) desenharMantos(t);
    marca("gelo");

    if (c.regioes && vis.estados.length) {
      const porRegiao = new Map();
      for (const p of vis.estados) {
        const rg = itensEstados[p.indice].rg;
        if (!porRegiao.has(rg)) porRegiao.set(rg, []);
        porRegiao.get(rg).push(p);
      }
      for (const [rg, ps] of porRegiao) preencherPecas(ps, CORES_REGIAO[rg] || "#999", 0.55);
    }
    if ((c.estados || c.regioes) && vis.estados.length) {
      ctx.beginPath();
      caminhoRapido(G().multiLinha(vis.estados));
      ctx.strokeStyle = "rgba(255,255,255,.45)";
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
    if (c.fronteiras && vis.paises.length) {
      ctx.beginPath();
      caminhoRapido(G().multiLinha(vis.paises));
      ctx.strokeStyle = t > 1800 ? "rgba(255,255,255,.25)" : "rgba(255,250,235,.75)";
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }
    marca("estados+fronteiras");
    if (c.limites) desenharLimites(t);
    marca("limites");
    if (c.grade) desenharGrade(t);
    marca("grade");

    // contorno da esfera
    ctx.beginPath();
    caminho({ type: "Sphere" });
    ctx.strokeStyle = "rgba(150,180,215,.35)";
    ctx.lineWidth = 1;
    ctx.stroke();

    for (const e of extras) e.desenhar(ctx, proj, t, zt.k);
    marca("extras");
    desenharNomes(t, c);
    marca("nomes");
  }

  // ------------------------------------------------------------------ interação
  function paisNoPonto(x, y) {
    const ll = proj.invert([x, y]);
    if (!ll || !d3.geoContains({ type: "Sphere" }, ll)) return null;
    const testar = (lista) => {
      for (let i = lista.length - 1; i >= 0; i--) {
        const p = lista[i];
        const c = p.caixa;
        if (!p.cruza && (ll[0] < c[0] || ll[0] > c[2] || ll[1] < c[1] || ll[1] > c[3])) continue;
        if (d3.geoContains(p.poli, ll)) return p;
      }
      return null;
    };
    const estadoP = (estado.camadas.estados || estado.camadas.regioes) ? testar(vis.estados) : null;
    const paisP = testar(vis.paises);
    if (!paisP && !estadoP) return { ll, oceano: true };
    return {
      ll,
      pais: paisP ? itensPaises[paisP.indice] : null,
      placa: (paisP || estadoP).placa,
      idade: (paisP || estadoP).inicio,
      estado: estadoP ? itensEstados[estadoP.indice] : null,
    };
  }

  function escolher(x, y) {
    for (let i = extras.length - 1; i >= 0; i--) {
      const e = extras[i];
      if (!e.escolher) continue;
      const r = e.escolher(x, y, proj);
      if (r) return r;
    }
    return paisNoPonto(x, y);
  }

  EVO.Mapa = {
    iniciar, pedir, irPara, zoomPor, escolher, nomesPais, medidas, desenharAgora: () => { ultimoTempo = null; desenhar(); },
    registrar(extra) { extras.push(extra); extras.sort((a, b) => (a.ordem || 0) - (b.ordem || 0)); pedir(); },
    tracarEsfera(alvo) { d3.geoPath(projSuave, alvo)({ type: "Sphere" }); },
    get projecao() { return proj; },
    get zoom() { return zt.k; },
    get canvas() { return canvas; },
    get tamanho() { return [W, H]; },
    coresRegiao: CORES_REGIAO,
    coresLimite: COR_LIMITE,
  };
})();
