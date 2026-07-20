# Sistema Renea

Webapp operacional para controle de equipamentos, combustível, materiais, tickets de jazida, apontamentos e presença.

## Módulos principais

- Combustível inteligente com digitação rápida por prefixo, auditoria contínua, importação e exportação em Excel.
- Leitura assistida de PDF ou foto de abastecimento, com transcrição estruturada e conferência humana obrigatória.
- Dashboard de consumo, qualidade dos dados, sequência de bomba e desvios de KM/horímetro.
- Parte diária de equipamentos com lançamento, indicadores, filtros, edição e PDF no padrão do formulário físico.
- Consulta e migração controlada do legado SGE, preservando os dados dos bancos Access antigos.
- Tickets de liberação e recebimento vinculados, assinatura digital, histórico e impressão em duas vias.
- Links públicos operacionais para tickets, apontamentos e presença, com rascunhos isolados por aparelho.
- Sincronização segmentada com Firebase para respeitar o limite de tamanho dos documentos do Firestore.

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

O frontend e as funções estão preparados para Netlify. A leitura inteligente de documentos usa a variável secreta `GEMINI_API_KEY` somente no servidor; a chave não deve ser colocada no código do navegador.

Consulte:

- `CONFIGURAR_IA_NETLIFY.md`
- `INSTRUCOES_PUBLICACAO_NETLIFY.md`
- `INSTRUCOES_CONTAS_FIREBASE.md`
- `LEGADO_SGE_CONVERSAO.md`
- `VALIDACAO_V7.md`

## Segurança dos documentos

PDFs e fotos enviados para análise não são persistidos no banco. O sistema grava apenas os dados revisados, o nome do arquivo, a impressão digital SHA-256 e a trilha de conferência.
