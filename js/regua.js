/* Régua do tempo (SVG): faixas do modo atual, marcos da vida e cursor arrastável.
 * Passar o mouse num ícone ou numa faixa mostra o que é, antes de clicar. */
(function () {
  const EVO = (window.EVO = window.EVO || {});
  const E = () => EVO.Escala;

  let svg, larg = 0, aoMudar, eventos = [], tempo = 0, dica;
  const LINHAS = { evt: [0, 26], faixas: [[28, 11], [40, 15], [56, 19], [76, 14]], marcas: [92, 24] };

  const x = (t) => E().posicao(t) * larg;

  function iniciar(el, cb) {
    svg = d3.select(el);
    aoMudar = cb;
    dica = document.getElementById("regua-dica");
    const arrastar = (ev) => {
      const [px] = d3.pointer(ev, el);
      aoMudar(E().tempo(px / larg));
    };
    svg.on("pointerdown", (ev) => {
      if (ev.target.closest && ev.target.closest(".evt")) return;
      el.setPointerCapture(ev.pointerId);
      esconderDica();
      arrastar(ev);
      svg.on("pointermove.arrasto", arrastar);
    });
    svg.on("pointerup pointercancel", () => svg.on("pointermove.arrasto", null));
    svg.on("pointerleave", esconderDica);
    new ResizeObserver(desenhar).observe(el);
  }

  function definirEventos(lista) {
    eventos = lista;
    desenhar();
  }

  // ------------------------------------------------------------------ etiqueta
  function mostrarDica(ev, html) {
    if (!dica) return;
    dica.innerHTML = html;
    dica.hidden = false;
    const caixa = dica.parentElement.getBoundingClientRect();
    const px = ev.clientX - caixa.left;
    const w = dica.offsetWidth;
    dica.style.left = Math.max(0, Math.min(caixa.width - w, px - w / 2)) + "px";
  }

  function esconderDica() {
    if (dica) dica.hidden = true;
  }

  function intervalo(d) {
    return `${E().curto(d[1])} → ${E().curto(d[2])}`;
  }

  // ------------------------------------------------------------------ desenho
  function faixas(g, lista, [y, h], fonte) {
    const max = E().maximo;
    const visiveis = lista.filter((d) => d[2] < max).map((d) => [d[0], Math.min(d[1], max), d[2], d[3]]);
    const sel = g.selectAll(null).data(visiveis).enter().append("g").attr("class", "faixa")
      .on("pointermove", (ev, d) => mostrarDica(ev, `<b>${d[0]}</b><span>${intervalo(d)}</span>`))
      .on("pointerleave", esconderDica);
    sel.append("rect")
      .attr("x", (d) => x(d[1])).attr("y", y)
      .attr("width", (d) => Math.max(0.5, x(d[2]) - x(d[1]))).attr("height", h)
      .attr("fill", (d) => d[3]).attr("stroke", "#0b1424").attr("stroke-width", 0.6);
    sel.append("text")
      .attr("x", (d) => (x(d[1]) + x(d[2])) / 2).attr("y", y + h / 2 + 3.5)
      .attr("text-anchor", "middle").attr("fill", "#1a1a1a").style("font-size", fonte + "px")
      .text((d) => {
        const w = x(d[2]) - x(d[1]);
        const n = d[0];
        if (w > n.length * fonte * 0.62 + 6) return n;
        const ab = n.slice(0, Math.max(1, Math.floor((w - 4) / (fonte * 0.62))));
        return ab.length >= 3 ? ab + "." : ab.length >= 1 && w > 9 ? n[0] : "";
      });
  }

  function desenhar() {
    if (!svg) return;
    larg = svg.node().getBoundingClientRect().width;
    if (!larg) return;
    svg.selectAll("*").remove();
    const g = svg.append("g");
    const fontes = [9, 10, 10.5, 9.5];
    E().faixas.forEach((lista, i) => lista.length && faixas(g, lista, LINHAS.faixas[i], fontes[i]));

    // marcas de tempo
    const [ym] = LINHAS.marcas;
    let ultimoX = -100;
    for (const t of E().marcas) {
      const px = x(t);
      const texto = E().curto(t);
      const w = texto.length * 5.6;
      if (px - w / 2 < ultimoX + 4 && t !== 0) continue;
      if (t === 0 && px - w < ultimoX) continue;
      g.append("line").attr("x1", px).attr("x2", px).attr("y1", ym).attr("y2", ym + 4).attr("stroke", "#4b5f78");
      g.append("text").attr("x", Math.min(px, larg - w / 2)).attr("y", ym + 14).attr("text-anchor", "middle")
        .attr("fill", "#7f93ab").text(texto);
      ultimoX = px + w / 2;
    }

    // marcos (ícones) dentro do intervalo da régua
    const ocupado = [];
    const evts = eventos.filter((e) => e.t <= E().maximo).sort((a, b) => (a.prio || 9) - (b.prio || 9));
    const ge = g.append("g");
    for (const ev of evts) {
      const px = x(ev.t);
      let fila = -1;
      for (let f = 0; f < 2 && fila < 0; f++) {
        if (!ocupado.some((o) => o.f === f && Math.abs(o.x - px) < 15)) fila = f;
      }
      if (fila < 0) continue;
      ocupado.push({ x: px, f: fila });
      const item = ge.append("g").attr("class", "evt").attr("transform", `translate(${px},${fila ? 24 : 12})`)
        .on("click", (e) => { e.stopPropagation(); esconderDica(); aoMudar(ev.t, ev); })
        .on("pointerenter pointermove", (e) => mostrarDica(e, `<b>${ev.icone} ${ev.titulo}</b><span>${E().formatar(ev.t)} · clique para ir</span>`))
        .on("pointerleave", esconderDica);
      item.append("circle").attr("r", 9).attr("cy", fila ? -6 : -1).attr("fill", "transparent");
      item.append("text").attr("text-anchor", "middle").attr("y", fila ? -2 : 3).style("font-size", "13px").text(ev.icone);
    }

    // cursor
    const gc = g.append("g").attr("class", "cursor").style("pointer-events", "none");
    gc.append("line").attr("y1", LINHAS.faixas[0][0] - 2).attr("y2", ym + 2).attr("stroke", "#fff").attr("stroke-width", 2);
    gc.append("path").attr("d", "M-6,24 L6,24 L0,31 Z").attr("fill", "#f2b84b");
    atualizar(tempo);
  }

  function atualizar(t) {
    tempo = t;
    if (!svg) return;
    svg.select(".cursor").attr("transform", `translate(${x(t)},0)`);
  }

  EVO.Regua = { iniciar, atualizar, definirEventos, desenhar };
})();
