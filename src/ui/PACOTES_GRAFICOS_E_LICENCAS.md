# Pacotes gráficos recomendados

## Começar por estes quatro pacotes Kenney

Os pacotes abaixo são da mesma família de tiles isométricos e aparecem com licença **Creative Commons CC0** nas páginas oficiais. Isso permite uso comercial e não exige atribuição, embora manter a origem no inventário do projeto seja uma boa prática.

| Pacote | Utilidade no Vilarejo | Link |
|---|---|---|
| Isometric Tiles City | Centro urbano, ruas e elementos de cidade | https://kenney.nl/assets/isometric-tiles-city |
| Isometric Tiles Buildings | Casas e edifícios genéricos | https://kenney.nl/assets/isometric-tiles-buildings |
| Isometric Tiles Landscape | Terreno, vegetação e paisagem | https://kenney.nl/assets/isometric-tiles-landscape |
| Isometric Tiles Vehicles | Carros e veículos para dar movimento à cidade | https://kenney.nl/assets/isometric-tiles-vehicles |

### Cuidados antes de adotar

- Os pacotes City, Buildings, Landscape e Vehicles são antigos (lançamentos originais em 2014). A licença continua indicada como CC0, mas a idade e o estilo visual justificam um protótipo antes da adoção integral.
- Baixar os quatro pacotes e fazer uma triagem. Não jogar todos os sprites diretamente no mapa.
- Comparar escala, ângulo, contorno, paleta e tamanho das bases. Escolher apenas os assets que combinem.
- Criar uma pasta de recursos com subpastas por pacote e um `ASSET_SOURCES.md` registrando nome, URL, licença e data de obtenção.
- Montar um atlas para reduzir chamadas de textura, ou carregar imagens separadas inicialmente para validar o visual. O formato de atlas deve ser compatível com o loader do Phaser.
- Manter desenhos vetoriais como fallback para construções muito específicas que o pacote não oferece: hidrelétrica, nuclear, mina, campo petrolífero, refinaria e aeroporto.

## Pacotes que eu não priorizaria

- **Kenney City Kit (Roads):** está identificado como conteúdo 3D. Não é um substituto direto para os tiles 2D isométricos atuais.
- **Kenney Tiny City:** arte 2D de 16×16, com estética pixelada muito menor. Pode ser um projeto visual alternativo, mas misturá-la com os tiles maiores tende a quebrar a identidade visual.

## Como trocar a arte sem jogar fora o trabalho existente

- Preservar a grade e as coordenadas de `world_layout.js`.
- Preservar os pontos/rotas de `world_roads.js`, mesmo que a aparência da pista passe a usar tiles.
- Trocar aos poucos as rotinas de desenho em `world_structures.js` por imagens/sprites vinculados aos mesmos IDs do catálogo.
- Trocar a vegetação de `world_nature.js` por sprites apenas depois de validar escala e ordenação de profundidade.
- Não transformar assets em fatos econômicos. A imagem de uma usina não significa que ela esteja produzindo energia.

## Licenças

CC0 significa que o criador renuncia, na medida permitida pela lei, a direitos autorais e conexos sobre o material. Guardar uma cópia do arquivo de licença presente no pacote e registrar a fonte é recomendado para rastreabilidade. Não usar logotipo Kenney como se fosse selo oficial do jogo.
