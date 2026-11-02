/* Escala do tempo geológico (ICS 2024) e mapeamento do controle deslizante.
 * Tempos sempre em milhões de anos atrás (Ma). */
(function () {
  const EVO = (window.EVO = window.EVO || {});

  // [nome, início (Ma), fim (Ma), cor oficial ICS]
  const EONS = [
    ["Hadeano", 4600, 4031, "#AE027E"],
    ["Arqueano", 4031, 2500, "#F0047F"],
    ["Proterozoico", 2500, 538.8, "#F73563"],
    ["Fanerozoico", 538.8, 0, "#9AD9DD"],
  ];
  const ERAS = [
    ["Hadeano", 4600, 4031, "#AE027E"],
    ["Eoarqueano", 4031, 3600, "#DA037F"],
    ["Paleoarqueano", 3600, 3200, "#F444A9"],
    ["Mesoarqueano", 3200, 2800, "#F768A9"],
    ["Neoarqueano", 2800, 2500, "#F99BC1"],
    ["Paleoproterozoico", 2500, 1600, "#F74370"],
    ["Mesoproterozoico", 1600, 1000, "#FDB462"],
    ["Neoproterozoico", 1000, 538.8, "#FEB342"],
    ["Paleozoico", 538.8, 251.902, "#99C08D"],
    ["Mesozoico", 251.902, 66, "#67C5CA"],
    ["Cenozoico", 66, 0, "#F2F91D"],
  ];
  const PERIODOS = [
    ["Hadeano", 4600, 4031, "#AE027E"],
    ["Arqueano", 4031, 2500, "#F0047F"],
    ["Sideriano", 2500, 2300, "#F74F7C"],
    ["Riaciano", 2300, 2050, "#F75B89"],
    ["Orosiriano", 2050, 1800, "#F76898"],
    ["Estateriano", 1800, 1600, "#F875A7"],
    ["Calimiano", 1600, 1400, "#FDC07A"],
    ["Ectasiano", 1400, 1200, "#F3CC8A"],
    ["Esteniano", 1200, 1000, "#FED99A"],
    ["Toniano", 1000, 720, "#FEBF4E"],
    ["Criogeniano", 720, 635, "#FECC5C"],
    ["Ediacarano", 635, 538.8, "#FED96A"],
    ["Cambriano", 538.8, 486.85, "#7FA056"],
    ["Ordoviciano", 486.85, 443.1, "#009270"],
    ["Siluriano", 443.1, 419.62, "#B3E1B6"],
    ["Devoniano", 419.62, 358.86, "#CB8C37"],
    ["Carbonífero", 358.86, 298.9, "#67A599"],
    ["Permiano", 298.9, 251.902, "#F04028"],
    ["Triássico", 251.902, 201.4, "#812B92"],
    ["Jurássico", 201.4, 143.1, "#34B2C9"],
    ["Cretáceo", 143.1, 66, "#7FC64E"],
    ["Paleógeno", 66, 23.04, "#FD9A52"],
    ["Neógeno", 23.04, 2.58, "#FFE619"],
    ["Quaternário", 2.58, 0, "#F9F97F"],
  ];
  const EPOCAS = [
    ["Paleoceno", 66, 56, "#FDA75F"],
    ["Eoceno", 56, 33.9, "#FDB46C"],
    ["Oligoceno", 33.9, 23.04, "#FEC07A"],
    ["Mioceno", 23.04, 5.333, "#FFFF00"],
    ["Plioceno", 5.333, 2.58, "#FFFF99"],
    ["Pleistoceno", 2.58, 0.0117, "#FFF2AE"],
    ["Holoceno", 0.0117, 0, "#FEF2E0"],
  ];

  const ANO = 2025; // "hoje" para as contas de anos atrás
  const A = (ano) => (ANO - ano) / 1e6; // ano do calendário -> Ma

  // Faixas extras para as réguas de "Humanos" e "História"
  const IDADES_HUMANOS = [
    ["Messiniano", 7.0, 5.333, "#FFFF73"],
    ["Zancleano", 5.333, 3.6, "#FFFFB3"], ["Piacenziano", 3.6, 2.58, "#FFFFBF"],
    ["Gelasiano", 2.58, 1.8, "#FFEDB3"], ["Calabriano", 1.8, 0.774, "#FFF2BA"],
    ["Chibaniano", 0.774, 0.129, "#FFF2C7"], ["Tarantiano", 0.129, 0.0117, "#FFF2D3"],
    ["Groenlandiano", 0.0117, 0.0082, "#FEECDB"], ["Nortegripiano", 0.0082, 0.0042, "#FDECE4"],
    ["Meghalaiano", 0.0042, 0, "#FDEDEC"],
  ];
  const CULTURAS = [
    ["Antes das ferramentas", 7, 3.3, "#9e9e9e"], ["Paleolítico Inferior", 3.3, 0.3, "#c9a27e"],
    ["Paleolítico Médio", 0.3, 0.05, "#b38b64"], ["Paleolítico Superior", 0.05, 0.0117, "#a07a55"],
    ["Neolítico", 0.0117, A(-3500), "#8fb36b"], ["História escrita", A(-3500), 0, "#d9b36c"],
  ];
  const HISTORIA = [
    ["Pré-história", 0.0117, A(-3500), "#a1887f"], ["Idade Antiga", A(-3500), A(476), "#d4a373"],
    ["Idade Média", A(476), A(1453), "#90a4d4"], ["Idade Moderna", A(1453), A(1789), "#a5c882"],
    ["Contemporânea", A(1789), 0, "#e8a598"],
  ];
  const BRASIL = [
    ["Brasil indígena (pré-cabralino)", 0.0117, A(1500), "#7fb069"], ["Colônia", A(1500), A(1822), "#d6b84a"],
    ["Império", A(1822), A(1889), "#6c9bd2"], ["República", A(1889), 0, "#4fb286"],
  ];

  // Modos da régua. trechos: [mais antigo, mais recente, peso, tipo]; "log" dá mais
  // espaço ao fim do trecho (ex.: os últimos 100 mil anos do Pleistoceno).
  const MODOS = {
    tudo: {
      nome: "Tudo", desloc: 0.0002,
      trechos: [[4600, 1800, 0.06, "lin"], [1800, 1000, 0.06, "lin"], [1000, 538.8, 0.09, "lin"],
        [538.8, 251.902, 0.21, "lin"], [251.902, 66, 0.21, "lin"], [66, 2.58, 0.17, "lin"],
        [2.58, 0.0117, 0.12, "log"], [0.0117, 0, 0.08, "log"]],
      faixas: [EONS, ERAS, PERIODOS, EPOCAS],
      marcas: [4600, 4000, 3000, 2500, 2000, 1800, 1500, 1000, 720, 635, 538.8, 485, 444, 419, 359, 299, 252,
        201, 145, 100, 66, 56, 34, 23, 10, 5.3, 2.6, 1, 0.3, 0.1, 0.05, 0.02, 0.0117, 0.005, A(0), A(1500), 0],
    },
    humanos: {
      nome: "Humanos", desloc: 0.00003,
      trechos: [[7, 0.3, 0.3, "log"], [0.3, 0.0117, 0.42, "log"], [0.0117, 0, 0.28, "log"]],
      faixas: [EPOCAS, IDADES_HUMANOS, CULTURAS, []],
      marcas: [7, 5, 3, 2, 1, 0.5, 0.3, 0.2, 0.1, 0.07, 0.05, 0.03, 0.02, 0.0117, A(-5000), A(0), A(1000), A(1500), A(1800), A(1900), 0],
    },
    historia: {
      nome: "História", desloc: 0,
      trechos: [[0.0117, A(-3500), 0.2, "lin"], [A(-3500), A(1500), 0.42, "lin"], [A(1500), 0, 0.38, "lin"]],
      faixas: [IDADES_HUMANOS, HISTORIA, BRASIL, []],
      marcas: [A(-9000), A(-7000), A(-5000), A(-3500), A(-2500), A(-1500), A(-500), A(0), A(500), A(1000), A(1500),
        A(1600), A(1700), A(1800), A(1900), A(1950), 0],
    },
  };
  for (const m of Object.values(MODOS)) {
    const soma = m.trechos.reduce((s, t) => s + t[2], 0);
    let acc = 0;
    for (const t of m.trechos) {
      t[4] = acc;
      acc += t[2] / soma;
      t[5] = acc;
    }
    m.maximo = m.trechos[0][0];
  }
  let modo = MODOS.tudo;
  let nomeModo = "tudo";

  function definirModo(nome) {
    if (!MODOS[nome]) return;
    modo = MODOS[nome];
    nomeModo = nome;
  }

  /** Menor modo que contém t (o atual, se couber). */
  function modoPara(t) {
    if (t <= modo.maximo + 1e-9) return nomeModo;
    return t <= MODOS.humanos.maximo ? "humanos" : "tudo";
  }

  const f = (t) => Math.log(t + modo.desloc);

  /** Tempo (Ma) -> posição 0..1 na régua do modo atual (1 = hoje). */
  function posicao(t) {
    t = Math.max(0, Math.min(modo.maximo, t));
    for (const [a, b, , tipo, p0, p1] of modo.trechos) {
      if (t <= a && t >= b) {
        const u = tipo === "log" ? (f(a) - f(t)) / (f(a) - f(b)) : (a - t) / (a - b);
        return p0 + u * (p1 - p0);
      }
    }
    return 1;
  }

  /** Posição 0..1 -> tempo (Ma). */
  function tempo(p) {
    p = Math.max(0, Math.min(1, p));
    for (const [a, b, , tipo, p0, p1] of modo.trechos) {
      if (p >= p0 && p <= p1) {
        const u = (p - p0) / (p1 - p0);
        if (tipo === "log") return Math.max(0, Math.exp(f(a) - u * (f(a) - f(b))) - modo.desloc);
        return a - u * (a - b);
      }
    }
    return 0;
  }

  /** Intervalo que contém t; o limite pertence ao intervalo mais novo (66 Ma = Paleógeno). */
  function achar(lista, t) {
    for (const item of lista) if (t <= item[1] && t > item[2]) return item;
    return lista[lista.length - 1];
  }

  const num = (v, casas) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

  /** Texto amigável: "252,0 milhões de anos atrás", "70 mil anos atrás", "1500 d.C." */
  function formatar(t) {
    if (t <= 0.0000015) return "Hoje";
    if (t >= 1000) {
      const b = t / 1000;
      return `${num(b, 2)} ${b < 2 ? "bilhão" : "bilhões"} de anos atrás`;
    }
    if (t >= 1) return `${num(t, t >= 100 ? 0 : 1)} milhões de anos atrás`.replace(/^1,0 milhões/, "1 milhão");
    const anos = t * 1e6;
    if (anos >= 12000) return `${num(Math.round(anos / 1000), 0)} mil anos atrás`;
    const ano = Math.round(ANO - anos);
    const arred = Math.abs(ano) > 3000 ? Math.round(ano / 100) * 100 : Math.abs(ano) > 300 ? Math.round(ano / 10) * 10 : ano;
    return `${num(Math.round(anos), 0)} anos atrás · ${arred < 0 ? `${-arred} a.C.` : `${arred} d.C.`}`;
  }

  /** Versão curta para rótulos: "252 Ma", "70 mil", "1500 d.C." */
  function curto(t) {
    if (t <= 0.0000015) return "hoje";
    if (t >= 1000) return `${num(t / 1000, 1)} bi`;
    if (t >= 1) return `${num(t, t >= 10 ? 0 : 1)} mi`;
    const anos = t * 1e6;
    if (anos >= 12000) return `${Math.round(anos / 1000)} mil`;
    const ano = Math.round(ANO - anos);
    return ano < 0 ? `${-ano} a.C.` : `${ano} d.C.`;
  }

  EVO.Escala = {
    EONS, ERAS, PERIODOS, EPOCAS, MODOS, ANO, A, posicao, tempo, formatar, curto, definirModo, modoPara,
    get modo() { return nomeModo; },
    get faixas() { return modo.faixas; },
    get marcas() { return modo.marcas; },
    get maximo() { return modo.maximo; },
    eon: (t) => achar(EONS, t),
    era: (t) => achar(ERAS, t),
    periodo: (t) => achar(PERIODOS, t),
    epoca: (t) => (t <= 66 ? achar(EPOCAS, t) : null),
  };
})();
