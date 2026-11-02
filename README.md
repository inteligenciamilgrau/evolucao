# Evolução: Terra e Vida

Um mapa interativo de 4,6 bilhões de anos: os continentes se movem segundo um modelo
científico de placas tectônicas, a vida surge e se espalha por eles, e no fim os humanos
saem da África e ocupam o planeta até os 8 bilhões de hoje.

**Para abrir:** dê dois cliques em `index.html`. Não precisa de servidor nem de internet.

## O que tem no mapa

| Camada | O que mostra |
|---|---|
| Placas e continentes | Reconstrução do modelo Cao et al. (2024), de 1,8 bilhão de anos até hoje: Colúmbia, Rodínia, Gondwana, Pangeia... |
| Países e estados de hoje | Cada país (e os estados e macrorregiões de Brasil, EUA, Rússia e China) é cortado pelas placas e viaja junto. Mostra onde cada lugar estava. |
| Limites de placas | Dorsais, zonas de subducção, falhas transformantes e riftes a cada 5–10 milhões de anos. |
| Clima | Gelo polar, Terra bola de neve, eras glaciais, mar baixo (Beríngia, Sunda, Sahul) e biomas aproximados pela latitude. |
| Fósseis | Centenas de milhares de ocorrências reais da Paleobiology Database, de 34 grupos, na posição em que estavam quando o ser vivia. |
| Rotas de dispersão | Como cada grupo chegou aonde vive: por terra, em jangadas de vegetação, voando ou levado por humanos. |
| População humana | Antes da agricultura, as regiões já ocupadas pelos sapiens (caçadores-coletores, mais numerosos nas terras ricas e poucos logo depois de chegar); de 9.000 a 5.000 a.C. o mapa passa aos poucos para a densidade estimada por país, até hoje (efeito "Terra à noite"). |
| Migrações humanas | 30 movimentos: saída da África, agricultores neolíticos, bantos, indo-europeus, tupi-guarani, vikings, colonização, tráfico de africanos escravizados, grande imigração, migrações dentro do Brasil... |
| Especial hominídeos | 15 espécies humanas dos últimos 7 milhões de anos como populações que vivem, andam e somem: bolinhas com área proporcional à população em cada região ocupada (ficam enquanto o grupo vive ali), frentes de expansão que andam pelas rotas deixando um rastro de ocupação, contornos com † onde o grupo saiu ou se extinguiu, 🛖 primeiras aldeias e 🌾 centros de agricultura, 🤝 8 encontros (como a "Denny" e a grande mistura com os neandertais) e um gráfico de população. Os sapiens seguem até hoje, com as mesmas datas de chegada da camada de população. Tem história guiada própria. |
| Povos e cidades | Neandertais, denisovanos e outros humanos arcaicos; 39 povos e civilizações; 63 cidades com data de fundação. |
| Marcos e histórias | 112 marcos e 14 passeios guiados (dinossauros no RS, mesossauro, macacos em ilhas oceânicas, ocupação humana, como o Brasil foi povoado...). |

## Debates científicos

Em 18 temas os cientistas ainda discordam (quando surgiu a vida, se a Terra congelou
inteira, a origem dos dinossauros e das flores, o fim do Cretáceo, a chegada dos humanos
às Américas e à Austrália, a população das Américas em 1492, a origem das línguas
indo-europeias...). No botão **⚖️ Debates** a pessoa escolhe qual versão o mapa segue,
lendo um texto curto sobre cada uma e suas fontes. A escolha muda de verdade o mapa:
datas dos marcos, rotas, a árvore da vida, quando cada região foi ocupada pelos sapiens,
a população das Américas e o gelo das glaciações globais. A opção "padrão" é a mais
aceita hoje. Marcos com debate mostram ⚖️.

A régua do tempo tem três escalas: **tudo** (4,6 bilhões de anos), **humanos** (7 milhões)
e **história** (de 10.000 a.C. a hoje). O site lembra, no próprio navegador, as camadas
ligadas, a escala da régua, a velocidade e os grupos de fósseis escolhidos.

## Publicar no GitHub Pages

O site é estático e já está pronto para o Pages: em **Settings → Pages**, escolha
*Deploy from a branch*, ramo `main`, pasta `/ (root)`. O arquivo `.nojekyll` faz o Pages
servir os arquivos como estão.

## Estrutura

```
index.html            página
favicon.svg, *.png    ícones
css/estilo.css        visual
js/
  escala.js           escala do tempo (ICS) e os três modos da régua
  rotacao.js          reconstrução das placas no navegador (quatérnions + slerp)
  geometria.js        peças de geografia que viajam com as placas
  clima.js            gelo, nível do mar, temperatura, vegetação
  mapa.js             desenho do mapa (canvas, projeção Equal Earth)
  populacao.js        ocupação humana (grade de 0,5°)
  hominideos.js       especial hominídeos (núcleos, frentes, rastros, aldeias, encontros, gráfico)
  perspectivas.js     debates científicos (opções que mudam o mapa)
  regua.js            régua do tempo
  vida.js             fósseis, marcos, rotas, povos, cidades, árvore da vida, painel "Agora"
  historias.js        histórias guiadas, boas-vindas e ajuda
  app.js              estado, camadas, reprodução, memória das configurações
  erros.js            mostra erros de JavaScript na tela
data/                 dados gerados pelo pipeline (não editar à mão)
pipeline/             scripts Python que geram data/
  conteudo_fonte.py   <- textos, marcos, rotas, árvore e histórias (edite aqui)
  conteudo_humanos.py <- migrações, povos, cidades, datas de chegada dos sapiens
  perspectivas.py     <- debates escritos à mão (formato documentado no arquivo)
  revisoes/*.json     <- revisões científicas: correções registradas, itens novos e debates
  revisao.py          <- lê e valida as revisões
  hominideos.py       <- especial hominídeos: espécies, núcleos, rotas, população, encontros, aldeias
```

