# RENEA ERP: instruções para o Claude

Leia antes de qualquer mudança:

1. `AGENTS.md`: stack, invariantes de dados e regras de migração Firebase para Supabase.
2. `CONTRIBUTING.md`: estrutura de pastas, nomes, etapas, checklist do PR e revisão.
3. `docs/superpowers/CHECKLIST_REDESIGN_ABAS.md`: padrão visual das telas.

## Regras que não mudam

- Responda em português.
- Produção roda só na Render (`render.yaml`, `server/index.js`). A API fica em `api/` e é servida em `/api/`.
- Um assunto por PR. Rode `npm run verify` antes de entregar.
- Todo teste novo entra em `tests/run.ts`.
- Nada de arquivo solto na raiz: zip, log, print, backup, token ou `.env`.
- Toda tela nova ou alterada responde à pergunta obrigatória: uma pessoa cansada e sem facilidade com aplicativos consegue usar sem travar? O visual precisa bater com o Painel de Controle, e as abas ocultas também são conferidas. Se não bater, não entra.
- Mostre prints no celular (390 px) e no computador antes de dar uma tela por pronta.
- Em trabalho de tela, use todas as skills de design de `.claude/skills/` (lista em `CONTRIBUTING.md`, seção 7). Quando elas discordam, vale o padrão do Painel.
- Remova código morto em vez de comentar. Prove com busca de referências antes de apagar.
