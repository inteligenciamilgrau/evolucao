/* Histórias guiadas, boas-vindas e ajuda. */
(function () {
  const EVO = (window.EVO = window.EVO || {});
  const E = () => EVO.Escala;

  let app, historias = [];
  let atual = null; // { h, i, camadasOriginais }
  let animacao = null;

  function iniciar(a) {
    app = a;
    historias = (EVO_DADOS.conteudo && EVO_DADOS.conteudo.historias) || [];
    document.getElementById("btn-historias").onclick = abrirLista;
  }

  // ------------------------------------------------------------------ janelas
  function modal(id, html) {
    const el = document.getElementById(id);
    el.innerHTML = `<div class="janela"><button class="fechar" title="Fechar">×</button>${html}</div>`;
    el.hidden = false;
    el.querySelector(".fechar").onclick = () => (el.hidden = true);
    el.onclick = (ev) => { if (ev.target === el) el.hidden = true; };
    return el;
  }

  function abrirLista() {
    const el = modal("historias", `
      <h2>Histórias</h2>
      <p class="vazio">Passeios guiados que juntam geologia e vida. Use ← → no cartão para avançar.</p>
      <div class="grade-historias">
        ${historias.map((h) => `<div class="cartao" data-h="${h.id}"><div class="emoji">${h.emoji}</div><h3>${h.titulo}</h3><p>${h.resumo}</p></div>`).join("")}
      </div>`);
    el.querySelectorAll("[data-h]").forEach((c) => (c.onclick = () => { el.hidden = true; comecar(c.dataset.h); }));
  }

  function boasVindas() {
    try { if (localStorage.getItem("evo-visto")) return; } catch (e) { /* sem armazenamento */ }
    const el = modal("ajuda", `
      <h2>4,6 bilhões de anos em um mapa</h2>
      <p>Veja os continentes se moverem desde antes da Pangeia e a vida surgir e se espalhar, das primeiras bactérias até os humanos.</p>
      <ul>
        <li>Arraste a <b>régua do tempo</b> embaixo ou aperte <b>▶</b>.</li>
        <li>Os <b>países e estados de hoje</b> viajam junto com as placas, então dá para saber onde estava cada lugar.</li>
        <li>Os <b>pontos coloridos são fósseis reais</b>, mostrados onde estavam quando o ser vivia.</li>
        <li>As <b>linhas animadas</b> mostram como cada grupo chegou aonde vive: a pé, flutuando, voando ou levado por humanos.</li>
        <li>No fim, a camada <b>População humana</b> mostra como a humanidade saiu da África e ocupou o planeta até os 8 bilhões de hoje.</li>
      </ul>
      <p style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px">
        <button class="botao destaque" data-acao="inicio">▶ Assistir desde o começo</button>
        <button class="botao" data-acao="historias">Ver histórias</button>
        <button class="botao" data-acao="explorar">Explorar livremente</button>
      </p>`);
    try { localStorage.setItem("evo-visto", "1"); } catch (e) { /* sem armazenamento */ }
    el.querySelector('[data-acao="inicio"]').onclick = () => { el.hidden = true; app.definirTempo(4600); app.tocar(true); };
    el.querySelector('[data-acao="historias"]').onclick = () => { el.hidden = true; abrirLista(); };
    el.querySelector('[data-acao="explorar"]').onclick = () => { el.hidden = true; };
  }

  function ajuda() {
    modal("ajuda", `
      <h2>Como usar</h2>
      <ul>
        <li><b>Régua:</b> no seletor ao lado do ▶, escolha "tudo" (4,6 bilhões de anos), "humanos" (7 milhões) ou "história" (12 mil anos).</li>
        <li><b>Tempo:</b> arraste a régua ou clique num ícone de marco (passe o mouse para ver o que é). Teclas ← → avançam (Shift dá passos maiores) e Espaço inicia ou pausa. A régua não é linear: os bilhões de anos sem fósseis ficam comprimidos e os últimos milhões de anos, ampliados.</li>
        <li><b>Mapa:</b> role para aproximar e arraste para mover. Passe o mouse sobre países, fósseis e rotas, e clique para ver detalhes.</li>
        <li><b>Camadas:</b> ligue estados e macrorregiões do Brasil, EUA, Rússia e China, limites de placas, gelo e o mar baixo das eras glaciais.</li>
        <li><b>Árvore da vida:</b> na aba da direita, ligue ou desligue os fósseis de cada grupo.</li>
      </ul>
      <h4>Como ler o mapa</h4>
      <p>A linha amarela é o <b>equador da época</b>. Se um lugar estava perto dele, era tropical; perto dos polos, frio. Isso explica corais fossilizados no Ártico e geleiras antigas em São Paulo. As cores da terra são biomas <b>aproximados</b>, calculados pela latitude e pelo clima global de cada época.</p>
      <p>Antes de 1,8 bilhão de anos não se sabe onde estavam os continentes: o mapa mostra só a crosta que já existia, esmaecida.</p>
      <h4>Fontes</h4>
      <p class="vazio">
        Placas tectônicas: modelo de Cao et al. (2024), 1,8 bilhão de anos (GPlates / Zenodo 10.5281/zenodo.11536686), reconstruído no navegador.<br>
        Países, estados e batimetria: Natural Earth (domínio público).<br>
        Fósseis: Paleobiology Database (paleobiodb.org), CC BY 4.0.<br>
        População: ISIMIP3a (grades de 1850 a 2021, derivadas da HYDE) e Our World in Data / HYDE 3.3 (Klein Goldewijk et al.), totais por país de 10.000 a.C. a 1850. Antes disso, datas de chegada dos sapiens segundo a literatura arqueológica.<br>
        Escala do tempo e cores: Comissão Internacional de Estratigrafia (ICS 2024).<br>
        Clima, gelo e nível do mar: valores simplificados a partir de Scotese et al. (2021) e Spratt &amp; Lisiecki (2016).<br>
        Textos e rotas de dispersão: curadoria a partir da literatura científica. As rotas são esquemáticas.
      </p>`);
  }

  // ------------------------------------------------------------------ histórias
  function comecar(id) {
    const h = historias.find((x) => x.id === id);
    if (!h) return;
    if (!atual) atual = { camadasOriginais: { ...app.estado.camadas } };
    atual.h = h;
    app.tocar(false);
    irPasso(0);
  }

  function fechar() {
    document.getElementById("historias").hidden = true;
    document.getElementById("ajuda").hidden = true;
    if (!atual) return;
    cancelarAnimacao();
    for (const [k, v] of Object.entries(atual.camadasOriginais)) app.definirCamada(k, v);
    EVO.Vida.destacar(null);
    document.getElementById("cartao-historia").hidden = true;
    atual = null;
    app.salvar && app.salvar();
  }

  function cancelarAnimacao() {
    if (animacao) cancelAnimationFrame(animacao);
    animacao = null;
  }

  function irPasso(i) {
    const { h } = atual;
    i = Math.max(0, Math.min(h.passos.length - 1, i));
    atual.i = i;
    const passo = h.passos[i];
    // camadas: começa das originais e aplica as do passo
    for (const [k, v] of Object.entries(atual.camadasOriginais)) app.definirCamada(k, v);
    for (const [k, v] of Object.entries(passo.camadas || {})) app.definirCamada(k, v);
    if (passo.grupos && passo.grupos.length) app.definirCamada("fosseis", true);
    if (passo.rotas && passo.rotas.length) app.definirCamada("rotas", true);
    if (passo.eventos && passo.eventos.length) app.definirCamada("sitios", true);
    EVO.Vida.destacar({ grupos: passo.grupos, rotas: passo.rotas, eventos: passo.eventos });
    mostrarCartao();
    animarAte(passo);
  }

  function mostrarCartao() {
    const { h, i } = atual;
    const passo = h.passos[i];
    const el = document.getElementById("cartao-historia");
    el.hidden = false;
    el.innerHTML = `
      <div class="passo">${h.emoji} ${h.titulo} · ${i + 1} de ${h.passos.length}</div>
      <h3>${passo.titulo}</h3>
      <p>${passo.texto}</p>
      <div class="nav">
        <button class="botao" data-nav="sair">Sair</button>
        <button class="botao" data-nav="ant" ${i === 0 ? "disabled" : ""}>← Anterior</button>
        ${i < h.passos.length - 1 ? `<button class="botao destaque" data-nav="prox">Próximo →</button>` : `<button class="botao destaque" data-nav="mais">Outras histórias</button>`}
      </div>`;
    el.querySelector('[data-nav="sair"]').onclick = fechar;
    el.querySelector('[data-nav="ant"]').onclick = () => irPasso(i - 1);
    const prox = el.querySelector('[data-nav="prox"]');
    if (prox) prox.onclick = () => irPasso(i + 1);
    const mais = el.querySelector('[data-nav="mais"]');
    if (mais) mais.onclick = () => { fechar(); abrirLista(); };
  }

  /** Viaja no tempo até o passo; a câmera acompanha o ponto de foco, que se move com a placa. */
  function animarAte(passo) {
    cancelarAnimacao();
    const rotas = (passo.rotas || []).map((id) => EVO_DADOS.conteudo.rotas.find((r) => r.id === id)).filter(Boolean);
    let t0 = app.estado.tempo;
    let duracao = 1600;
    if (rotas.length) {
      // começa um pouco antes da rota para ver o caminho sendo percorrido
      const inicio = Math.max(...rotas.map((r) => r.de));
      if (inicio > passo.t) { t0 = inicio + (inicio - passo.t) * 0.05; duracao = 4200; }
    }
    const p0 = E().posicao(t0), p1 = E().posicao(passo.t);
    const k0 = EVO.Mapa.zoom, k1 = passo.zoom || 1;
    const comeco = performance.now();
    const suave = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
    const quadro = (agora) => {
      const f = Math.min(1, (agora - comeco) / duracao);
      const u = rotas.length ? f : suave(f);
      const t = f >= 1 ? passo.t : E().tempo(p0 + (p1 - p0) * u);
      app.definirTempo(t);
      EVO.Rotacao.definirTempo(Math.min(t, EVO.Rotacao.tempoMaximo));
      const foco = EVO.Rotacao.reconstruir(passo.foco[0], passo.foco[1], passo.foco[2]);
      const k = k0 + (k1 - k0) * suave(Math.min(1, f * 1.5));
      if (foco) EVO.Mapa.irPara(foco[0], foco[1], k, 0);
      animacao = f < 1 ? requestAnimationFrame(quadro) : null;
    };
    animacao = requestAnimationFrame(quadro);
  }

  document.addEventListener("keydown", (ev) => {
    if (!atual || document.getElementById("cartao-historia").hidden) return;
    if (ev.code === "ArrowRight" && atual.i < atual.h.passos.length - 1) { ev.stopImmediatePropagation(); irPasso(atual.i + 1); }
    if (ev.code === "ArrowLeft" && atual.i > 0) { ev.stopImmediatePropagation(); irPasso(atual.i - 1); }
  }, true);

  EVO.Historias = { iniciar, boasVindas, ajuda, fechar, abrirLista, comecar, get ativa() { return !!atual; } };
})();
