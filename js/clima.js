/* Clima aproximado ao longo do tempo: gelo polar, nível do mar nas glaciações,
 * temperatura média global e cobertura vegetal dos continentes.
 * Valores simplificados a partir de Scotese et al. (2021), Spratt & Lisiecki (2016)
 * e da cronologia das glaciações. Servem para colorir o mapa, não para pesquisa. */
(function () {
  const EVO = (window.EVO = window.EVO || {});

  function interp(tabela, t, col) {
    if (t <= tabela[0][0]) return tabela[0][col];
    for (let i = 1; i < tabela.length; i++) {
      const a = tabela[i - 1], b = tabela[i];
      if (t <= b[0]) return a[col] + ((t - a[0]) / (b[0] - a[0])) * (b[col] - a[col]);
    }
    return tabela[tabela.length - 1][col];
  }

  // Temperatura média global (°C) [Ma, °C]
  const TEMPERATURA = [
    [0, 14.5], [0.02, 9], [0.06, 11], [0.125, 15.5], [0.14, 9.5], [0.4, 15], [0.43, 9],
    [1, 12.5], [2.6, 15.5], [3.3, 18], [5.3, 17], [15, 18.5], [23, 17], [33.5, 16.5], [34.5, 20],
    [40, 22], [50, 26], [56, 28], [58, 23], [66, 21], [90, 28], [120, 22], [145, 20], [183, 24],
    [200, 24], [230, 23], [250, 30], [252, 32], [255, 22], [270, 18], [290, 14], [305, 13],
    [330, 15], [345, 18], [360, 20], [372, 24], [420, 22], [443, 15], [447, 22], [500, 24],
    [520, 26], [540, 22], [570, 18], [580, 12], [590, 18], [634, 18], [636, -20], [650, -20],
    [655, 15], [659, 15], [662, -20], [716, -20], [720, 15], [2200, 15], [2220, -10], [2420, -10],
    [2450, 18], [4031, 30], [4500, 60], [4600, 80],
  ];

  // Latitude a partir da qual há gelo permanente [Ma, norte, sul]; 90 = sem gelo
  const GELO = [
    [2.7, 80, 64], [7, 84, 64], [14, 88, 65], [33.6, 90, 66], [34.2, 90, 90],
    [262, 90, 90], [270, 90, 72], [285, 90, 58], [300, 82, 50], [330, 88, 58], [345, 90, 68],
    [360, 90, 72], [372, 90, 90], [442, 90, 90], [443.5, 90, 58], [446, 90, 60], [448, 90, 90],
    [578, 90, 90], [580, 62, 62], [583, 90, 90],
    [633, 90, 90], [635.5, 0, 0], [649, 0, 0], [652, 90, 90],
    [659, 90, 90], [661, 0, 0], [716, 0, 0], [719, 90, 90],
    [2215, 90, 90], [2225, 25, 25], [2420, 25, 25], [2430, 90, 90], [4600, 90, 90],
  ];

  // Nível do mar (m, relativo a hoje) [mil anos, metros]
  const NIVEL_MAR = [
    [0, 0], [6, -2], [8, -15], [10, -45], [11.7, -55], [13, -70], [14.5, -95], [16, -112],
    [19, -125], [22, -130], [26, -124], [30, -90], [35, -82], [45, -74], [55, -80], [62, -88],
    [70, -68], [76, -50], [82, -24], [88, -48], [100, -24], [105, -44], [116, -18], [120, 4],
    [125, 6], [130, -30], [135, -100], [140, -122], [150, -108], [160, -120], [180, -88],
    [190, -58], [200, -20], [215, -78], [230, -40], [240, 0], [250, -80], [260, -118],
    [270, -88], [290, -58], [320, -18], [330, 2], [340, -80], [350, -118], [360, -98],
    [380, -58], [400, 2], [420, -20], [430, -120], [440, -108], [460, -58], [480, -78],
    [500, -48], [520, -58], [530, -48], [545, -88], [560, -58], [580, -38], [600, -48],
    [620, -118], [630, -108], [650, -88], [680, -78], [700, -48], [730, -68], [750, -88],
    [790, -40], [800, -60],
  ];

  /** Nível do mar (m) — só definido nos últimos ~2,6 milhões de anos. */
  function nivelMar(t) {
    if (t > 2.7) return 15; // Plioceno mais quente: mar mais alto
    const ka = t * 1000;
    if (ka <= 800) return interp(NIVEL_MAR, ka, 1);
    // antes de 800 mil anos: ciclos de 41 mil anos, menores
    return -38 - 32 * Math.sin((2 * Math.PI * ka) / 41);
  }

  /** Intensidade glacial 0..1 (0 = interglacial como hoje, 1 = máximo glacial). */
  function glacial(t) {
    if (t > 2.7) return 0;
    return Math.max(0, Math.min(1, -nivelMar(t) / 125));
  }

  // Debate "Terra bola de neve": latitude mínima do gelo nas glaciações globais
  // (0 = congelou inteira; ~15 = sobrou uma faixa de mar aberto nos trópicos)
  let bolaDeNeveLat = 0;
  function definirAjustes(aj) {
    bolaDeNeveLat = (aj && aj.bolaDeNeveLat) || 0;
  }

  function gelo(t) {
    if (t <= 2.7) {
      const g = glacial(t);
      return { norte: 78 - g * 10, sul: 63 - g * 5 };
    }
    return { norte: Math.max(bolaDeNeveLat, interp(GELO, t, 1)), sul: Math.max(bolaDeNeveLat, interp(GELO, t, 2)) };
  }

  const temperatura = (t) => interp(TEMPERATURA, t, 1);

  /** Fração da terra coberta por plantas (0 = rocha nua). */
  function vegetacao(t) {
    if (t > 470) return 0;
    return interp([[0, 1], [360, 1], [385, 0.7], [425, 0.35], [470, 0.08]], t, 1);
  }

  /** Expansão dos campos e savanas (gramíneas), 0..1 */
  const campos = (t) => (t > 30 ? 0 : interp([[0, 1], [7, 1], [20, 0.4], [30, 0]], t, 1));

  function regime(t) {
    const g = gelo(t);
    if (g.norte < 5 && g.sul < 5) return { nome: "Terra bola de neve", cor: "#dff3ff" };
    if (bolaDeNeveLat && g.norte <= bolaDeNeveLat + 0.01 && g.sul <= bolaDeNeveLat + 0.01) return { nome: "Terra bola de lama", cor: "#dff3ff" };
    if (t > 4400) return { nome: "Oceano de magma", cor: "#ff7a3a" };
    if (t > 4031) return { nome: "Terra primitiva", cor: "#d9825b" };
    if (t <= 2.7 && glacial(t) > 0.6) return { nome: "Era glacial (máximo)", cor: "#bfe6ff" };
    if (g.norte < 89 || g.sul < 89) return { nome: "Casa de gelo", cor: "#a9d8f5" };
    const T = temperatura(t);
    if (T >= 25) return { nome: "Estufa extrema", cor: "#ff9b73" };
    return { nome: "Estufa", cor: "#ffc48a" };
  }

  // Mantos de gelo do Último Máximo Glacial (~20 mil anos), contorno simplificado (lon, lat)
  const MANTOS = [
    { nome: "Laurentide e Cordilheirano", pts: [[-124, 47], [-121, 48.6], [-114, 48.8], [-105, 48.6], [-97, 45], [-93, 42], [-89, 38.6], [-85, 39], [-81, 40.6], [-75, 41], [-70, 41.4], [-66, 43], [-60, 45], [-55, 47], [-52, 52], [-60, 58], [-64, 62], [-68, 66], [-70, 70], [-75, 75], [-70, 78], [-75, 82], [-90, 82], [-110, 79], [-125, 76], [-125, 70], [-130, 68], [-136, 67], [-141, 64], [-140, 61], [-145, 60.5], [-135, 57], [-131, 52], [-127, 49], [-124, 47]] },
    { nome: "Groenlândia", pts: [[-45, 60], [-50, 64], [-54, 70], [-58, 76], [-68, 79], [-60, 82], [-35, 83.5], [-20, 82], [-18, 76], [-22, 70], [-32, 68], [-40, 65], [-45, 60]], fixo: true },
    { nome: "Escandinavo e Britânico", pts: [[-10, 54], [-6, 51.5], [-2, 51.8], [2, 53], [8, 54], [14, 53], [20, 52.5], [28, 54], [32, 56], [38, 59], [45, 62], [55, 64], [62, 66], [70, 70], [80, 73], [90, 76], [100, 79], [80, 81], [60, 81.5], [40, 81], [20, 80.5], [10, 79], [15, 75], [10, 70], [5, 63], [-2, 60], [-8, 58], [-11, 55], [-10, 54]] },
    { nome: "Patagônico", pts: [[-74, -40], [-71, -40], [-71, -46], [-70.5, -50], [-69, -54], [-67, -55.5], [-72, -55], [-75.5, -52], [-75.5, -46], [-74, -40]] },
  ];
  // D3 quer anéis no sentido horário; garanta isso uma vez
  for (const m of MANTOS) {
    const geo = { type: "Polygon", coordinates: [m.pts] };
    if (d3.geoArea(geo) > 2 * Math.PI) m.pts.reverse();
    m.geo = { type: "Polygon", coordinates: [m.pts] };
  }

  EVO.Clima = { nivelMar, glacial, gelo, temperatura, vegetacao, campos, regime, MANTOS, definirAjustes };
})();
