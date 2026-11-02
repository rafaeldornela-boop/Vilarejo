# Vilarejo | Arquitetura Modular 0.2

**Release:** `3.2.0-alpha.1`  
**Base:** Economia 3.0 + Núcleo Central 0.1 (`economia-estavel`)  
**Fábrica de módulos:** `0.2.1`

O Vilarejo é um simulador econômico didático em evolução para uma arquitetura integrada. Esta versão cria a primeira fronteira executável para que Economia, Sociedade, Política e Legislação possam evoluir separadamente, sem se tornarem quatro jogos desconectados.

## O que esta versão entrega

- Economia 3.0 e o Núcleo Central 0.1 preservados.
- Fábrica de módulos com validação de identificador, versão, dependências, estado privado e ciclo de vida.
- Comunicação por eventos com namespace obrigatório do módulo emissor.
- Contexto controlado: módulos não recebem a referência bruta ao runtime.
- Porta pública somente de leitura da Economia.
- Testes específicos da arquitetura e integração com a aplicação.
- Verificação automática no GitHub Actions.

## Executar

Requisito: Node.js 18 ou superior. Não há dependências npm externas.

```bash
npm start
```

Acesse `http://localhost:3000`. Também é possível abrir `index.html` diretamente no navegador para testar a interface, embora o servidor seja o caminho recomendado.

## Verificar e testar

```bash
npm run build
npm test
```

Resultado validado nesta entrega:

- Build: aprovado.
- Suíte econômica, Núcleo Central e integração: 99 verificações aprovadas.
- Contratos modulares: 15 verificações aprovadas.
- **Total: 114 verificações aprovadas, 0 reprovadas.**
- Simulação econômica de 240 meses e robustez com 24 sementes (5.760 meses-simulação) mantidas na suíte principal.

## Estrutura principal

```text
.
├── .github/workflows/ci.yml
├── docs/
│   ├── ARQUITETURA_MODULAR_V0.1.md
│   ├── ARQUITETURA_MODULAR_V0.2.md
│   ├── CONTRATO_DE_MODULOS_V1.md
│   ├── CONTRATO_DE_MODULOS_V2.md
│   ├── PLANO_DE_EXTRACAO_DA_ECONOMIA.md
│   ├── RELEASE_ARQUITETURA_MODULAR_0.2.1.md
│   └── historico/
├── public/modules/
│   ├── module_factory.js
│   └── economia/index.js
├── tests/modular_architecture.test.js
├── eventos_v3.js
├── index.html
├── script.js
├── server.js
├── test_runner.js
└── vilarejo_core.js
```

## Como os módulos se comunicam

- **Núcleo Central:** calendário, sessão, diretório populacional e barramento de eventos.
- **Economia:** contas, firmas, produção, salários, preços, crédito, dívidas, tributos e contas nacionais.
- **Sociedade:** futuramente será dona de seus indicadores e políticas sociais.
- **Política:** futuramente será dona de partidos, eleições, mandatos e decisões políticas.
- **Legislação:** futuramente será dona das normas, vigência, hierarquia e regras jurídicas.

A fábrica está disponível como `window.VilarejoModuleKit`. A porta pública da Economia está disponível como `window.VilarejoEconomiaPort`. O runtime atual permanece em `window.VilarejoRuntime` para compatibilidade com o motor legado; **módulos novos não devem receber nem acessar essa referência diretamente**. Devem usar o contexto restrito criado pela fábrica.

## Exemplo mínimo de módulo

```js
const sociedade = VilarejoModuleKit.createModule({
  id: "sociedade",
  version: "0.1.0",
  name: "Sociedade",
  dependencies: ["core", "economia"]
}, {
  initialState: { indicadores: {} },
  start(context) {
    return context.events.on("economy:month-closed", (event) => {
      context.setState({
        ultimoFechamento: event.payload.monthNumber,
        indicadores: context.getState().indicadores
      });
    });
  }
});

sociedade.start(window.VilarejoRuntime);
```

O exemplo ilustra o contrato; Sociedade ainda não é carregada nem iniciada nesta release.

## Limitações assumidas

- `script.js` continua monolítico. Nenhuma regra econômica foi movida nesta etapa.
- A porta da Economia é somente de leitura. Ainda não há API de comandos econômicos transacionais.
- O diretório populacional continua refletindo os domicílios do motor econômico, não um cadastro individual de cidadãos.
- Sociedade, Política e Legislação ainda não foram implementadas.
- Salvamento e restauração completos da partida ainda não fazem parte desta versão.

Leia `docs/ARQUITETURA_MODULAR_V0.2.md`, `docs/CONTRATO_DE_MODULOS_V2.md` e `docs/PLANO_DE_EXTRACAO_DA_ECONOMIA.md` antes de criar o próximo módulo.
