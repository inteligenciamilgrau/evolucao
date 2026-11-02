"""Debates científicos: temas com mais de uma posição séria.

Cada perspectiva tem opções; a pessoa escolhe uma no site ("Debates") e o mapa muda.
A opção com padrao=True corresponde ao conteúdo base (conteudo_fonte.py e conteudo_humanos.py).

alteracoes (aplicadas por cima do conteúdo base):
  eventos: {id: {t, titulo, texto, locais}}          locais = [(lon, lat, "nome"), ...]
  grupos: {id: {origem, fim, texto}}
  rotas: {id: {de, ate, texto, ramos}}
  povos: {nome: {de, ate, texto}}
  chegada: {regiao: Ma}         desloca as datas de chegada dos sapiens na região
  populacao: {americas_1500: pessoas, brasil_1500: pessoas}   (em 1500; o resto das Américas completa)
  clima: {bola_de_neve_lat: graus}   latitude mínima do gelo nas glaciações globais
  eventos_extra / rotas_extra: itens que só existem nessa opção
Para anos do calendário use "ano" (eventos) ou "de_ano"/"ate_ano" (rotas).
"""

PERSPECTIVAS = []
