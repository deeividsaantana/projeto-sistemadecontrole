# Padrão das abas do RENEA ERP

**Objetivo:** todas as abas seguem o mesmo molde, com padrão rígido de
layout, para o sistema parecer uma ferramenta de obra integrada e não um
conjunto de telas soltas. A referência visual continua sendo o Painel de
Controle.

**Critério de conclusão:** uma aba só entra quando cumpre todos os itens
abaixo e responde "sim" à pergunta obrigatória: uma pessoa cansada e sem
facilidade com aplicativos consegue usar sem travar?

Atualizado em 21/10/2026 (auditoria de front, achados C1, A1, A2, A3, M1 e B6).

---

## 1. Molde de página (obrigatório)

Toda aba usa `TelaCheia` (`src/shared/ui/TelaCheia.tsx`). Não existe botão
de "tela cheia": a aba já nasce cheia, dentro da casca. O menu lateral e a
barra do topo (52 px) continuam sempre à vista.

```
┌ barra do topo (52 px, da casca) ─────────────────────────────────────┐
│ menu │ 1. CABEÇALHO fixo: título curto · abas · ação principal (direita) │
│      │ 2. FAIXA fixa (opcional): busca, filtros, contadores, avisos      │
│      │ 3. ÁREA DE DADOS: ocupa o resto e rola por dentro                 │
│      │ 4. RODAPÉ fixo (opcional): total e paginação                      │
└──────┴───────────────────────────────────────────────────────────────────┘
```

- **Largura:** 100% da área de trabalho. Nenhuma aba tem `max-w-[...px]`,
  `max-width` em CSS ou `mx-auto` no contêiner da aba.
- **Altura (1024 px ou mais):** a aba mede a tela inteira abaixo da barra do
  topo, descontado o recuo do `#main-tab-viewport`. As medidas moram em duas
  variáveis do `index.css`: `--renea-topo` (barra do topo) e
  `--renea-respiro` (recuo, o mesmo que o `App.tsx` usa no padding). A
  página não rola; só a área de dados rola.
- **Celular e tablet (até 1023 px):** a página volta a rolar normalmente, na
  mesma ordem (cabeçalho, faixa, dados, rodapé). Tabela vira cartões com os
  mesmos campos.
- **Sem rolagem lateral** em nenhuma largura (375, 390, 768, 1024, 1366,
  1920 px). Se algo não cabe, quebra linha ou rola dentro do próprio bloco.

### Como montar

```tsx
<TelaCheia
  ref={escopo}                    // escopo do GSAP
  id="minha-aba-tab" rotulo="Minha aba"
  idAbaAtiva={idDaAba('minha', subtela)} idDados="minha-dados" chaveRolagem={subtela}
  cabecalho={<PageHeader eyebrow="Módulo" title="Título curto"
    abas={<AbasDaTela id="minha" rotulo="Subtelas de minha aba" abas={subtelas}
      ativa={subtela} onTrocar={setSubtela} idPainel="minha-dados" />}
    actions={<button className={BOTAO_PRIMARIO}>Ação principal</button>} />}
  faixa={<Filtros />}
  rodape={<Paginacao />}
>
  {/* Tabela, lista ou formulário. Um filho com h-full (ou flex-1 min-h-0)
      ocupa a área inteira e cuida da própria rolagem. */}
</TelaCheia>
```

- **Aba de dados** (tabela, lista com paginação): o filho ocupa a área toda
  (`h-full` ou `flex-1 min-h-0`), o cabeçalho da tabela fica preso no topo
  (`sticky top-0`) e só as linhas rolam. Modelos: Combustível › Lançamentos e
  Controle de Frotas › Situação do dia.
- **Aba longa** (painel de cartões, formulário): passe `longa`. A área rola
  por dentro com respiro entre os blocos, entra no Tab do teclado e ganha
  nome para o leitor de tela. Modelo: Presença.
- **Avisos** ("Salvo", "Desfazer", erro) vão na `faixa`. Um aviso vazio com
  `sr-only` não abre espaço.
- **`chaveRolagem`**: ao trocar de subtela, a área de dados volta ao topo.

## 2. Subtelas: sempre abas no topo

Um componente só: `AbasDaTela` (`src/shared/ui/AbasDaTela.tsx`), passado no
`abas` do `PageHeader`. Nada de menu lateral interno, chips de navegação ou
botões soltos fazendo papel de aba.

