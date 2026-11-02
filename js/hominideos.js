/* Especial hominídeos: as espécies humanas como populações que vivem, andam e somem.
 *
 * No mapa, para cada espécie:
 *  - núcleos de ocupação: bolinhas com área proporcional à população, que ficam enquanto o
 *    grupo vive na região (aparecem quando ele chega e somem quando sai ou se extingue);
 *  - frentes de expansão: uma bolinha que anda pela rota, deixando um rastro de bolinhas
 *    menores (as regiões que vão sendo ocupadas pelo caminho);
 *  - contornos tracejados com † quando o grupo deixa uma região ou se extingue;
 *  - 🛖 primeiras aldeias e 🌾 centros de agricultura (vida sedentária); 🤝 encontros.
 * Num painel: o gráfico da população de cada espécie ao longo do tempo.
 * Os núcleos dos sapiens vêm da camada de população (mesmas datas de chegada e debates). */
(function () {
  const EVO = (window.EVO = window.EVO || {});
  const E = () => EVO.Escala;
  const R = () => EVO.Rotacao;

  const T_MAX = 7.2; // a camada vale dos primeiros hominíneos até hoje
  const G_MIN = 0.0001; // limite direito do gráfico (100 anos atrás; escala logarítmica)
  const RAD = Math.PI / 180;
  const PASSO_RASTRO = 4 * RAD; // um ponto de rastro a cada ~450 km
  const SEM_RASTRO = new Set(["navio", "forcada"]); // travessias de oceano não deixam rastro
  const REGIOES = {
    africa: "África", levante: "Levante", arabia: "Arábia", oriente_medio: "Oriente Médio", asia_central: "Ásia Central",
    asia_sul: "Sul da Ásia", sudeste_asiatico: "Sudeste Asiático", wallacea: "Wallacea", sahul: "Austrália e Nova Guiné",
    melanesia: "Melanésia", asia_leste: "Ásia Oriental", japao: "Japão", siberia: "Sibéria", artico_siberiano: "Ártico siberiano",
    europa: "Europa", europa_norte: "Norte da Europa", alasca: "Alasca", america_norte: "América do Norte",
    artico_americano: "Ártico americano", america_central: "América Central", america_sul: "América do Sul", brasil: "Brasil",
    caribe: "Caribe", madagascar: "Madagascar", pacifico_remoto: "Polinésia e Micronésia", nova_zelandia: "Nova Zelândia",
    tasmania: "Tasmânia", terra_do_fogo: "Terra do Fogo", islandia: "Islândia e Faroé", canarias: "Canárias",
    pequenas_antilhas: "Pequenas Antilhas", ilhas_mediterraneo: "Ilhas do Mediterrâneo", maldivas: "Maldivas",
    galapagos: "Galápagos", ilhas_remotas: "Ilhas remotas", antartida: "Antártida",
  };

  let app, dados = null, painel, svg, x, y;
  let geometrias = new Map(); // espécie -> [{rota, de, ate, D, ramos:[{amostras}], rastroAte}]
  let alvosTela = [];

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const distancia = (a, b) => d3.geoDistance(a, b);

  function iniciar(a) {
    app = a;
    dados = EVO_DADOS.conteudo.hominideos;
    if (!dados) return;
    painel = document.getElementById("painel-hominideos");
    EVO.Mapa.registrar({ ordem: 1, desenhar: desenharVeu });
    EVO.Mapa.registrar({ ordem: 15, desenhar, escolher });
    painel.querySelector(".fechar").onclick = () => app.definirCamada("hominideos", false);
    new ResizeObserver(() => desenharGrafico()).observe(painel);
    prepararGeometrias();
  }

  // ------------------------------------------------------------------ geometria das expansões
  /** Rotas de uma espécie: as listadas nela e, para os sapiens, todas as migrações humanas
   *  (menos as de `sem_frente`, que não são uma expansão a partir de um ponto). */
  function rotasDa(esp) {
    const ids = new Set(esp.rotas || []);
    const fora = new Set(esp.sem_frente || []);
    return EVO_DADOS.conteudo.rotas.filter((r) => !fora.has(r.id) && (ids.has(r.id) || (esp.rotas_humanas && r.grupo === "sapiens")));
  }

  /** Amostra cada ramo e calcula a distância percorrida desde a origem da rota. Um ramo que
   *  começa num ponto de um ramo anterior continua dali (a frente avança sem saltos). */
  function prepararGeometrias() {
    geometrias = new Map();
    for (const esp of dados.especies) {
      const lista = [];
      for (const r of rotasDa(esp)) {
        const ramos = [];
        let D = 0;
        for (const ramo of r.ramos) {
          const amostras = [];
          let base = 0;
          let melhor = 6 * RAD;
          for (const anterior of ramos) for (const a of anterior.amostras) {
            const d = distancia([a.lon, a.lat], [ramo[0][0], ramo[0][1]]);
            if (d < melhor) { melhor = d; base = a.cum; }
          }
          let cum = base;
          for (let i = 0; i < ramo.length - 1; i++) {
            const p0 = [ramo[i][0], ramo[i][1]], p1 = [ramo[i + 1][0], ramo[i + 1][1]];
            const d = distancia(p0, p1);
            const n = Math.max(1, Math.ceil(d / PASSO_RASTRO));
            const interp = d3.geoInterpolate(p0, p1);
            for (let j = i ? 1 : 0; j <= n; j++) {
              const [lon, lat] = interp(j / n);
              amostras.push({ lon, lat, placa: ramo[j < n / 2 ? i : i + 1][2], cum: cum + d * (j / n) });
            }
            cum += d;
          }
          D = Math.max(D, cum);
          ramos.push({ amostras });
        }
        const deixaRastro = !SEM_RASTRO.has(r.mecanismo);
        for (const ramo of ramos) for (const a of ramo.amostras) {
          a.terra = deixaRastro && (!EVO.Populacao || EVO.Populacao.temTerra(a.lon, a.lat));
          a.chegada = r.de - (D ? a.cum / D : 1) * (r.de - r.ate);
        }
        const rastroAte = esp.rastros && esp.rastros[r.id] != null ? esp.rastros[r.id] : esp.ate;
        lista.push({ rota: r, de: r.de, ate: r.ate, D, ramos, rastroAte });
      }
      geometrias.set(esp.id, lista);
    }
  }

  // ------------------------------------------------------------------ população
  function interpLog(pontos, t) {
    if (!pontos || !pontos.length) return null;
    if (t >= pontos[0][0]) return pontos[0][1];
    for (let i = 1; i < pontos.length; i++) {
      const [t0, n0] = pontos[i - 1], [t1, n1] = pontos[i];
      if (t >= t1) {
        const f = (t0 - t) / (t0 - t1);
        return Math.exp(Math.log(Math.max(n0, 1)) * (1 - f) + Math.log(Math.max(n1, 1)) * f);
      }
    }
    return pontos[pontos.length - 1][1];
  }

  /** Indivíduos vivos estimados da espécie no tempo t (null se não existia). */
  function populacao(esp, t) {
    if (t > esp.de + 1e-9 || t < esp.ate - 1e-9) return null;
    if (esp.pop_mundial) return EVO.Populacao ? EVO.Populacao.mundo(t) : null;
    return interpLog(esp.pop, t);
  }

  function textoPop(n) {
    if (n == null) return "";
    const casas = (v) => ({ maximumFractionDigits: v < 10 ? 1 : 0 });
    if (n >= 1e9) return `~${(n / 1e9).toLocaleString("pt-BR", casas(n / 1e9))} bi`;
    if (n >= 1e6) return `~${(n / 1e6).toLocaleString("pt-BR", casas(n / 1e6))} mi`;
    if (n >= 1e3) return `~${Math.round(n / 1e3).toLocaleString("pt-BR")} mil`;
    return `~${Math.max(50, Math.round(n / 50) * 50)}`;
  }

  /** Raio (px) com área proporcional à população até 20 mil pessoas; acima disso a escala é
   *  comprimida (de 20 mil a 1 bilhão o raio só dobra; senão os sapiens cobririam o mapa). */
  function raio(n, k) {
    const r = n <= 2e4 ? 0.1 * Math.sqrt(n) : 14.14 * Math.pow(n / 2e4, 0.09);
    return Math.max(2.2, Math.min(32, r)) * Math.min(1.8, 0.8 + 0.2 * k);
  }

  /** Bolinhas grandes ficam mais transparentes: onde elas se sobrepõem, o brilho mostra a densidade. */
  const opacidade = (r) => Math.max(0.2, Math.min(0.6, 0.62 - (r - 8) * 0.022));

  // ------------------------------------------------------------------ estado de cada espécie em t
  /** Núcleos com a data de chegada efetiva: se uma frente da espécie passa perto, o núcleo
   *  espera a frente chegar (assim a bolinha nunca aparece "do nada"). */
  function nucleosDa(esp) {
    if (esp._nucleos) return esp._nucleos;
    const frentes = geometrias.get(esp.id) || [];
    const frenteMaisPerto = (lon, lat, aceitar) => {
      let chegada = null, melhor = 8 * RAD;
      for (const g of frentes) for (const ramo of g.ramos) for (const a of ramo.amostras) {
        if (!aceitar(a.chegada)) continue;
        const d = distancia([lon, lat], [a.lon, a.lat]);
        if (d < melhor) { melhor = d; chegada = a.chegada; }
      }
      return chegada;
    };
    if (esp.nucleos_auto) {
      // sapiens: núcleos e datas da camada de população; se a frente que leva o grupo até lá
      // passa um pouco depois, o núcleo espera por ela (só frentes da mesma época: os navios
      // de 1500 não atrasam quem já vivia na costa do Brasil há 13 mil anos)
      esp._nucleos = (EVO.Populacao ? EVO.Populacao.nucleos() : []).map((u) => {
        const frente = frenteMaisPerto(u.lon, u.lat, (c) => c < u.chegada && c >= 0.7 * u.chegada);
        return { lon: u.lon, lat: u.lat, placa: 0, nome: REGIOES[u.regiao] || "", de: frente != null ? frente : u.chegada,
          ate: 0, peso: u.n, auto: u.i };
      });
      return esp._nucleos;
    }
    esp._nucleos = (esp.nucleos || []).map(([lon, lat, placa, , nome, de, ate, peso]) => {
      const chegada = frenteMaisPerto(lon, lat, () => true);
      return { lon, lat, placa, nome, de: chegada != null ? Math.min(de, Math.max(chegada, ate)) : de, ate, peso };
    });
    return esp._nucleos;
  }

  function estado(esp, t) {
    const n = populacao(esp, t);
    const ativos = nucleosDa(esp).filter((u) => t <= u.de + 1e-9 && t >= u.ate - 1e-9);
    const rastros = [];
    const frentes = [];
    for (const g of geometrias.get(esp.id) || []) {
      const emCurso = t <= g.de && t >= g.ate;
      const f = g.de > g.ate ? (g.de - t) / (g.de - g.ate) : 1;
      for (const ramo of g.ramos) {
        for (const a of ramo.amostras) if (a.terra && t <= a.chegada && t >= g.rastroAte - 1e-9) rastros.push(a);
        if (!emCurso) continue;
        const alvo = f * g.D;
        const am = ramo.amostras;
        if (alvo < am[0].cum || alvo > am[am.length - 1].cum) continue;
        let i = 1;
        while (i < am.length - 1 && am[i].cum < alvo) i++;
        const a0 = am[i - 1], a1 = am[i];
        const u = a1.cum > a0.cum ? (alvo - a0.cum) / (a1.cum - a0.cum) : 0;
        const [lon, lat] = d3.geoInterpolate([a0.lon, a0.lat], [a1.lon, a1.lat])(u);
        frentes.push({ lon, lat, placa: a0.placa, cauda: am.slice(Math.max(0, i - 4), i).concat([{ lon, lat }]), rota: g.rota });
      }
    }
    // quanto da população fica em cada núcleo e em cada ponto do rastro
    let partes;
    if (esp.nucleos_auto && n != null) {
      const porNucleo = EVO.Populacao.populacaoPorNucleo(t);
      partes = ativos.map((u) => porNucleo[u.auto] || 0);
    } else {
      const pesoRastro = 0.25;
      const total = ativos.reduce((s, u) => s + u.peso, 0) + rastros.length * pesoRastro;
      partes = ativos.map((u) => (n != null && total ? (n * u.peso) / total : 0));
      for (const a of rastros) a._n = n != null && total ? (n * pesoRastro) / total : 0;
    }
    return { n, ativos, partes, rastros, frentes };
  }

  // ------------------------------------------------------------------ desenho
  function hexAlfa(hex, a) {
    const v = parseInt(hex.slice(1), 16);
    return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${a})`;
  }

  const pos = (u) => R().reconstruir(u.lon, u.lat, u.placa || 0);

  function circulo(ctx, px, py, r, cor, alfa, contorno) {
    ctx.beginPath();
    ctx.arc(px, py, r, 0, 6.2832);
    ctx.fillStyle = hexAlfa(cor, alfa);
    ctx.fill();
    // contorno escuro por fora e colorido por dentro: a bolinha se destaca em qualquer fundo
    ctx.lineWidth = 3.4;
    ctx.strokeStyle = `rgba(4,8,16,${0.3 + alfa * 0.6})`;
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = contorno || hexAlfa(cor, Math.min(1, 0.6 + alfa));
    ctx.stroke();
  }

  /** Com a camada ligada, o mapa de fundo fica mais escuro para as bolinhas aparecerem.
   *  Desenhado antes das outras camadas extras (só o mapa base escurece). */
  function desenharVeu(ctx, proj, t) {
    if (!dados || !app.estado.camadas.hominideos || t > T_MAX) return;
    // a camada de população já escurece o mapa no Holoceno ("Terra à noite")
    const noite = app.estado.camadas.populacao && EVO.Populacao ? 0.55 * EVO.Populacao.noite(t) : 0;
    const a = Math.max(0.12, 0.45 - noite);
    ctx.beginPath();
    EVO.Mapa.tracarEsfera(ctx);
    ctx.fillStyle = `rgba(4,8,18,${a})`;
    ctx.fill();
  }

  function texto(ctx, t, px, py, cor, fonte) {
    ctx.font = fonte || "600 11px Segoe UI, sans-serif";
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = "rgba(8,12,20,.85)";
    ctx.strokeText(t, px, py);
    ctx.fillStyle = cor;
    ctx.fillText(t, px, py);
  }

  function desenhar(ctx, proj, t, k) {
    alvosTela = [];
    if (!dados || !app.estado.camadas.hominideos || t > T_MAX) { esconderPainel(); return; }
    mostrarPainel(t);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const rotulos = [];
    const escalaZoom = Math.min(1.8, 0.8 + 0.2 * k);

    for (const esp of dados.especies) {
      // grupo extinto há pouco, ou região abandonada: contorno tracejado com †
      const fantasmas = [];
      const nucleos = nucleosDa(esp);
      if (esp.ate > 0 && t < esp.ate && t > esp.ate * 0.75) {
        for (const u of nucleos) if (Math.abs(u.ate - esp.ate) < esp.ate * 0.08) fantasmas.push(u);
        if (fantasmas.length) rotulos.push({ u: fantasmas[0], texto: `† ${esp.nome}: extintos`, cor: "#cfd8dc", r: 8 });
      }
      for (const u of nucleos) {
        if (u.ate > 0 && t < u.ate && t > u.ate * 0.8 && Math.abs(u.ate - esp.ate) >= esp.ate * 0.08) fantasmas.push(u);
      }
      for (const u of fantasmas) {
        const ll = pos(u);
        if (!ll) continue;
        const [px, py] = proj(ll);
        ctx.beginPath();
        ctx.arc(px, py, 7 * escalaZoom, 0, 6.2832);
        ctx.fillStyle = "rgba(4,8,16,.45)";
        ctx.fill();
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = hexAlfa(esp.cor, 0.95);
        ctx.stroke();
        ctx.setLineDash([]);
        texto(ctx, "†", px, py + 1, esp.cor, "bold 11px Georgia, serif");
        alvosTela.push({ px, py, r: 8, html: `<b>† ${esc(esp.nome)}</b><br><span class="sub">${esc(u.nome)}: não vivem mais aqui (desde ${E().curto(u.ate)})</span>` });
      }

      const st = estado(esp, t);
      if (st.n == null) continue;
      // rastro de ocupação
      for (const a of st.rastros) {
        const ll = pos(a);
        if (!ll) continue;
        const [px, py] = proj(ll);
        circulo(ctx, px, py, esp.nucleos_auto ? 2.2 * escalaZoom : raio(a._n || 0, k), esp.cor, 0.45, hexAlfa(esp.cor, 0.7));
      }
      // núcleos de ocupação (os grandes primeiro, para os pequenos ficarem visíveis por cima)
      let maior = null;
      const ordem = st.ativos.map((u, i) => i).sort((a, b) => st.partes[b] - st.partes[a]);
      for (const i of ordem) {
        const u = st.ativos[i];
        const ll = pos(u);
        if (!ll) continue;
        const [px, py] = proj(ll);
        const n = st.partes[i];
        const r = raio(n, k);
        circulo(ctx, px, py, r, esp.cor, opacidade(r / escalaZoom));
        alvosTela.push({ px, py, r, esp, html: `<b>${esc(esp.nome)}</b>${u.nome ? ` · ${esc(u.nome)}` : ""}<br><span class="sub">${textoPop(n)} pessoas nesta região (estimativa)</span>` });
        if (!maior || n > maior.n) maior = { u, n, r };
      }
      // frentes em movimento: bolinha com contorno branco e uma cauda
      for (const fr of st.frentes) {
        const ll = pos(fr);
        if (!ll) continue;
        const cauda = fr.cauda.map((c) => R().reconstruir(c.lon, c.lat, fr.placa)).filter(Boolean).map((c) => proj(c));
        ctx.beginPath();
        // ao cruzar o antimeridiano (180°) a cauda sai por uma borda e volta pela outra
        const larg = ctx.canvas.clientWidth;
        cauda.forEach(([cx, cy], i) => (i && Math.abs(cx - cauda[i - 1][0]) < larg / 3 ? ctx.lineTo(cx, cy) : ctx.moveTo(cx, cy)));
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.strokeStyle = hexAlfa(esp.cor, 0.6);
        ctx.stroke();
        const [px, py] = proj(ll);
        circulo(ctx, px, py, 6.5, esp.cor, 0.95, "#fff");
        alvosTela.push({ px, py, r: 8, esp, html: `<b>${esc(esp.nome)} em movimento</b><br><span class="sub">${esc(fr.rota.nome || "")}</span>` });
      }
      if (maior) rotulos.push({ u: maior.u, texto: `${esp.nome} · ${textoPop(st.n)}`, cor: esp.cor, r: maior.r });
      else if (st.frentes.length) rotulos.push({ u: st.frentes[0], texto: `${esp.nome} · ${textoPop(st.n)}`, cor: esp.cor, r: 8 });
    }

    // vida sedentária: aldeias e centros de agricultura
    for (const f of dados.fazendas || []) {
      if (t > f.t) continue;
      const ll = R().reconstruir(f.lugar[0], f.lugar[1], f.lugar[2]);
      if (!ll) continue;
      const [px, py] = proj(ll);
      ctx.beginPath();
      ctx.arc(px, py, 11, 0, 6.2832);
      ctx.fillStyle = "rgba(4,8,16,.7)";
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = "rgba(255,255,255,.5)";
      ctx.stroke();
      ctx.font = "14px Segoe UI Emoji, Apple Color Emoji, sans-serif";
      ctx.fillStyle = "#fff";
      ctx.fillText(f.icone, px, py + 1);
      alvosTela.push({ px, py, r: 10, html: `<b>${f.icone} ${esc(f.nome)}</b><br><span class="sub">${E().formatar(f.t)}</span>`,
        detalhe: `<h3>${f.icone} ${esc(f.nome)}</h3><p class="vazio">${E().formatar(f.t)}</p><p>${esc(f.texto)}</p>` });
    }

    // encontros entre espécies
    for (const e of dados.encontros) {
      if (Math.abs(Math.log(t) - Math.log(e.t)) > 0.16) continue;
      const ll = R().reconstruir(e.lugar[0], e.lugar[1], e.lugar[2]);
      if (!ll) continue;
      const [px, py] = proj(ll);
      const cores = e.especies.map((id) => (dados.especies.find((s) => s.id === id) || {}).cor || "#fff");
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(px, py, 14, Math.PI / 2, Math.PI * 1.5); ctx.strokeStyle = cores[0]; ctx.stroke();
      ctx.beginPath(); ctx.arc(px, py, 14, -Math.PI / 2, Math.PI / 2); ctx.strokeStyle = cores[1]; ctx.stroke();
      ctx.beginPath(); ctx.arc(px, py, 12, 0, 6.2832); ctx.fillStyle = "rgba(10,15,25,.92)"; ctx.fill();
      ctx.font = "14px Segoe UI Emoji, Apple Color Emoji, sans-serif";
      ctx.fillStyle = "#fff";
      ctx.fillText("🤝", px, py + 1);
      texto(ctx, e.nome, px, py + 24, "#fff");
      alvosTela.push({ px, py, r: 15, html: `<b>🤝 ${esc(e.nome)}</b><br><span class="sub">${E().formatar(e.t)}</span>`,
        detalhe: `<h3>🤝 ${esc(e.nome)}</h3><p class="vazio">${E().formatar(e.t)}</p><p>${esc(e.texto)}</p>` });
    }

    // nomes das espécies com a população (empilhados para não sobrepor)
    const ocupados = [];
    const largura = ctx.canvas.clientWidth;
    ctx.font = "italic 600 12px Georgia, serif";
    for (const rt of rotulos) {
      const ll = pos(rt.u);
      if (!ll) continue;
      const [px0, py0] = proj(ll);
      const meia = ctx.measureText(rt.texto).width / 2 + 6; // o nome não sai pela borda do mapa
      const px = Math.max(meia, Math.min(largura - meia, px0));
      let py = py0 - rt.r - 9;
      while (ocupados.some(([ox, oy]) => Math.abs(ox - px) < 130 && Math.abs(oy - py) < 15)) py -= 15;
      ocupados.push([px, py]);
      texto(ctx, rt.texto, px, py, rt.cor, "italic 600 12px Georgia, serif");
    }
  }

  function escolher(mx, my) {
    for (let i = alvosTela.length - 1; i >= 0; i--) {
      const a = alvosTela[i];
      if (Math.hypot(a.px - mx, a.py - my) > Math.max(6, a.r)) continue;
      const esp = a.esp;
      const detalhe = a.detalhe || (esp ? `<h3>${esc(esp.nome)}</h3>
        <p class="vazio">${E().formatar(esp.de).replace(" atrás", "")} → ${esp.ate ? E().formatar(esp.ate) : "hoje"}</p>
        <p>${esc(esp.texto)}</p>
        <p>População estimada agora: <b>${textoPop(populacao(esp, app.estado.tempo))}</b> (ordem de grandeza).</p>
        <h4>Sítios com fósseis</h4><p>${(esp.sitios || []).map((s) => `${esc(s[4])} (${E().curto(s[5])})`).join(" · ")}</p>` : null);
      return { html: a.html, detalhe: detalhe ? () => detalhe : undefined };
    }
    return null;
  }

  // ------------------------------------------------------------------ painel com gráfico
  function mostrarPainel(t) {
    if (painel.hidden) { painel.hidden = false; desenharGrafico(); }
    atualizarCursor(t);
  }

  function esconderPainel() {
    if (painel && !painel.hidden) painel.hidden = true;
  }

  function desenharGrafico() {
    if (!dados || !painel || painel.hidden) return;
    const caixa = painel.querySelector(".grafico");
    const W = caixa.clientWidth, H = 150, m = { e: 34, d: 8, c: 6, b: 18 };
    caixa.innerHTML = "";
    svg = d3.select(caixa).append("svg").attr("width", W).attr("height", H);
    x = d3.scaleLog().domain([T_MAX, G_MIN]).range([m.e, W - m.d]);
    y = d3.scaleLog().domain([100, 1e10]).range([H - m.b, m.c]).clamp(true);
    const g = svg.append("g");
    for (const [v, r] of [[1e3, "1 mil"], [1e5, "100 mil"], [1e7, "10 mi"], [1e9, "1 bi"]]) {
      g.append("line").attr("x1", m.e).attr("x2", W - m.d).attr("y1", y(v)).attr("y2", y(v)).attr("stroke", "rgba(255,255,255,.07)");
      g.append("text").attr("x", m.e - 4).attr("y", y(v) + 3).attr("text-anchor", "end").attr("class", "eixo").text(r);
    }
    for (const [t, r] of [[7, "7 mi"], [1, "1 mi"], [0.1, "100 mil"], [0.01, "10 mil"], [0.001, "1 mil"], [G_MIN, "hoje"]]) {
      g.append("text").attr("x", x(t)).attr("y", H - 4).attr("text-anchor", t <= G_MIN ? "end" : "middle").attr("class", "eixo").text(r);
    }
    const linha = d3.line().x((d) => x(d[0])).y((d) => y(Math.max(100, d[1])));
    for (const esp of dados.especies) {
      const de = Math.min(esp.de, T_MAX), ate = Math.max(esp.ate, G_MIN);
      if (de <= ate) continue;
      const amostras = d3.range(0, 81).map((i) => {
        const t = Math.exp(Math.log(de) + (Math.log(ate) - Math.log(de)) * (i / 80));
        return [t, populacao(esp, t) || 0];
      }).filter((d) => d[1] > 0);
      g.append("path").attr("d", linha(amostras)).attr("fill", "none").attr("stroke", esp.cor).attr("stroke-width", 2)
        .attr("stroke-linecap", "round").append("title").text(esp.nome);
    }
    g.append("line").attr("class", "cursor-hom").attr("y1", m.c).attr("y2", H - m.b).attr("stroke", "#fff").attr("stroke-width", 1.5);
    g.append("g").attr("class", "pontos-hom");
    atualizarCursor(app.estado.tempo);
  }

  function atualizarCursor(t) {
    if (!svg) return;
    const tt = Math.max(G_MIN, Math.min(T_MAX, t));
    svg.select(".cursor-hom").attr("x1", x(tt)).attr("x2", x(tt));
    const vivos = dados.especies.map((esp) => [esp, populacao(esp, t)]).filter(([, n]) => n != null);
    const sel = svg.select(".pontos-hom").selectAll("circle").data(vivos, (d) => d[0].id);
    sel.exit().remove();
    sel.enter().append("circle").attr("r", 3.5).attr("stroke", "#0a1220").attr("stroke-width", 1)
      .merge(sel).attr("cx", x(tt)).attr("cy", (d) => y(Math.max(100, d[1]))).attr("fill", (d) => d[0].cor);
    painel.querySelector(".vivos").innerHTML = vivos.length
      ? vivos.sort((a, b) => b[1] - a[1]).map(([esp, n]) =>
        `<span><i style="background:${esp.cor}"></i>${esc(esp.nome)} <b>${textoPop(n)}</b></span>`).join("")
      : `<span class="vazio">Nenhum hominíneo ainda</span>`;
  }

  /** Recarrega depois que um debate mudou espécies ou rotas. */
  function recarregar() {
    if (!dados) return;
    for (const esp of dados.especies) delete esp._nucleos;
    prepararGeometrias();
    desenharGrafico();
    EVO.Mapa.pedir();
  }

  EVO.Hominideos = { iniciar, populacao, recarregar, get ativo() { return !!(app && app.estado.camadas.hominideos); } };
})();
