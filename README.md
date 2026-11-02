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
| Fósseis | ~370 mil ocorrências reais da Paleobiology Database, de 28 grupos, na posição em que estavam quando o ser vivia. |
| Rotas de dispersão | Como cada grupo chegou aonde vive: por terra, em jangadas de vegetação, voando ou levado por humanos. |
| População humana | Antes de 10 mil a.C., as regiões já ocupadas pelos sapiens; depois, a densidade estimada até hoje (efeito "Terra à noite"). |
| Migrações humanas | 23 movimentos: saída da África, agricultores neolíticos, bantos, indo-europeus, tupi-guarani, vikings, colonização, tráfico de africanos escravizados, grande imigração, migrações dentro do Brasil... |
| Povos e cidades | Neandertais, denisovanos e outros humanos arcaicos; povos e civilizações; 53 cidades com data de fundação. |
| Marcos e histórias | 85 marcos e 13 passeios guiados (dinossauros no RS, mesossauro, macacos em ilhas oceânicas, ocupação humana, como o Brasil foi povoado...). |

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
  regua.js            régua do tempo
  vida.js             fósseis, marcos, rotas, povos, cidades, árvore da vida, painel "Agora"
  historias.js        histórias guiadas, boas-vindas e ajuda
  app.js              estado, camadas, reprodução, memória das configurações
  erros.js            mostra erros de JavaScript na tela
data/                 dados gerados pelo pipeline (não editar à mão)
pipeline/             scripts Python que geram data/
  conteudo_fonte.py   <- textos, marcos, rotas, árvore e histórias (edite aqui)
  conteudo_humanos.py <- migrações, povos, cidades, datas de chegada dos sapiens
```

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

- Página 100% estática, sem servidor, formulários nem chamadas de rede: tudo vem de
  arquivos do próprio site (há uma Content-Security-Policy que só permite isso).
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
- População antes de 1850: totais por país distribuídos pelo padrão de 1850 (nas
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
