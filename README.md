# Sistema Renea

Webapp operacional para controle de equipamentos, combustível, materiais, tickets de jazida, apontamentos e presença.

## Módulos principais

- Combustível inteligente com digitação rápida por prefixo, auditoria contínua, importação e exportação em Excel.
- Dashboard de consumo, qualidade dos dados, sequência de bomba e desvios de KM/horímetro.
- Parte diária de equipamentos com lançamento, indicadores, filtros, edição e PDF no padrão do formulário físico.
- Consulta e migração controlada do legado SGE, preservando os dados dos bancos Access antigos.
- Tickets de liberação e recebimento vinculados, assinatura digital, histórico e impressão em duas vias.
- Links públicos operacionais para tickets, apontamentos e presença, com rascunhos isolados por aparelho.
- Sincronização segmentada com Firebase para respeitar o limite de tamanho dos documentos do Firestore.
- Migração incremental para Supabase por gateway, com Firebase padrão, dual-write de homologação e RLS por organização.

## Executar localmente

Requisitos: Node.js 20 ou superior.

```bash
npm install
npm run dev
```

Para validar a versão de produção:

```bash
npm run build
```

## Publicação

O deploy de produção roda no Render (`server/index.js` serve o build do frontend e a API de `api/` em `/api/...`, adaptada para Express).

Consulte `docs/INSTRUCOES_CONTAS_FIREBASE.md` e `docs/ARQUITETURA_MIGRACAO_SUPABASE.md`.

## Estrutura do repositório

- `src/`: aplicação React (telas em `src/components`, regras puras em `src/utils`).
- `src/next/`: novo frontend em construção, servido por `next.html`.
- `preview/`: harness de telas sem login, usado pelos testes E2E.
- `server/`: servidor Express do Render.
- `api/`: handlers HTTP da API (links públicos, presença, cadastros), servidos em `/api/`.
- `functions/`: Cloud Functions do Firebase.
- `supabase/migrations/`: migrations versionadas do PostgreSQL.
- `tests/`: contratos operacionais (`npm test`) e E2E (`npm run e2e`).
- `scripts/`: utilitários de manutenção e testes.

## Documentação

- `docs/ARQUITETURA_SISTEMA_INTEGRADO_V3_5.md`: arquitetura atual.
- `docs/ARQUITETURA_MIGRACAO_SUPABASE.md`: migração gradual para Supabase.
- `docs/SAAS_DESIGN_SYSTEM.md` e `docs/superpowers/`: padrão visual das telas.
- `docs/SEGURANCA_FIRESTORE.md`: invariantes de segurança do Firestore.
- `docs/LEGADO_SGE_CONVERSAO.md` e `docs/ANALISE_BANCOS_ACCESS_SGE.md`: legado SGE.
- `docs/historico/`: notas de alteração e validação de cada versão (V2.0 a V3.5 e V7).
