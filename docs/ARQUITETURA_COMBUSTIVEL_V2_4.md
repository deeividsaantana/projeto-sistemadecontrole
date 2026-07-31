# Arquitetura de Combustível — ERP v2.4

## Fonte única de verdade

O array existente `abastecimentos` continua sendo a fonte operacional das telas, backup, Firebase e `localStorage`. A v2.4 não cria uma coleção local paralela. Competência, custo, capacidade e revisão são campos opcionais do mesmo registro.

Cadastros de equipamento, comboio e tipo de combustível continuam sendo resolvidos pelos IDs mestres. O texto importado é mantido em `prefixoInformado`, observação e metadados de origem quando o vínculo ainda não existe.

## Regras convertidas das planilhas

### Junho de 2026

- `DadosCombustível` é a base detalhada;
- `Dpara` resolve descrição e empresa;
- `ResumoDiesel` consolida por frota e produto com `SUMIFS`;
- bomba final fecha com bomba inicial mais quantidade;
- `Insumos` funciona como cadastro controlado de produtos;
- o arquivo contém datas reais de maio e junho, portanto o nome mensal não define a competência.

### Julho de 2026

- `Detalhe` contém 994 lançamentos entre 21/06/2026 e 20/07/2026;
- descrição e empresa são derivadas de `Equipamentos`;
- `Resumo` consolida volume por frota e empresa;
- a planilha não contém leituras de bomba no detalhe;
- 273 linhas pertencem a junho e 721 a julho.

### Agosto de 2026

- `Detalhe` contém 383 lançamentos entre 21/04/2026 e 30/07/2026;
- não existe lançamento de agosto na base examinada;
- 39 linhas possuem prefixo não cadastrado;
- as duas primeiras linhas apresentam cadeia de bomba inválida por referência ao cabeçalho e `#VALUE!`;
- a sequência copiada entre linhas não separa corretamente todos os comboios.

## Fluxo atual transformado

1. O usuário lança manualmente, importa Excel, sincroniza OneDrive ou analisa documento.
2. Toda linha com conteúdo vira um `Abastecimento`, mesmo incompleta.
3. O cadastro mestre resolve equipamento, comboio e combustível quando possível.
4. Campos derivados calculam competência, custo e ocupação do tanque.
5. A validação adiciona alertas sem impedir gravação.
6. A fila de conferência permite editar ou marcar o registro como conferido.
7. A exportação reproduz uma base tabular compatível com Excel.
8. O Supabase recebe cópia preservada em staging; promoção canônica permanece manual.

## Continuidade de bomba

Dois conceitos são mantidos:

- **sugestão operacional:** usa o último lançamento gravado do mesmo comboio, independente da data informada;
- **auditoria histórica:** ordena por data e hora e compara somente registros do mesmo comboio.

Isso permite lançamento retroativo sem preencher zeros ou alterar registros posteriores, ao mesmo tempo em que mantém uma fila clara de divergências.

## Custo e capacidade

- `custoLitro` é entrada opcional;
- `custoTotal` é derivado de litros multiplicados pelo custo por litro;
- `capacidadeTanqueLitros` usa a referência do equipamento e fica registrada como fotografia histórica quando o abastecimento é salvo;
- `percentualTanque` informa a relação entre volume e capacidade;
- volume acima da capacidade gera aviso, nunca descarte.

## Persistência gradual

`stage_fuel_import` primeiro chama a ingestão genérica preservadora, mantendo todas as linhas em `import_rows`. Depois cria um item em `fuel_review_items` para cada linha.

`fueling_events` é a tabela canônica preparada para homologação futura. A RPC de staging não insere nela. O navegador nunca recebe a chave de serviço do Supabase; a chamada passa pelo token Firebase e pela função Netlify.