## Revisões científicas

O conteúdo foi revisado por dois agentes revisores (Terra e vida; ocupação humana), com
pesquisa e fontes. Cada revisão fica em `pipeline/revisoes/` como JSON:

- `correcoes`: o que estava errado no conteúdo existente, com o texto proposto, o motivo e
  as fontes. As correções são aplicadas nos arquivos-fonte e o JSON guarda o registro
  (`status`: `aplicada` ou `mantida`, com nota).
- `novos_eventos`, `novos_grupos`, `novas_rotas`, `novas_migracoes`, `novos_povos`,
  `novas_cidades` e `perspectivas`: lidos diretamente pelo pipeline, com as fontes de cada
  item (as dos marcos aparecem no painel de detalhe).

Para uma nova revisão, basta pôr outro `.json` na pasta e rodar `pipeline/conteudo.py`.
O `revisao.py` valida antes de gerar o site: ids repetidos, referências inexistentes,
regiões de chegada inválidas, debates sem exatamente uma opção padrão, coordenadas e
tempos fora do intervalo, emojis de bandeira (não aparecem no Windows).

## Como regenerar os dados

Precisa de Python 3.12 (o pygplates ainda não tem versão para 3.14).

```
python -m venv .venv312            # ou: uv venv --python 3.12 .venv312
.venv312/Scripts/python -m pip install -r pipeline/requirements.txt
.venv312/Scripts/python pipeline/construir.py
```

`construir.py` roda, em ordem: `baixar` (modelo de placas, Natural Earth, D3), `geo`
(corta a geografia pelas placas), `conteudo`, `fosseis` (baixa da PBDB), `limites`,
`populacao` (ISIMIP e Our World in Data) e `rotacoes`. A última junta todas as placas
usadas pelos outros passos. Para mudar só textos, rotas ou histórias, edite os arquivos
de conteúdo e rode `conteudo.py` e `rotacoes.py`.

## Segurança

- Página 100% estática, sem servidor nem formulários. A Content-Security-Policy (no
  `index.html`) só permite arquivos do próprio site e o Cloudflare Web Analytics em
  configuração automática (script de `static.cloudflareinsights.com`, dados enviados ao
  próprio domínio em `/cdn-cgi/rum`). Scripts embutidos continuam proibidos.
- Recursos do Cloudflare que injetam script embutido (como *JavaScript Detections*) não
  são compatíveis com a CSP de um site estático: devem ficar desligados no painel.
- Textos vindos de dados externos (nomes de fósseis da PBDB) são escapados antes de
  irem para a tela; parâmetros da URL e configurações salvas são validados.
- As configurações ficam só no `localStorage` do navegador de quem usa.

## Limitações (honestas)

- Antes de 1,8 bilhão de anos ninguém sabe onde estavam os continentes: o mapa mostra
  só a crosta que já existia, esmaecida.
- O contorno das terras é o litoral de hoje levado para trás. Mares rasos antigos que
  inundavam os continentes (como o que dividia a América do Norte no Cretáceo) não
  aparecem, exceto o mar baixo das eras glaciais.
- Os biomas são uma aproximação pela latitude e pela temperatura global da época.
- As rotas de dispersão e as migrações são esquemáticas: mostram o caminho geral.
- Ocorrências de fósseis próximas no espaço e no tempo foram agrupadas para o mapa ficar leve.
- População antes de 1850: totais por país distribuídos pelo padrão de 1850. O Brasil em 1500
  foi corrigido para 3,5 milhões (a HYDE dava 18,7), mantendo o total das Américas (nas
  Américas e na Oceania, misturado com uma distribuição uniforme). Antes de 10.000 a.C.,
  só as datas de chegada; os números do Pleistoceno são muito incertos.

## Fontes e licenças

- Placas: Cao, X. et al. (2024), modelo de 1,8 bilhão de anos (Zenodo 10.5281/zenodo.11536686), via GPlates/pygplates.
- Países, estados e batimetria: [Natural Earth](https://www.naturalearthdata.com/) (domínio público).
- Fósseis: [Paleobiology Database](https://paleobiodb.org/), CC BY 4.0.
- População: ISIMIP3a, grades de 1850 a 2021 derivadas da HYDE ([files.isimip.org](https://files.isimip.org/ISIMIP3a/InputData/socioeconomic/pop/histsoc/)); [Our World in Data](https://ourworldindata.org/population-sources) / HYDE 3.3 (Klein Goldewijk et al.), CC BY 4.0.
- Escala do tempo e cores: Comissão Internacional de Estratigrafia (ICS), 2024.
- Clima e nível do mar: simplificado de Scotese et al. (2021) e Spratt & Lisiecki (2016).
- Desenho: [D3.js](https://d3js.org/) v7.9.0 (ISC).
