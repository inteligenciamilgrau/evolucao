/* Aplicação: estado, painel de camadas, reprodução, dicas e endereço compartilhável. */
(function () {
  const EVO = (window.EVO = window.EVO || {});
  const E = EVO.Escala;

  const CAMADAS = [
    { grupo: "Geologia", itens: [
      { id: "limites", nome: "Limites de placas", desc: "Dorsais (vermelho), subducção (amarelo, dentes do lado que sobe), transformantes (verde), riftes (laranja)", cor: "#ff6b5b", padrao: true },
      { id: "crosta", nome: "Crosta continental", desc: "Inclui as plataformas hoje submersas", cor: "#2a5f82", padrao: true },
      { id: "grade", nome: "Equador e trópicos da época", desc: "A latitude de cada lugar no passado explica seu clima e seus fósseis", cor: "#ffd678", padrao: true },
    ] },
    { grupo: "Clima e vegetação", itens: [
      { id: "clima", nome: "Gelo", desc: "Calotas polares, Terra bola de neve, eras glaciais", cor: "#f4faff", padrao: true },
      { id: "mar", nome: "Mar baixo nas glaciações", desc: "Pontes de terra: Beríngia, Sunda, Sahul, Doggerland", cor: "#b9aa7c", padrao: true },
      { id: "cores", nome: "Colorir países", desc: "Mostra cada país em vez da vegetação aproximada", cor: "#d9a66b", padrao: false },
    ] },
    { grupo: "Geografia de hoje", itens: [
      { id: "fronteiras", nome: "Fronteiras dos países", cor: "#fdf6e3", padrao: true },
      { id: "estados", nome: "Estados", desc: "Brasil, EUA, Rússia e China", cor: "#ffffff", padrao: false },
      { id: "regioes", nome: "Macrorregiões", desc: "Regiões do Brasil, EUA, Rússia e China", cor: "#6fa8dc", padrao: false },
      { id: "nomes", nome: "Nomes", cor: "#fdf6e3", padrao: true },
    ] },
    { grupo: "Humanos", itens: [
      { id: "populacao", nome: "População humana", desc: "Densidade estimada (HYDE/ISIMIP). Antes de 10 mil a.C., as regiões já ocupadas pelos sapiens", cor: "#ffad1f", padrao: true },
      { id: "migracoes", nome: "Migrações humanas", desc: "Da saída da África à imigração moderna", cor: "#ce93d8", padrao: true },
      { id: "povos", nome: "Povos e cidades", desc: "Humanos arcaicos, povos, civilizações e cidades com data de fundação", cor: "#ffcc80", padrao: true },
    ] },
    { grupo: "Vida", itens: [
      { id: "fosseis", nome: "Fósseis", desc: "Ocorrências reais da Paleobiology Database, levadas com as placas", cor: "#ff8a65", padrao: true },
      { id: "rotas", nome: "Rotas de dispersão", desc: "Como cada grupo chegou aonde vive", cor: "#ffd54f", padrao: true },
      { id: "sitios", nome: "Sítios e marcos", desc: "Lugares-chave da história da vida", cor: "#ffffff", padrao: true },
    ] },
  ];

  const estado = (EVO.estado = {
    tempo: 0,
    camadas: {},
    tocando: false,
  });
  for (const g of CAMADAS) for (const it of g.itens) estado.camadas[it.id] = it.padrao;

  // ------------------------------------------------------------------ memória (localStorage)
  const CHAVE = "evo-config";
  function lerConfig() {
    try { return JSON.parse(localStorage.getItem(CHAVE)) || {}; } catch (e) { return {}; }
  }
  let salvarTimer = null;
  function salvar() {
    clearTimeout(salvarTimer);
    salvarTimer = setTimeout(() => {
      const corpo = document.getElementById("corpo");
      const anterior = lerConfig();
      // durante uma história as camadas mudam por um tempo: não guardar essas
      const historiaAberta = EVO.Historias && EVO.Historias.ativa;
      const aba = document.querySelector(".abas button.ativa");
      const config = {
        camadas: historiaAberta ? anterior.camadas : estado.camadas,
        velocidade: document.getElementById("velocidade").value,
        modo: E.modo,
        semCamadas: corpo.classList.contains("sem-camadas"),
        semInfo: corpo.classList.contains("sem-info"),
        aba: aba ? aba.dataset.aba : "agora",
        gruposDesligados: EVO.Vida ? EVO.Vida.gruposDesligados() : [],
      };
      try { localStorage.setItem(CHAVE, JSON.stringify(config)); } catch (e) { /* sem armazenamento */ }
    }, 250);
  }

  // ------------------------------------------------------------------ tempo
  let ultimoPainel = null;
  function definirTempo(t, origem) {
    t = Math.max(0, Math.min(4600, t));
    estado.tempo = t;
    const modo = E.modoPara(t);
    if (modo !== E.modo) definirModo(modo);
    document.getElementById("tempo-texto").textContent = E.formatar(t);
    const chips = [E.eon(t), E.era(t), E.periodo(t), E.epoca(t)].filter(Boolean);
    const vistos = new Set();
    const reg = EVO.Clima.regime(t);
    const temp = EVO.Clima.temperatura(t);
    document.getElementById("chips").innerHTML =
      chips.filter((c) => !vistos.has(c[0]) && vistos.add(c[0]))
        .map((c) => `<span class="chip" style="background:${c[3]}">${c[0]}</span>`).join("") +
      `<span class="chip" style="background:${reg.cor}" title="Regime climático aproximado">${reg.nome}${t < 540 ? ` · ~${Math.round(temp)} °C` : ""}</span>` +
      chipPopulacao(t);
    EVO.Regua.atualizar(t);
    EVO.Mapa.pedir();
    avisos(t);
    const chave = E.periodo(t)[0] + Math.round(E.posicao(t) * 400);
    if (chave !== ultimoPainel) {
      ultimoPainel = chave;
      EVO.Vida && EVO.Vida.atualizar(t);
    }
    if (origem !== "url") agendarUrl();
  }

  function avisos(t) {
    const el = document.getElementById("aviso");
    let msg = "";
    if (t > 4400) msg = "A Terra recém-formada: um oceano de magma. Ainda não há crosta sólida nem oceanos.";
    else if (t > 4031) msg = "Hadeano: os primeiros oceanos e a primeira crosta. Quase nada dessa crosta sobreviveu até hoje.";
    else if (t > 1800) msg = "Antes de 1,8 bilhão de anos as posições dos continentes são desconhecidas. Mostramos só a crosta que já existia, na posição mais antiga reconstruída.";
    el.hidden = !msg;
    el.textContent = msg;
  }

  let timerUrl = null;
  function agendarUrl() {
    clearTimeout(timerUrl);
    timerUrl = setTimeout(() => {
      const t = estado.tempo;
      const txt = t >= 1 ? t.toFixed(1) : t >= 0.001 ? t.toFixed(4) : t.toFixed(6);
      history.replaceState(null, "", `#t=${+txt}`);
    }, 400);
  }

  function chipPopulacao(t) {
    const p = EVO.Populacao && t <= 0.3 ? EVO.Populacao.mundo(t) : null;
    return p ? `<span class="chip" style="background:#ffd27a" title="População humana estimada">👥 ~${EVO.Populacao.textoPopulacao(p)}</span>` : "";
  }

  function definirModo(nome) {
    E.definirModo(nome);
    const sel = document.getElementById("modo-regua");
    if (sel) sel.value = nome;
    EVO.Regua.desenhar();
    EVO.Regua.atualizar(estado.tempo);
    salvar();
  }

  // ------------------------------------------------------------------ reprodução
  let ultimoQuadro = 0;
  function tocar(sim) {
    estado.tocando = sim;
    document.getElementById("btn-play").textContent = sim ? "❚❚" : "▶";
    if (sim) {
      if (E.posicao(estado.tempo) >= 0.9999) definirTempo(E.maximo);
      ultimoQuadro = performance.now();
      requestAnimationFrame(passo);
    }
  }
  function passo(agora) {
    if (!estado.tocando) return;
    const dt = Math.min(0.1, (agora - ultimoQuadro) / 1000);
    ultimoQuadro = agora;
    const vel = +document.getElementById("velocidade").value;
    const p = E.posicao(estado.tempo) + vel * dt;
    definirTempo(E.tempo(p));
    if (p >= 1) return tocar(false);
    requestAnimationFrame(passo);
  }

  // ------------------------------------------------------------------ camadas
  function montarCamadas() {
    const caixa = document.getElementById("lista-camadas");
    caixa.innerHTML = CAMADAS.map((g) => `
      <div class="grupo-camadas"><h3>${g.grupo}</h3>
      ${g.itens.map((it) => `
        <label class="camada">
          <input type="checkbox" data-camada="${it.id}" ${estado.camadas[it.id] ? "checked" : ""}>
          <span class="amostra" style="background:${it.cor || "#888"}"></span>
          <span>${it.nome}${it.desc ? `<small>${it.desc}</small>` : ""}</span>
        </label>`).join("")}
      </div>`).join("");
    caixa.addEventListener("change", (ev) => {
      const id = ev.target.dataset.camada;
      if (!id) return;
      definirCamada(id, ev.target.checked);
    });
  }

  function definirCamada(id, valor) {
    estado.camadas[id] = valor;
    const cb = document.querySelector(`[data-camada="${id}"]`);
    if (cb) cb.checked = valor;
    EVO.Mapa.pedir();
    legenda();
    salvar();
  }

  function legenda() {
    const el = document.getElementById("legenda");
    const partes = [];
    if (estado.camadas.limites && estado.tempo <= 1800) {
      const c = EVO.Mapa.coresLimite;
      partes.push(`<div class="titulo-legenda">Limites de placas</div><div class="fosseis-legenda">
        <span title="As placas se afastam e nasce crosta nova"><b class="linha-amostra" style="background:${c.d}"></b>dorsal</span>
        <span title="Uma placa mergulha sob a outra"><b class="linha-amostra" style="background:${c.s}"></b>subducção</span>
        <span title="As placas deslizam lado a lado"><b class="linha-amostra" style="background:${c.t}"></b>transformante</span></div>`);
    }
    if (EVO.Vida && EVO.Vida.legenda) partes.push(EVO.Vida.legenda());
    el.innerHTML = partes.join("");
  }

  // ------------------------------------------------------------------ dicas e cliques
  function montarDicas() {
    const canvas = EVO.Mapa.canvas;
    const dica = document.getElementById("dica");
    let pendente = null;
    canvas.addEventListener("pointermove", (ev) => {
      if (ev.buttons) { dica.hidden = true; return; }
      const r = canvas.getBoundingClientRect();
      pendente = [ev.clientX - r.left, ev.clientY - r.top];
      requestAnimationFrame(() => {
        if (!pendente) return;
        const [x, y] = pendente;
        pendente = null;
        const html = textoDica(EVO.Mapa.escolher(x, y));
        if (!html) { dica.hidden = true; return; }
        dica.innerHTML = html;
        dica.hidden = false;
        const [W] = EVO.Mapa.tamanho;
        dica.style.left = Math.min(x + 14, W - dica.offsetWidth - 8) + "px";
        dica.style.top = y + 14 + "px";
      });
    });
    canvas.addEventListener("pointerleave", () => { dica.hidden = true; });
    canvas.addEventListener("click", (ev) => {
      const r = canvas.getBoundingClientRect();
      const alvo = EVO.Mapa.escolher(ev.clientX - r.left, ev.clientY - r.top);
      if (alvo && alvo.detalhe) mostrarDetalhe(alvo.detalhe());
      else if (alvo && alvo.pais) mostrarDetalhe(detalhePais(alvo));
    });
  }

  const latTexto = (lat) => `${Math.abs(lat).toFixed(0)}°${lat >= 0 ? "N" : "S"}`;

  function textoDica(a) {
    if (!a) return "";
    if (a.html) return a.html;
    if (a.oceano) {
      return estado.tempo > 4031 ? "" : `<span class="sub">Oceano · latitude ${latTexto(a.ll[1])}</span>`;
    }
    const linhas = [];
    if (a.estado) linhas.push(`<b>${a.estado.n}</b> <span class="sub">(${a.estado.rg}, ${EVO_DADOS.geo.estados.nomesPais[a.estado.p]})</span>`);
    if (a.pais && !a.estado) linhas.push(`<b>${a.pais.n}</b> <span class="sub">${a.pais.ct}</span>`);
    linhas.push(`<span class="sub">Latitude na época: ${latTexto(a.ll[1])}</span>`);
    if (a.idade < 4600) linhas.push(`<span class="sub">Rocha desta placa: até ${E.formatar(a.idade).replace(" atrás", "")}</span>`);
    return linhas.join("<br>");
  }

  function detalhePais(a) {
    const t = estado.tempo;
    const lat = a.ll[1];
    const zona = Math.abs(lat) < 23.5 ? "na faixa tropical" : Math.abs(lat) < 66.5 ? "em latitudes médias" : "na região polar";
    return `<h3>${a.estado ? a.estado.n + " · " : ""}${a.pais.n}</h3>
      <p>${t > 0.01 ? `Há ${E.formatar(t).replace(" atrás", "")}, este pedaço de terra estava` : "Hoje este lugar está"} a <b>${latTexto(lat)}</b> de latitude, ${zona}.</p>
      <p>Ele viaja sobre a placa tectônica nº ${a.placa} do modelo. A rocha que forma esta placa tem até ${a.idade >= 4600 ? "mais de 4 bilhões de anos" : E.formatar(a.idade).replace(" atrás", "")}.</p>`;
  }

  function mostrarDetalhe(html) {
    document.getElementById("aba-detalhe").innerHTML = html;
    abrirAba("detalhe");
  }

  function abrirAba(nome, quieto) {
    document.querySelectorAll(".abas button").forEach((b) => b.classList.toggle("ativa", b.dataset.aba === nome));
    document.querySelectorAll(".aba").forEach((a) => a.classList.toggle("ativa", a.id === "aba-" + nome));
    if (!quieto && document.getElementById("corpo").classList.contains("sem-info")) alternarPainel("painel-info");
    salvar();
  }

  function alternarPainel(id) {
    const corpo = document.getElementById("corpo");
    const classe = id === "painel-info" ? "sem-info" : "sem-camadas";
    if (window.innerWidth <= 1100 && id === "painel-camadas") corpo.classList.toggle("com-camadas");
    else corpo.classList.toggle(classe);
    atualizarBotoesReabrir();
    salvar();
  }

  function atualizarBotoesReabrir() {
    const corpo = document.getElementById("corpo");
    const palco = document.getElementById("palco");
    palco.querySelectorAll(".reabrir").forEach((b) => b.remove());
    const fechadoCamadas = window.innerWidth <= 1100 ? !corpo.classList.contains("com-camadas") : corpo.classList.contains("sem-camadas");
    if (fechadoCamadas) {
      const b = document.createElement("button");
      b.className = "reabrir"; b.style.left = "10px"; b.textContent = "☰ Camadas";
      b.onclick = () => alternarPainel("painel-camadas");
      palco.appendChild(b);
    }
    if (corpo.classList.contains("sem-info")) {
      const b = document.createElement("button");
      b.className = "reabrir"; b.style.right = "56px"; b.textContent = "Informações ›";
      b.onclick = () => alternarPainel("painel-info");
      palco.appendChild(b);
    }
  }

  // ------------------------------------------------------------------ início
  function lerUrl() {
    const params = new URLSearchParams(location.search + "&" + location.hash.slice(1));
    const t = parseFloat(params.get("t"));
    const camadas = params.get("camadas");
    if (camadas) {
      for (const c of camadas.split(",")) {
        const id = c.replace(/^[+-]/, "");
        if (Object.hasOwn(estado.camadas, id)) estado.camadas[id] = !c.startsWith("-");
      }
    }
    return isNaN(t) ? null : t;
  }

  function iniciar() {
    const config = lerConfig();
    if (config.camadas) {
      for (const [k, v] of Object.entries(config.camadas)) if (Object.hasOwn(estado.camadas, k)) estado.camadas[k] = v === true;
    }
    const velocidade = document.getElementById("velocidade");
    if ([...velocidade.options].some((o) => o.value === config.velocidade)) velocidade.value = config.velocidade;
    if (config.semCamadas) document.getElementById("corpo").classList.add("sem-camadas");
    if (config.semInfo) document.getElementById("corpo").classList.add("sem-info");
    if (Object.hasOwn(E.MODOS, config.modo || "")) E.definirModo(config.modo);
    document.getElementById("modo-regua").value = E.modo;
    const tUrl = lerUrl();
    EVO.Rotacao.iniciar(EVO_DADOS.rotacoes);
    EVO.Mapa.iniciar(document.getElementById("mapa"), estado);
    EVO.Regua.iniciar(document.getElementById("regua"), (t, ev) => {
      tocar(false);
      definirTempo(t);
      if (ev && EVO.Vida) EVO.Vida.focarEvento(ev);
    });
    montarCamadas();
    montarDicas();
    EVO.Populacao && EVO.Populacao.iniciar({ estado });
    EVO.Vida && EVO.Vida.iniciar({ definirTempo, definirCamada, mostrarDetalhe, abrirAba, estado, legenda, tocar, salvar });
    if (Array.isArray(config.gruposDesligados) && EVO.Vida) EVO.Vida.desligarGrupos(config.gruposDesligados);
    EVO.Perspectivas && EVO.Perspectivas.iniciar({ definirTempo, estado });
    if (["agora", "arvore", "detalhe"].includes(config.aba)) abrirAba(config.aba, true);
    EVO.Historias && EVO.Historias.iniciar({ definirTempo, definirCamada, tocar, abrirAba, estado, mostrarDetalhe, salvar });

    document.getElementById("btn-play").onclick = () => tocar(!estado.tocando);
    document.getElementById("velocidade").onchange = salvar;
    document.getElementById("modo-regua").onchange = (ev) => {
      definirModo(ev.target.value);
      if (estado.tempo > E.maximo) definirTempo(E.maximo);
    };
    document.querySelectorAll("#zoom [data-zoom]").forEach((b) => (b.onclick = () => EVO.Mapa.zoomPor(+b.dataset.zoom)));
    document.querySelectorAll(".abas button").forEach((b) => (b.onclick = () => abrirAba(b.dataset.aba)));
    document.querySelectorAll(".recolher").forEach((b) => (b.onclick = () => alternarPainel(b.dataset.alvo)));
    document.getElementById("btn-ajuda").onclick = () => EVO.Historias && EVO.Historias.ajuda();
    window.addEventListener("resize", atualizarBotoesReabrir);
    document.addEventListener("keydown", (ev) => {
      if (ev.target.closest("input, select, textarea")) return;
      if (ev.code === "Space") { ev.preventDefault(); tocar(!estado.tocando); }
      if (ev.code === "ArrowLeft" || ev.code === "ArrowRight") {
        const d = (ev.code === "ArrowLeft" ? -1 : 1) * (ev.shiftKey ? 0.01 : 0.002);
        tocar(false);
        definirTempo(E.tempo(E.posicao(estado.tempo) + d));
      }
      if (ev.code === "Escape") {
        EVO.Historias && EVO.Historias.fechar();
        document.getElementById("debates").hidden = true;
      }
    });
    window.addEventListener("hashchange", () => {
      const t = lerUrl();
      if (t != null && Math.abs(t - estado.tempo) > 1e-6) definirTempo(t, "url");
    });
    definirTempo(tUrl != null ? tUrl : 0, "url");
    legenda();
    atualizarBotoesReabrir();
    if (tUrl == null && EVO.Historias) EVO.Historias.boasVindas();
    if (/debug/.test(location.search)) {
      setInterval(() => { document.documentElement.dataset.debug = JSON.stringify(EVO.Mapa.medidas) + " carga " + Math.round(performance.now()); }, 500);
    }
  }

  EVO.App = { definirTempo, definirCamada, tocar, estado, abrirAba, mostrarDetalhe, legenda, salvar };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