- Visual: faixa branca com borda; aba aberta em verde cheio (`#176b4d`) com
  texto branco; ícone opcional (some abaixo de 640 px); nome curto
  opcional para o celular (`curto`); contador como selo (`contador` +
  `contadorRotulo`, lido pelo leitor de tela).
- Acessibilidade: `role="tablist"`/`role="tab"`, `aria-selected`, só a aba
  aberta entra no Tab, setas, Home e End trocam de aba. A área de dados vira
  `role="tabpanel"` ligada à aba (`idAbaAtiva`).
- No celular a faixa rola na horizontal por conta própria e leva a aba
  aberta para a vista. No computador a faixa quebra linha em vez de rolar.
- **Muitas subtelas** (Materiais, Estacas e Cadastros, 17-18 cada): agrupe
  com `{ grupo, rotulo, abas: [...] }`. A primeira linha mostra os grupos e
  as abas soltas; a segunda linha, logo abaixo, mostra só as abas do grupo
  aberto (sublinhado verde). Tocar num grupo abre a última subtela usada
  nele. Exemplo no preview: `/?screen=molde&shell=1`.
- Meses, períodos e filtros não são abas: ficam na faixa ou no rodapé.

## 3. Cabeçalho

- `PageHeader` com `eyebrow` (módulo, em caixa alta), título curto (h1, um
  por tela), abas e ações. Sem descrição longa e sem capa: a primeira dobra
  é do dado.
- Uma ação principal (`BOTAO_PRIMARIO`, ícone + texto claro), encostada à
  direita. As outras ficam em "Mais ações" ou como botões secundários.
- Quando título, abas e ações não cabem numa linha, as ações descem para a
  linha de baixo, ainda à direita. No celular cada parte ganha a própria
  linha e as ações quebram linha (o botão principal nunca fica escondido).

## 4. Visual

- Paleta RENEA (`#176b4d`, `#f26a2e`, `#718087`, `#f7f8f6`); como cor de letra,
  `#5b6870` no lugar do cinza e `#c2410c` no lugar do laranja (4,5:1). A trava
  `tests/padraoAbas.test.ts` reprova cor hex fora dela e letra em `#718087` ou `#f26a2e`.
- Cartões `rounded-2xl border-slate-200 bg-white`, sem sombra pesada.
- Foco visível em todo controle: borda sólida verde-escura de 2 px com afastamento
  de 2 px (`--renea-focus`, global no index.css).
- Texto: piso de 12 px; 11 px só no rótulo de cabeçalho em maiúsculas.
- Toque: 44 px no celular; 40 px nos botões soltos do computador.
- Entrada com GSAP pelos helpers comuns (`RouteMotion`, `useGSAP` com
  escopo), sempre respeitando `prefers-reduced-motion`.

## 5. Organização e operação

- Ordem fixa: cabeçalho → faixa (busca/filtros/contadores) → dados →
  rodapé (total/paginação).
- Estados de carregando, vazio e erro com mensagem clara, sem jargão.
- Biblioteca pesada (Excel, PDF, gráficos) só carrega quando a ação pede
  (`import()` sob demanda).
- Dados reais: nada some sem aviso, ausência não vira zero (ver `AGENTS.md`).
- `data-testid` nos elementos críticos para o E2E.

## 6. Conferência antes de entregar

- [ ] Prints a 390 x 844, 1366 x 768 e 1920 x 1080 no preview com a casca
      (`/?screen=<aba>&shell=1`).
- [ ] A 1366 x 768 a página não rola (só a área de dados) e o primeiro dado
      aparece sem rolar.
- [ ] Nenhuma largura tem rolagem lateral.
- [ ] As abas ocultas que usam a mesma tela foram conferidas.
- [ ] `npm run verify` passou.

## Situação das abas no molde

| Aba | Molde (TelaCheia + AbasDaTela) |
| --- | --- |
| Combustível | Feito (21/10/2026) |
| Controle de Frotas | Feito (21/10/2026) |
| Presença | Feito (21/10/2026) |
| Materiais, Estacas, Cadastros | Fase 2: trocar o menu lateral interno por abas agrupadas |
| Demais abas | Fase 2, uma por vez |
