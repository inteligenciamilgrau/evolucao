/* Vida no mapa: fósseis, marcos, rotas de dispersão, nomes antigos e os painéis
 * "Agora" e "Árvore da vida". */
(function () {
  const EVO = (window.EVO = window.EVO || {});
  const E = () => EVO.Escala;
  const R = () => EVO.Rotacao;

  const DESCRICOES = {
    Hadeano: "Terra recém-formada e bombardeada por asteroides. Primeiro um oceano de magma, depois os primeiros oceanos de água.",
    Arqueano: "Os primeiros continentes, pequenos, e a vida só microscópica. Não há oxigênio no ar.",
    Sideriano: "As cianobactérias enchem o ar de oxigênio (Grande Oxidação) e o mar 'enferruja', formando as grandes jazidas de ferro.",
    Riaciano: "Depois da glaciação Huroniana, a atmosfera já tem oxigênio de forma permanente.",
    Orosiriano: "Colisões de continentes erguem montanhas e montam o supercontinente Colúmbia. Grandes impactos de asteroides.",
    Estateriano: "Colúmbia está formado. Aparecem as primeiras células complexas (eucariontes).",
    Calimiano: "Colúmbia se desmancha devagar. Começa o 'bilhão monótono': clima estável e vida quase sem novidades.",
    Ectasiano: "Mares rasos cobertos de tapetes de micróbios. As algas começam a aparecer.",
    Esteniano: "Rodínia se monta com as colisões Grenville. Surgem algas multicelulares com reprodução sexuada.",
    Toniano: "Rodínia, cercado pelo oceano Mirovia. Os eucariontes se diversificam.",
    Criogeniano: "Rodínia se parte e a Terra congela de polo a polo, duas vezes (Terra bola de neve).",
    Ediacarano: "Depois do gelo, surgem os primeiros seres grandes, de corpo mole, no fundo do mar.",
    Cambriano: "Explosão de vida animal no mar: olhos, carapaças, predadores. Na terra firme, só rocha e micróbios.",
    Ordoviciano: "Mares cheios de trilobitas, moluscos e os primeiros peixes. As plantas começam a ocupar a terra. Termina com uma glaciação.",
    Siluriano: "Recifes, peixes com mandíbula, as primeiras plantas com vasos e os primeiros animais terrestres (artrópodes).",
    Devoniano: "A 'era dos peixes'. Surgem as florestas e os primeiros tetrápodes saem da água.",
    Carbonífero: "Pântanos com árvores gigantes viram carvão. O ar tem muito oxigênio e os insetos são enormes. Aparecem os répteis. A Gondwana congela no polo sul.",
    Permiano: "A Pangeia está completa, com o interior seco. Pré-mamíferos dominam a terra. Termina com a maior extinção da história.",
    Triássico: "A vida se recupera numa Pangeia quente. Surgem dinossauros, pterossauros, crocodilos e os primeiros mamíferos.",
    Jurássico: "A Pangeia se divide em Laurásia e Gondwana. Dinossauros gigantes, primeiras aves, mares cheios de répteis.",
    Cretáceo: "Os continentes se afastam e o mar está alto e quente. Surgem as flores. Termina com o asteroide.",
    Paleoceno: "Florestas cobrem o mundo. Mamíferos ainda pequenos se diversificam depois do asteroide.",
    Eoceno: "O período mais quente desde os dinossauros. Surgem primatas modernos, cavalos e baleias. A Índia bate na Ásia.",
    Oligoceno: "A Antártida congela e o clima esfria. Macacos e roedores chegam à América do Sul.",
    Mioceno: "Andes e Himalaia sobem, savanas se espalham, símios se diversificam. A África encosta na Eurásia.",
    Plioceno: "O istmo do Panamá une as Américas. Hominíneos bípedes como Lucy andam pela África.",
    Pleistoceno: "As eras glaciais vão e voltam. Megafauna pelo mundo, e o gênero Homo se espalha.",
    Holoceno: "Clima estável desde o fim da última glaciação: agricultura, cidades, história.",
  };

  const MECANISMOS = {
    terra: { nome: "Por terra", cor: "#ffd54f", traco: [], icone: "🐾" },
    jangada: { nome: "Jangada de vegetação", cor: "#4dd0e1", traco: [7, 5], icone: "🌿" },
    voo: { nome: "Voando ou levado pelo vento", cor: "#90caf9", traco: [2, 5], icone: "🪶" },
    barco: { nome: "De barco (humanos)", cor: "#ffffff", traco: [9, 5], icone: "⛵" },
    humano: { nome: "Espécie levada por humanos", cor: "#ff7a7a", traco: [9, 4], icone: "⚓" },
    navio: { nome: "Navios (era moderna)", cor: "#ce93d8", traco: [10, 4], icone: "🚢" },
    forcada: { nome: "Migração forçada (escravidão)", cor: "#ef5350", traco: [3, 3], icone: "⛓️" },
  };

  let app, dados, fosseis;
  const grupoPorId = new Map();
  const fossilPorGrupo = new Map();
  const gruposAtivos = new Set();
  let destaque = null; // { grupos:Set, rotas:Set, eventos:Set }
  let pontosTela = []; // para escolher com o mouse

  // ------------------------------------------------------------------ início
  function iniciar(a) {
    app = a;
    dados = EVO_DADOS.conteudo;
    fosseis = (EVO_DADOS.fosseis && EVO_DADOS.fosseis.grupos) || [];
    for (const g of dados.grupos) grupoPorId.set(g.id, g);
    for (const f of fosseis) {
      fossilPorGrupo.set(f.id, f);
      gruposAtivos.add(f.id);
    }
    EVO.Regua.definirEventos(dados.eventos.map((e) => ({ t: e.t, icone: e.icone, titulo: e.titulo, prio: e.prio, id: e.id })));
    EVO.Mapa.registrar({ ordem: 10, desenhar: desenharRotas, escolher: escolherRota });
    EVO.Mapa.registrar({ ordem: 20, desenhar: desenharFosseis, escolher: escolherFossil });
    EVO.Mapa.registrar({ ordem: 25, desenhar: desenharCidades, escolher: escolherCidade });
    EVO.Mapa.registrar({ ordem: 30, desenhar: desenharSitios, escolher: escolherSitio });
    montarArvore();
  }

  // ------------------------------------------------------------------ utilidades
  const posSlider = (t) => E().posicao(t);
  /** Escapa texto vindo de dados externos (PBDB) antes de pôr em HTML. */
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const JANELA = 0.012; // quanto do controle deslizante um marco fica "acontecendo agora"
  const latTexto = (lat) => `${Math.abs(lat).toFixed(0)}°${lat >= 0 ? "N" : "S"}`;
  const vivo = (g, t) => t <= g.origem && t >= (g.fim || 0);

  /** Reconstrói um ponto [lon,lat,placa,idade,...] ignorando a idade da crosta (rotas e
   *  âncoras podem cruzar trechos de mar). */
  function rec(p) {
    return R().reconstruir(p[0], p[1], p[2]);
  }

  function eventoVisivel(e, t) {
    if (destaque && destaque.eventos.size) return destaque.eventos.has(e.id);
    return Math.abs(posSlider(t) - posSlider(e.t)) < JANELA;
  }

  // ------------------------------------------------------------------ nomes antigos
  function rotulosPaleo(t) {
    const saida = [];
    for (const r of dados.rotulos) {
      if (t > r.de || t < r.ate) continue;
      let x = 0, y = 0, z = 0, n = 0;
      for (const a of r.ancoras) {
        const p = rec(a);
        if (!p) continue;
        const v = R().paraXYZ(p[0], p[1]);
        x += v[0]; y += v[1]; z += v[2]; n++;
      }
      if (!n) continue;
      const s = (r.modo === "antipoda" ? -1 : 1) / Math.hypot(x, y, z);
      x *= s; y *= s; z *= s;
      saida.push({ n: r.n, tipo: r.tipo, pos: [Math.atan2(y, x) * 180 / Math.PI, Math.asin(z) * 180 / Math.PI] });
    }
    return saida;
  }

  // ------------------------------------------------------------------ fósseis
  function desenharFosseis(ctx, proj, t, k) {
    pontosTela = [];
    if (!app.estado.camadas.fosseis || t > 1000) return;
    const tam = Math.min(2.2, 0.9 + k * 0.25);
    for (const f of fosseis) {
      if (!gruposAtivos.has(f.id)) continue;
      const g = grupoPorId.get(f.id);
      const apagado = destaque && destaque.grupos.size && !destaque.grupos.has(f.id);
      ctx.fillStyle = g.cor;
      ctx.globalAlpha = apagado ? 0.12 : 0.85;
      for (const p of f.pontos) {
        if (t > p[3] || t < p[4]) continue;
        const ll = R().reconstruir(p[0], p[1], p[2]);
        if (!ll) continue;
        const xy = proj(ll);
        const r = tam * (1.3 + Math.min(2.2, Math.log2(p[5]) * 0.45));
        ctx.beginPath();
        ctx.arc(xy[0], xy[1], r, 0, 6.2832);
        ctx.fill();
        if (!apagado) pontosTela.push([xy[0], xy[1], r, f, p, ll]);
      }
    }
    ctx.globalAlpha = 1;
  }

  /** "237 a 228 milhões de anos atrás", "de 2,6 milhões de anos atrás até hoje" */
  function faixaIdade(a, b) {
    const sem = (t) => E().formatar(t).replace(" atrás", "");
    if (b < 0.00001) return `de ${sem(a)} atrás até hoje`;
    if (b >= 1) return `${sem(a).replace(/ milh(ões|ão) de anos/, "")} a ${E().formatar(b)}`;
    return `${sem(a)} a ${E().formatar(b)}`;
  }

  function escolherFossil(x, y) {
    let melhor = null, dmin = 8;
    for (const item of pontosTela) {
      const d = Math.hypot(item[0] - x, item[1] - y) - item[2];
      if (d < dmin) { dmin = d; melhor = item; }
    }
    if (!melhor) return null;
    const [, , , f, p, ll] = melhor;
    const g = grupoPorId.get(f.id);
    const nomes = p[6].map((i) => `<i>${esc(f.nomes[i])}</i>`).join(", ");
    const idade = faixaIdade(p[3], p[4]);
    const html = `<b>${g.icone} ${g.nome}</b><br>${nomes}<br><span class="sub">${esc(f.locais[p[7]])}</span><br>
      <span class="sub">${idade} · ${p[5]} ${p[5] > 1 ? "registros" : "registro"} · latitude na época ${latTexto(ll[1])}</span>`;
    return { html, detalhe: () => detalheGrupo(g, html) };
  }

  // ------------------------------------------------------------------ marcos (sítios)
  let sitiosTela = [];
  function desenharSitios(ctx, proj, t, k) {
    sitiosTela = [];
    if (!app.estado.camadas.sitios) return;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const e of dados.eventos) {
      if (!e.locais.length || !eventoVisivel(e, t)) continue;
      const realce = destaque && destaque.eventos.has(e.id);
      for (const l of e.locais) {
        const ll = t > 4031 || t > l[3] ? null : rec(l); // só onde a crosta já existia
        if (!ll) continue;
        const [x, y] = proj(ll);
        ctx.beginPath();
        ctx.arc(x, y, 11, 0, 6.2832);
        ctx.fillStyle = "rgba(12,20,34,.85)";
        ctx.fill();
        ctx.lineWidth = realce ? 2.5 : 1.5;
        ctx.strokeStyle = realce ? "#f2b84b" : "rgba(255,255,255,.9)";
        ctx.stroke();
        ctx.font = "12px Segoe UI Emoji, Apple Color Emoji, sans-serif";
        ctx.fillStyle = "#fff";
        ctx.fillText(e.icone, x, y + 1);
        if (realce || k >= 1.8) {
          ctx.font = "600 11px Segoe UI, sans-serif";
          ctx.lineWidth = 3;
          ctx.strokeStyle = "rgba(8,14,24,.85)";
          ctx.strokeText(l[4], x, y + 20);
          ctx.fillStyle = realce ? "#ffd98a" : "#fff";
          ctx.fillText(l[4], x, y + 20);
        }
        sitiosTela.push([x, y, e, l, ll]);
      }
    }
  }

  function escolherSitio(x, y) {
    for (const [sx, sy, e, l, ll] of sitiosTela) {
      if (Math.hypot(sx - x, sy - y) < 13) {
        return {
          html: `<b>${e.icone} ${e.titulo}</b><br><span class="sub">${l[4]} · ${E().formatar(e.t)}</span><br><span class="sub">Latitude agora no mapa: ${latTexto(ll[1])}</span>`,
          detalhe: () => detalheEvento(e),
        };
      }
    }
    return null;
  }

  // ------------------------------------------------------------------ povos e cidades
  /** Nomes de povos e humanos arcaicos vivos em t (o mapa cuida das colisões). */
  function rotulosPovos(t) {
    if (!app.estado.camadas.povos || t > 2) return [];
    const saida = [];
    for (const p of dados.povos || []) {
      if (t > p.de || t < p.ate - 1e-9) continue;
      const pos = rec(p.pos);
      if (pos) saida.push({ n: p.n, arcaico: !!p.arcaico, pos });
    }
    return saida;
  }

  let cidadesTela = [];
  function desenharCidades(ctx, proj, t, k) {
    cidadesTela = [];
    if (!app.estado.camadas.povos || t > 0.012) return;
    ctx.font = "600 10.5px Segoe UI, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    for (const c of dados.cidades || []) {
      const [, , , , nome, de, ate] = c;
      if (t > de || (ate && t < ate)) continue;
      const ll = rec(c);
      if (!ll) continue;
      const [x, y] = proj(ll);
      ctx.beginPath();
      ctx.rect(x - 3, y - 3, 6, 6);
      ctx.fillStyle = "#fff8e1";
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = "rgba(60,30,0,.9)";
      ctx.stroke();
      if (k >= 2.2) {
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(8,14,24,.85)";
        ctx.strokeText(nome, x + 6, y);
        ctx.fillStyle = "#fff8e1";
        ctx.fillText(nome, x + 6, y);
      }
      cidadesTela.push([x, y, c]);
    }
  }

  function escolherCidade(x, y) {
    for (const [cx, cy, c] of cidadesTela) {
      if (Math.abs(cx - x) < 6 && Math.abs(cy - y) < 6) {
        const [, , , , nome, de, ate] = c;
        const anoTxt = (t) => E().curto(t);
        return { html: `<b>🏛️ ${nome}</b><br><span class="sub">Fundada: ${anoTxt(de)}${ate ? ` · abandonada: ${anoTxt(ate)}` : ""}</span>` };
      }
    }
    return null;
  }

  // ------------------------------------------------------------------ rotas
  let rotasTela = [];
  function rotaVisivel(r, t) {
    if (!app.estado.camadas[r.humana ? "migracoes" : "rotas"]) return false;
    if (destaque) return destaque.rotas.has(r.id) && t <= r.de * 1.6 + 0.0001; // na história, só as do passo
    const dur = r.de - r.ate;
    // depois de chegar, a rota fica um pouco na tela (menos nas rotas recentes)
    return t <= r.de + dur * 0.1 && t >= r.ate - Math.min(dur * 0.25, r.ate * 0.6);
  }

  function desenharRotas(ctx, proj, t, k) {
    rotasTela = [];
    if (t > 400) return;
    const [W] = EVO.Mapa.tamanho;
    for (const r of dados.rotas) {
      if (!rotaVisivel(r, t)) continue;
      const m = MECANISMOS[r.mecanismo];
      const f = Math.max(0, Math.min(1, (r.de - t) / (r.de - r.ate)));
      for (const ramo of r.ramos) {
        const pts = ramo.map(rec);
        if (pts.some((p) => !p)) continue;
        // amostra o caminho por grandes círculos
        const amostras = [];
        for (let i = 0; i < pts.length - 1; i++) {
          const interp = d3.geoInterpolate(pts[i], pts[i + 1]);
          const n = Math.max(2, Math.ceil(d3.geoDistance(pts[i], pts[i + 1]) * 40));
          for (let j = i ? 1 : 0; j <= n; j++) amostras.push(proj(interp(j / n)));
        }
        const total = Math.round((amostras.length - 1) * f);
        const tracar = (ate) => {
          ctx.beginPath();
          for (let i = 0; i <= ate; i++) {
            const [x, y] = amostras[i];
            if (i === 0 || Math.abs(x - amostras[i - 1][0]) > W / 3) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        };
        ctx.setLineDash(m.traco);
        ctx.lineCap = "round";
        ctx.strokeStyle = m.cor;
        ctx.globalAlpha = 0.25;
        ctx.lineWidth = 2;
        tracar(amostras.length - 1);
        ctx.globalAlpha = 1;
        ctx.lineWidth = 2.6;
        ctx.shadowColor = "rgba(0,0,0,.6)";
        ctx.shadowBlur = 4;
        if (total > 0) tracar(total);
        ctx.shadowBlur = 0;
        ctx.setLineDash([]);
        // cabeça da rota
        const cab = amostras[Math.max(0, total)];
        ctx.beginPath();
        ctx.arc(cab[0], cab[1], 9, 0, 6.2832);
        ctx.fillStyle = "rgba(10,18,32,.9)";
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = m.cor;
        ctx.stroke();
        ctx.font = "11px Segoe UI Emoji, Apple Color Emoji, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#fff";
        ctx.fillText(m.icone, cab[0], cab[1] + 1);
        rotasTela.push({ r, amostras });
      }
    }
  }

  function escolherRota(x, y) {
    for (const { r, amostras } of rotasTela) {
      for (const [px, py] of amostras) {
        if (Math.hypot(px - x, py - y) < 7) {
          const m = MECANISMOS[r.mecanismo];
          return {
            html: `<b>${m.icone} ${r.nome}</b><br><span class="sub">${m.nome} · ${E().formatar(r.de).replace(" atrás", "")} → ${E().formatar(r.ate)}</span>`,
            detalhe: () => detalheRota(r),
          };
        }
      }
    }
    return null;
  }

  // ------------------------------------------------------------------ painéis de detalhe
  function botaoTempo(t, texto) {
    return `<button class="botao" data-ir="${t}">${texto}</button>`;
  }

  function ligarBotoes(el) {
    el.querySelectorAll("[data-ir]").forEach((b) => (b.onclick = () => { app.tocar && app.tocar(false); app.definirTempo(+b.dataset.ir); }));
    el.querySelectorAll("[data-solo]").forEach((b) => (b.onclick = () => solo(b.dataset.solo)));
    el.querySelectorAll("[data-todos]").forEach((b) => (b.onclick = () => todos()));
  }

  function detalheGrupo(g, extra) {
    const pai = g.pai && grupoPorId.get(g.pai);
    const html = `<h3>${g.icone} ${g.nome}</h3>
      <p class="vazio">${E().formatar(g.origem).replace(" atrás", "")} ${g.fim ? `→ extintos há ${E().formatar(g.fim).replace(" atrás", "")}` : "→ hoje"}${pai ? ` · ramo de ${pai.nome}` : ""}</p>
      <p>${g.texto}</p>
      ${extra ? `<h4>Fóssil selecionado</h4><p>${extra}</p>` : ""}
      <p style="display:flex;gap:6px;flex-wrap:wrap">${botaoTempo(g.origem, "Ir para a origem")}
      ${fossilPorGrupo.has(g.id) ? `<button class="botao" data-solo="${g.id}">Só estes fósseis</button><button class="botao" data-todos="1">Todos os grupos</button>` : ""}</p>`;
    setTimeout(() => ligarBotoes(document.getElementById("aba-detalhe")));
    return html;
  }

  function detalheEvento(e) {
    const html = `<h3>${e.icone} ${e.titulo}</h3>
      <p class="vazio">${E().formatar(e.t)}</p>
      <p>${e.texto}</p>
      ${e.locais.length ? `<h4>Onde</h4><p>${e.locais.map((l) => l[4]).join(" · ")}</p>` : ""}
      <p>${botaoTempo(e.t, "Ir para este momento")}</p>`;
    setTimeout(() => ligarBotoes(document.getElementById("aba-detalhe")));
    return html;
  }

  function detalheRota(r) {
    const m = MECANISMOS[r.mecanismo];
    const g = grupoPorId.get(r.grupo);
    const html = `<h3>${m.icone} ${r.nome}</h3>
      <p class="vazio">${m.nome} · ${E().formatar(r.de).replace(" atrás", "")} → ${E().formatar(r.ate)}</p>
      <p>${r.texto}</p>
      ${g ? `<p class="vazio">Grupo: ${g.icone} ${g.nome}</p>` : ""}
      <p>${botaoTempo(r.de, "Ver desde o começo")}</p>`;
    setTimeout(() => ligarBotoes(document.getElementById("aba-detalhe")));
    return html;
  }

  function focarEvento(ev) {
    const e = dados.eventos.find((x) => x.id === ev.id);
    if (e) app.mostrarDetalhe(detalheEvento(e));
  }

  // ------------------------------------------------------------------ filtros de grupos
  function solo(id) {
    gruposAtivos.clear();
    gruposAtivos.add(id);
    app.definirCamada("fosseis", true);
    atualizarArvore(app.estado.tempo);
    EVO.Mapa.pedir();
    app.salvar && app.salvar();
  }
  function todos() {
    for (const f of fosseis) gruposAtivos.add(f.id);
    atualizarArvore(app.estado.tempo);
    EVO.Mapa.pedir();
    app.salvar && app.salvar();
  }
  function alternarGrupo(id) {
    if (!fossilPorGrupo.has(id)) return;
    if (gruposAtivos.has(id)) gruposAtivos.delete(id);
    else gruposAtivos.add(id);
    atualizarArvore(app.estado.tempo);
    EVO.Mapa.pedir();
    app.salvar && app.salvar();
  }

  // ------------------------------------------------------------------ árvore da vida
  let linhasArvore = [];
  function montarArvore() {
    const filhos = new Map();
    for (const g of dados.grupos) {
      if (!filhos.has(g.pai)) filhos.set(g.pai, []);
      filhos.get(g.pai).push(g);
    }
    linhasArvore = [];
    const visitar = (g, prof, prefixo, ultimo) => {
      linhasArvore.push({ g, prof, prefixo: prof ? prefixo + (ultimo ? "└" : "├") : "" });
      const fs = filhos.get(g.id) || [];
      fs.forEach((f, i) => visitar(f, prof + 1, prof ? prefixo + (ultimo ? " " : "│") : "", i === fs.length - 1));
    };
    for (const raiz of filhos.get(null) || []) visitar(raiz, 0, "", true);

    const el = document.getElementById("aba-arvore");
    el.innerHTML = `<p class="vazio" style="margin-top:0">O "arbusto" principal da evolução. A barra mostra quando cada grupo existiu (a linha branca é o momento atual). Clique para ver detalhes; a bolinha liga ou desliga os fósseis no mapa.</p>
      <div id="lista-arvore"></div>
      <p style="display:flex;gap:6px;margin-top:10px"><button class="botao" data-todos="1">Mostrar todos os fósseis</button></p>
      <p class="vazio" style="font-size:11px">Fósseis: ${EVO_DADOS.fosseis ? EVO_DADOS.fosseis.fonte : ""}.</p>`;
    ligarBotoes(el);
    const lista = document.getElementById("lista-arvore");
    lista.innerHTML = linhasArvore.map(({ g, prefixo }, i) => {
      const x0 = E().posicao(g.origem) * 100, x1 = E().posicao(g.fim || 0) * 100;
      return `<div class="linha-arvore" data-i="${i}" title="${g.nome}">
        <span class="ramo">${prefixo}</span>
        <span class="bola ${fossilPorGrupo.has(g.id) ? "com-fosseis" : ""}" data-alternar="${g.id}" style="--cor:${g.cor}"></span>
        <span class="nome">${g.icone} ${g.nome}</span>
        <span class="vida-barra"><span style="left:${x0}%;width:${Math.max(1, x1 - x0)}%;background:${g.cor}"></span><i class="agora"></i></span>
      </div>`;
    }).join("");
    lista.addEventListener("click", (ev) => {
      const alt = ev.target.closest("[data-alternar]");
      if (alt && fossilPorGrupo.has(alt.dataset.alternar)) { alternarGrupo(alt.dataset.alternar); return; }
      const linha = ev.target.closest(".linha-arvore");
      if (linha) app.mostrarDetalhe(detalheGrupo(linhasArvore[+linha.dataset.i].g));
    });
  }

  function atualizarArvore(t) {
    const p = E().posicao(t) * 100;
    document.querySelectorAll(".linha-arvore").forEach((el) => {
      const { g } = linhasArvore[+el.dataset.i];
      el.classList.toggle("viva", vivo(g, t));
      el.classList.toggle("extinta", !!g.fim && t < g.fim);
      el.classList.toggle("futura", t > g.origem);
      const bola = el.querySelector(".bola");
      bola.classList.toggle("desligada", fossilPorGrupo.has(g.id) && !gruposAtivos.has(g.id));
      el.querySelector(".agora").style.left = p + "%";
    });
  }

  // ------------------------------------------------------------------ painel "Agora"
  function atualizar(t) {
    atualizarArvore(t);
    const per = E().periodo(t);
    const epo = E().epoca(t);
    const nome = epo ? epo[0] : per[0];
    const texto = DESCRICOES[nome] || DESCRICOES[per[0]] || "";
    const p = posSlider(t);
    const ordenados = [...dados.eventos].sort((a, b) => b.t - a.t);
    const agora = ordenados.filter((e) => Math.abs(posSlider(e.t) - p) < JANELA);
    const antes = ordenados.filter((e) => posSlider(e.t) < p - JANELA).slice(-2);
    const depois = ordenados.filter((e) => posSlider(e.t) > p + JANELA).slice(0, 2);
    const cartao = (e, classe) => `<div class="evento ${classe}" data-ev="${e.id}">
        <div class="quando">${E().formatar(e.t)}</div>
        <div class="titulo"><span class="icone">${e.icone}</span>${e.titulo}</div>
        ${classe === "agora" ? `<div class="texto">${e.texto}</div>` : ""}
      </div>`;
    const vivos = dados.grupos.filter((g) => vivo(g, t) && g.id !== "vida");
    const brasil = brasilAgora(t);
    const el = document.getElementById("aba-agora");
    el.innerHTML = `
      <h3>${nome}</h3>
      <p>${texto}</p>
      ${brasil ? `<p class="vazio">📍 ${brasil}</p>` : ""}
      ${populacaoMundial(t)}
      ${agora.length ? `<h4>Acontecendo agora</h4>${agora.map((e) => cartao(e, "agora")).join("")}` : ""}
      ${antes.length ? `<h4>Pouco antes</h4>${antes.map((e) => cartao(e, "passado")).join("")}` : ""}
      ${depois.length ? `<h4>A seguir</h4>${depois.map((e) => cartao(e, "")).join("")}` : ""}
      <h4>Vida nesta época</h4>
      <div class="grupos-fosseis">${vivos.map((g) => `<span class="grupo-fossil ${fossilPorGrupo.has(g.id) && !gruposAtivos.has(g.id) ? "desligado" : ""}" data-grupo="${g.id}"><span class="bola" style="background:${g.cor}"></span>${g.icone} ${g.nome}</span>`).join("")}</div>`;
    el.querySelectorAll("[data-ev]").forEach((d) => (d.onclick = () => {
      const e = dados.eventos.find((x) => x.id === d.dataset.ev);
      app.tocar && app.tocar(false);
      app.definirTempo(e.t);
      app.mostrarDetalhe(detalheEvento(e));
    }));
    el.querySelectorAll("[data-grupo]").forEach((d) => (d.onclick = () => app.mostrarDetalhe(detalheGrupo(grupoPorId.get(d.dataset.grupo)))));
    app.legenda();
  }

  function populacaoMundial(t) {
    if (!EVO.Populacao || t > 0.3) return "";
    const p = EVO.Populacao.mundo(t);
    if (!p) return "";
    const incerta = t > 0.0121 ? " (estimativa muito incerta)" : "";
    return `<p class="vazio">👥 População humana: ~${EVO.Populacao.textoPopulacao(p)} de pessoas${incerta}.</p>`;
  }

  function brasilAgora(t) {
    if (t > 1800 || t < 0.5) return "";
    const it = EVO_DADOS.geo.paises.itens.find((i) => i.c === "BRA");
    EVO.Rotacao.definirTempo(Math.min(t, EVO.Rotacao.tempoMaximo));
    const pos = it && EVO.Geometria.posicaoPonto(it.l);
    if (!pos) return "";
    const lat = pos[1];
    const zona = Math.abs(lat) < 23.5 ? "na faixa tropical" : Math.abs(lat) < 40 ? "em latitude subtropical" : Math.abs(lat) < 66.5 ? "em latitude média, de clima frio" : "perto do polo";
    return `O centro do Brasil está a ${latTexto(lat)}, ${zona} (hoje: ${latTexto(it.l[1])}).`;
  }

  function legenda() {
    const t = app.estado.tempo;
    const partes = [];
    if (app.estado.camadas.fosseis && t <= 1000) {
      const vis = fosseis.filter((f) => gruposAtivos.has(f.id))
        .map((f) => ({ f, n: f.pontos.filter((p) => t <= p[3] && t >= p[4]).length }))
        .filter((x) => x.n).sort((a, b) => b.n - a.n).slice(0, 6);
      if (vis.length) {
        partes.push(`<div class="titulo-legenda">Fósseis desta época</div><div class="fosseis-legenda">` +
          vis.map(({ f }) => {
            const g = grupoPorId.get(f.id);
            return `<span><i style="background:${g.cor}"></i>${g.nome}</span>`;
          }).join("") + "</div>");
      }
    }
    if (app.estado.camadas.populacao && t <= 0.3) {
      partes.push(`<div class="titulo-legenda">Pessoas por km²</div><div class="rampa-pop"><i></i><span>0,01</span><span>1</span><span>100</span><span>10 mil</span></div>`);
    }
    {
      const mecs = new Set(dados.rotas.filter((r) => rotaVisivel(r, t)).map((r) => r.mecanismo));
      for (const m of mecs) {
        const mm = MECANISMOS[m];
        partes.push(`<div class="item"><span class="linha-amostra" style="background:${mm.cor}"></span>${mm.icone} ${mm.nome}</div>`);
      }
    }
    return partes.join("");
  }

  // ------------------------------------------------------------------ destaque (histórias)
  function destacar(d) {
    destaque = d ? { grupos: new Set(d.grupos || []), rotas: new Set(d.rotas || []), eventos: new Set(d.eventos || []) } : null;
    if (d && d.grupos && d.grupos.length) for (const g of d.grupos) if (fossilPorGrupo.has(g)) gruposAtivos.add(g);
    EVO.Mapa.pedir();
    app.legenda();
  }

  /** Grupos de fósseis desligados (para lembrar entre visitas). */
  function gruposDesligados() {
    return fosseis.map((f) => f.id).filter((id) => !gruposAtivos.has(id));
  }
  function desligarGrupos(ids) {
    for (const id of ids || []) if (typeof id === "string") gruposAtivos.delete(id);
    atualizarArvore(app.estado.tempo);
  }

  EVO.Vida = { iniciar, atualizar, legenda, focarEvento, destacar, rotulosPaleo, rotulosPovos, MECANISMOS, grupoPorId,
    detalheGrupo, gruposDesligados, desligarGrupos };
})();
