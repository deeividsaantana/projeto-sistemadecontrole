# RENEA Design System — contrato evolutivo

## Fonte única

Os componentes compartilhados ficam em `src/shared/ui`. Tokens globais ficam em `src/index.css` com prefixo `--renea-`. Nenhum módulo deve criar outro botão, filtro, tabela ou modal genérico antes de verificar os componentes existentes. Variantes novas pertencem à biblioteca compartilhada quando resolvem um padrão transversal.

## Semântica atual

| Papel | Token | Uso |
| --- | --- | --- |
| Ação principal | `--renea-color-primary` | ação de destaque e foco |
| Sucesso | `--renea-color-success` | operação confirmada |
| Atenção | `--renea-color-warning` | revisão pendente |
| Crítico | `--renea-color-danger` | erro, exclusão, desvio grave |
| Informação | `--renea-color-info` | informação operacional |
| Neutro | `--renea-color-neutral` | dado secundário/ausente |

Espaçamento usa `--renea-space-1` a `--renea-space-4`, radius de controle/painel, duração de movimento e níveis de z definidos em `:root`. A tipografia vigente usa Outfit/Geist. Esta é a base; ainda falta substituir valores locais divergentes depois de inventariar onde cada um é usado. Status precisa de texto/ícone além da cor.

## Componentes em uso

- `PageHeader`: um título `h1` visível, descrição curta e ações da tela. A obra/organização ativa deve vir do shell autenticado quando o contexto estiver conectado.
- `FilterBar`: região nomeada, campos e ações. Cadastros e Materiais já usam a mesma estrutura sem alterar a semântica de filtro existente. Campos precisam de label acessível, mesmo que visualmente oculto.
- `DataTable<T>`: recebe `caption`, `rows`, `columns`, `getRowId`, `minWidth` e `pageSize`. Cada coluna define célula e, se ordenável, `sortValue`; o cabeçalho é botão com `aria-sort`. Pagina apenas conjuntos já carregados e com escopo correto. Não usar para carregar todos os registros de um tenant e depois paginar no browser quando a API puder devolver páginas.
- `TableShell`, `TableHead` e `TableBody`: primitivas de tabela para layouts ainda não migrados. `DataTable` é a composição preferida para listagens novas.
- `EmptyState`, `LoadingState`, `ErrorState`, `Modal`, `Drawer`, `ConfirmDialog`, `Button`, `Badge`, `Pagination`: existentes; revisar semântica e variantes durante a migração de cada módulo.

## Critérios para novos fluxos

Desktop e celular devem ser inspecionados com dados reais ou amostras representativas de volume; testar teclado, foco, rótulos, estados vazios/carregando/erro e permissão. Uma tela que usa componentes compartilhados mas mantém campos redundantes ou um processo confuso não está migrada. A fonte e a data de atualização dos indicadores precisam ficar claras. Interações críticas não dependem de animação.

## Critério de lançamento cansado

As 15 abas principais da sidebar devem seguir o mesmo tamanho e o mesmo modelo operacional. A pessoa deve conseguir abrir qualquer aba, reconhecer o contexto, filtrar, lançar, revisar e salvar sem reaprender a tela. A ação principal fica no `PageHeader`; filtros ficam logo abaixo; a lista ou fluxo principal ocupa o corpo; estados vazio, erro e carregamento usam componentes compartilhados.

Todo formulário de lançamento precisa ter campos grandes, ordem natural de preenchimento, data e responsável preenchidos quando o sistema já souber, validação perto do campo, botão de salvar previsível e caminho de cancelamento claro. No celular, ações podem rolar horizontalmente, mas não podem ficar escondidas atrás de painéis ou depender de texto pequeno. O teste prático é uma pessoa cansada no fim do dia conseguir registrar o dado correto sem se preocupar com navegação, tamanho, layout ou nomenclatura diferente entre módulos.

## Pendências do sistema de design

FormField/validação, controles de data/moeda/quantidade, DataTable com seleção e configuração de colunas, paginação remota, shell com contexto autenticado, alertas de erro com request ID e padrões de telas mobile de campo. Essas capacidades serão adicionadas ao contrato compartilhado antes de proliferar telas novas que dependam delas.
