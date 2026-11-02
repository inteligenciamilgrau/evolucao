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
  hominideos: {id da espécie: {pop, de, ate, texto}}   (ver hominideos.py)
  eventos_extra / rotas_extra: itens que só existem nessa opção
Para anos do calendário use "ano" (eventos) ou "de_ano"/"ate_ano" (rotas).
"""

PERSPECTIVAS = [
    dict(id="gargalo_900ka", titulo="Nossos ancestrais quase sumiram há 900 mil anos?",
         resumo="Um estudo de DNA de 2023 propôs um gargalo extremo na linhagem que levou ao Homo sapiens. Outros pesquisadores dizem que o método pode criar esse sinal sozinho.",
         opcoes=[
             dict(id="sim", nome="Sim: um gargalo de ~117 mil anos", padrao=True,
                  texto="Analisando genomas de 3.154 pessoas atuais, Hu e colegas (2023) estimaram que, entre ~930 e 813 mil anos atrás, a população ancestral caiu para ~1.300 adultos reprodutores, talvez por causa do clima. Isso explicaria a falta de fósseis humanos africanos dessa época.",
                  fontes=["Hu, W. et al. (2023) Science 381: 979–984"], alteracoes={}),
             dict(id="nao", nome="Não: o sinal é um artefato",
                  texto="Críticos mostraram que o mesmo sinal aparece em dados simulados sem gargalo e que outros métodos de DNA não o detectam. A população ancestral teria variado, mas sem quase desaparecer.",
                  fontes=["Deng, Y. et al. (2024) Molecular Biology and Evolution, msae211", "Ragsdale, A. et al. (2023) Nature 617: 755–763"],
                  alteracoes={"hominideos": {"heidelbergensis": {"pop": [[0.95, 40000], [0.8, 40000], [0.6, 60000], [0.4, 60000], [0.3, 40000], [0.2, 10000]]}}}),
         ]),
]
