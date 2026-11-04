# Plano de integração sem quebrar o build

## 1. Dependência do Phaser

Decisão proposta: `phaser@4.2.1`, fixado sem `^` para evitar atualização implícita.

O projeto publica um site estático e não tem bundler. A estratégia indicada é instalar a dependência npm, copiar o arquivo distribuível minificado para `public/vendor/` durante os scripts de desenvolvimento/build e carregar esse arquivo localmente no HTML. Assim o jogo não depende de uma CDN externa em tempo de execução.

Exemplo de dependência proposta para `package.json`:

```json
{
  "dependencies": {
    "phaser": "4.2.1"
  }
}
```

A IA integradora deve confirmar o caminho exato do arquivo de distribuição na versão instalada antes de criar o script de cópia.

## 2. Ajustar o publicador

Atualmente `scripts/prepare_dist.js` compara todas as tags `<script src>` com a lista `RUNTIME_SCRIPTS`, e rejeita qualquer script não listado. A integração deve:

1. Gerar/copiar o Phaser para `public/vendor/phaser-4.2.1.min.js` antes de preparar a pasta `dist/`.
2. Permitir explicitamente scripts locais sob `public/vendor/`, validando que o arquivo exista.
3. Continuar rejeitando URLs externas não autorizadas e caminhos fora das pastas permitidas.
4. Confirmar que o processo copia o diretório `public/` para `dist/public/`.
5. Testar `npm run build` e o build de publicação usado pelo Netlify.

Não basta adicionar a tag no HTML: o verificador atual falhará até ser atualizado.

## 3. Compatibilidade do renderizador

- Substituir `new Phaser.Geom.Point(x, y)` por `new Phaser.Math.Vector2(x, y)` ou outra forma explicitamente suportada pelo método `fillPoints` no Phaser 4.
- Rever o teste de existência de `Phaser.Geom` e os objetos geométricos efetivamente usados.
- Confirmar que a criação do jogo, `Phaser.Scale.FIT`, `CENTER_BOTH`, Graphics, Container, tweens, câmera, input e interação funcionam na versão 4.2.1.
- Executar a cena no navegador; `node --check` sozinho não valida compatibilidade de runtime.

## 4. Carregamento dos módulos

A ordem sugerida no HTML é:

1. `public/vendor/phaser-4.2.1.min.js`
2. `src/ui/world_layout.js`
3. `src/ui/world_infrastructure_catalog.js`
4. `src/ui/world_terrain.js`
5. `src/ui/world_roads.js`
6. `src/ui/world_nature.js`
7. `src/ui/world_structures.js`
8. `src/ui/world_effects.js`
9. `src/ui/world_atmosphere.js`
10. `src/ui/world_placement.js`
11. `src/ui/world_scene_modules.js`
12. `src/ui/world_renderer_phaser.js`
13. `src/ui/dashboard.js` (mantendo a ordem de dependências já existente e acordando o ponto de inicialização)

A ordem final precisa ser reconciliada com os scripts de Core e Dashboard no `index.html`; não duplicar scripts nem carregar duas engines.

## 5. Um só ciclo de vida

A IA integradora deve definir:

- Quando o painel do mapa fica visível, montar o renderer no `#worldCanvas`.
- Passar `getSnapshot` somente de leitura, usando a API real confirmada no Runtime.
- Conectar o compositor `VilarejoWorldSceneModules` à cena do renderer uma única vez.
- Atualizar a visão após eventos/fechamentos ou chamadas reais de refresh, sem criar um segundo relógio.
- Destruir a instância quando necessário e evitar montagens duplicadas.
- Tratar ausência de snapshot, container não visível e redimensionamento.

Não inventar campos de snapshot. Conferir o contrato real do Core antes de mapear população, calendário ou estado da partida.

## 6. Etapas visuais

1. Phaser 4.2.1 renderizando a cena existente sem assets novos.
2. Um tile de solo, uma casa, uma árvore e um veículo de Kenney.
3. Confirmar escala, alinhamento isométrico, sorting/depth e desempenho.
4. Só então migrar grupos de prédios/vegetação.
5. Manter os desenhos vetoriais como fallback para estruturas únicas.

## 7. Critérios de aceite

- `npm test` passa.
- `npm run build` passa e inclui os módulos visuais e o vendor de Phaser no artefato estático.
- A página abre sem erro de script no console.
- `#worldCanvas` recebe exatamente uma instância do Phaser.
- Zoom, arraste, seleção e reset da câmera funcionam.
- Nenhum módulo visual altera Core, Economia, Sociedade, caixa ou população.
- Não existe asset sem fonte/licença registrada.
- Teste em tela estreita e desktop.
