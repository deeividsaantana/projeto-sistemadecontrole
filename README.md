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

O frontend e as funções estão preparados para Netlify. A leitura de documentos de combustível funciona localmente e exige revisão humana antes da gravação.

Consulte:

- `INSTRUCOES_PUBLICACAO_NETLIFY.md`
- `INSTRUCOES_CONTAS_FIREBASE.md`
- `LEGADO_SGE_CONVERSAO.md`
- `VALIDACAO_V7.md`

## Segurança dos documentos

PDFs e fotos enviados para análise não são persistidos no banco. O sistema grava apenas os dados revisados, o nome do arquivo, a impressão digital SHA-256 e a trilha de conferência.


## Sistema RENEA ERP v3.4

A base oficial está sendo evoluída por versões, sem reescrita e sem remoção de funcionalidades.

Documentação:

- docs/AUDITORIA_TECNICA_V2_0.md
- docs/AUDITORIA_PLANILHAS_OPERACIONAIS.md
- docs/PLANO_TECNICO_ERP.md
- docs/ALTERACOES_V2_0.md
- docs/VALIDACAO_V2_0.md
- docs/ARQUITETURA_DADOS_V2_1.md
- docs/ALTERACOES_V2_1.md
- docs/VALIDACAO_V2_1.md
- docs/ARQUITETURA_CADASTROS_V2_2.md
- docs/ALTERACOES_V2_2.md
- docs/VALIDACAO_V2_2.md
- docs/ARQUITETURA_EQUIPAMENTOS_V2_3.md
- docs/ALTERACOES_V2_3.md
- docs/VALIDACAO_V2_3.md
- docs/ARQUITETURA_COMBUSTIVEL_V2_4.md
- docs/ALTERACOES_V2_4.md
- docs/VALIDACAO_V2_4.md
- docs/ARQUITETURA_VIAGENS_V2_5.md
- docs/ALTERACOES_V2_5.md
- docs/VALIDACAO_V2_5.md
- docs/ALTERACOES_V2_6.md
- docs/ALTERACOES_V2_7.md
- docs/ALTERACOES_V2_8.md
- docs/ALTERACOES_V2_9.md
- docs/ALTERACOES_V3_0.md
- docs/ARQUITETURA_ERP_V3_0.md
- docs/MATRIZ_PLANILHAS_PARA_MODULOS_V3_0.md
- docs/VALIDACAO_V3_0.md
- docs/AUDITORIA_GERAL_POS_V3_0_E_ROADMAP.md
- docs/ALTERACOES_V3_1.md
- docs/VALIDACAO_V3_1.md
- docs/ALTERACOES_V3_2.md
- docs/VALIDACAO_V3_2.md
- docs/ALTERACOES_V3_3.md
- docs/VALIDACAO_V3_3.md
