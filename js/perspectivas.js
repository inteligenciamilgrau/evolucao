/* Debates científicos: para temas com mais de uma posição séria, a pessoa escolhe qual
 * seguir. A opção escolhida é aplicada por cima do conteúdo base (marcos, rotas, grupos,
 * povos, datas de chegada dos sapiens, população das Américas) e fica guardada no navegador. */
(function () {
  const EVO = (window.EVO = window.EVO || {});
  const CHAVE = "evo-debates";

  let app, lista = [], base = null, escolhas = {};

  const clone = (x) => (x === undefined ? x : JSON.parse(JSON.stringify(x)));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  function iniciar(a) {
    app = a;
    const c = EVO_DADOS.conteudo;
    lista = c.perspectivas || [];
    base = { eventos: clone(c.eventos), grupos: clone(c.grupos), rotas: clone(c.rotas), povos: clone(c.povos),
      especies: clone((c.hominideos || {}).especies || []) };
    try { escolhas = JSON.parse(localStorage.getItem(CHAVE)) || {}; } catch (e) { escolhas = {}; }
    // descarta escolhas de debates ou opções que não existem mais
    for (const id of Object.keys(escolhas)) {
      const pv = lista.find((p) => p.id === id);
      if (!pv || !pv.opcoes.some((o) => o.id === escolhas[id])) delete escolhas[id];
    }
    const botao = document.getElementById("btn-debates");
    if (botao) {
      botao.hidden = !lista.length;
      botao.onclick = () => abrir();
    }
    aplicar();
  }

  function escolhida(pv) {
    return pv.opcoes.find((o) => o.id === escolhas[pv.id]) || pv.opcoes.find((o) => o.padrao) || pv.opcoes[0];
  }

  function substituir(alvo, novo) {
    alvo.length = 0;
    for (const x of novo) alvo.push(x);
  }

  function mesclar(itens, alteracoes, chave) {
    for (const [id, campos] of Object.entries(alteracoes || {})) {
      const item = itens.find((x) => x[chave] === id);
      if (item) Object.assign(item, clone(campos));
    }
  }

  /** Reaplica o conteúdo base + as opções escolhidas. */
  function aplicar() {
    const c = EVO_DADOS.conteudo;
    substituir(c.eventos, clone(base.eventos));
    substituir(c.grupos, clone(base.grupos));
    substituir(c.rotas, clone(base.rotas));
    substituir(c.povos, clone(base.povos));
    if (c.hominideos) substituir(c.hominideos.especies, clone(base.especies));
    const ajustes = { chegada: {}, americas1500: null, brasil1500: null };
    const clima = { bolaDeNeveLat: 0 };
    for (const pv of lista) {
      const alt = escolhida(pv).alteracoes || {};
      mesclar(c.eventos, alt.eventos, "id");
      mesclar(c.grupos, alt.grupos, "id");
      mesclar(c.rotas, alt.rotas, "id");
      mesclar(c.povos, alt.povos, "n");
      if (c.hominideos) mesclar(c.hominideos.especies, alt.hominideos, "id");
      for (const e of alt.eventos_extra || []) c.eventos.push(clone(e));
      for (const r of alt.rotas_extra || []) c.rotas.push(clone(r));
      Object.assign(ajustes.chegada, alt.chegada || {});
      if (alt.populacao && alt.populacao.americas_1500) ajustes.americas1500 = alt.populacao.americas_1500;
      if (alt.populacao && alt.populacao.brasil_1500) ajustes.brasil1500 = alt.populacao.brasil_1500;
      if (alt.clima && alt.clima.bola_de_neve_lat) clima.bolaDeNeveLat = alt.clima.bola_de_neve_lat;
    }
    EVO.Populacao && EVO.Populacao.definirAjustes(ajustes);
    EVO.Clima && EVO.Clima.definirAjustes(clima);
    EVO.Vida && EVO.Vida.recarregar && EVO.Vida.recarregar();
    EVO.Hominideos && EVO.Hominideos.recarregar();
    EVO.Mapa && EVO.Mapa.pedir();
  }

  /** Debates que mexem num item: tipo = "eventos" | "rotas" | "grupos" | "povos". */
  function debatesDe(tipo, id) {
    const extra = tipo === "eventos" ? "eventos_extra" : tipo === "rotas" ? "rotas_extra" : null;
    return lista.filter((pv) => pv.opcoes.some((o) => {
      const alt = o.alteracoes || {};
      return (alt[tipo] && Object.hasOwn(alt[tipo], id)) || (extra && (alt[extra] || []).some((x) => x.id === id));
    }));
  }

  /** Botões "⚖️ Há debate" para pôr nos painéis de detalhe. */
  function selos(tipo, id) {
    return debatesDe(tipo, id).map((pv) =>
      `<button class="botao selo-debate" data-debate="${esc(pv.id)}">⚖️ Há debate: ${esc(pv.titulo)}</button>`).join("");
  }

  function fonteHtml(f) {
    const texto = String(f);
    if (/^https?:\/\//i.test(texto)) {
      let rotulo = texto;
      try { rotulo = new URL(texto).hostname.replace(/^www\./, ""); } catch (e) { /* mantém o texto */ }
      return `<a href="${esc(texto)}" target="_blank" rel="noopener noreferrer">${esc(rotulo)}</a>`;
    }
    return esc(texto);
  }

  function abrir(foco) {
    const el = document.getElementById("debates");
    el.innerHTML = `<div class="janela"><button class="fechar" title="Fechar">×</button>
      <h2>Debates</h2>
      <p class="vazio">Em alguns temas os cientistas ainda não concordam. Escolha qual versão o mapa deve seguir: as datas, as rotas e a ocupação humana mudam junto. A versão marcada como "padrão" é a mais aceita hoje.</p>
      ${lista.map((pv) => {
        const atual = escolhida(pv);
        return `<section class="debate" id="debate-${esc(pv.id)}">
          <h3>${esc(pv.titulo)}</h3>
          <p class="vazio">${esc(pv.resumo || "")}</p>
          ${pv.opcoes.map((o) => `
            <label class="opcao-debate ${o === atual ? "escolhida" : ""}">
              <input type="radio" name="debate-${esc(pv.id)}" value="${esc(o.id)}" data-pv="${esc(pv.id)}" ${o === atual ? "checked" : ""}>
              <span>
                <b>${esc(o.nome)}</b>${o.padrao ? ' <em class="padrao">padrão</em>' : ""}
                <span class="texto">${esc(o.texto)}</span>
                ${(o.fontes || []).length ? `<small>Fontes: ${o.fontes.map(fonteHtml).join(" · ")}</small>` : ""}
              </span>
            </label>`).join("")}
        </section>`;
      }).join("")}
      <p><button class="botao" data-restaurar="1">Voltar todas para o padrão</button></p>
    </div>`;
    el.hidden = false;
    el.querySelector(".fechar").onclick = () => (el.hidden = true);
    el.onclick = (ev) => { if (ev.target === el) el.hidden = true; };
    el.querySelectorAll("input[data-pv]").forEach((r) => (r.onchange = () => {
      escolhas[r.dataset.pv] = r.value;
      salvar();
      aplicar();
      app.definirTempo(app.estado.tempo);
      r.closest(".debate").querySelectorAll(".opcao-debate").forEach((l) => l.classList.toggle("escolhida", l.contains(r)));
    }));
    el.querySelector("[data-restaurar]").onclick = () => {
      escolhas = {};
      salvar();
      aplicar();
      app.definirTempo(app.estado.tempo);
      abrir();
    };
    if (foco) {
      const alvo = document.getElementById("debate-" + foco);
      if (alvo) { alvo.scrollIntoView({ block: "start" }); alvo.classList.add("em-foco"); }
    }
  }

  function salvar() {
    try { localStorage.setItem(CHAVE, JSON.stringify(escolhas)); } catch (e) { /* sem armazenamento */ }
  }

  EVO.Perspectivas = { iniciar, abrir, debatesDe, selos, get total() { return lista.length; } };
})();
