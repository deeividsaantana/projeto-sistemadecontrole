# Contexto do Claude para este projeto

Exportado das memórias do Claude a pedido do Deivid, em 03/11/2026. Serve para
qualquer sessão do Claude entender quem mantém o projeto e como ele gosta de
trabalhar. Este arquivo é público: não colocar aqui senhas, tokens ou dados
financeiros.

## Quem mantém

- Nome: Deivid Santana, mora em Suzano (SP).
- Estuda Análise e Desenvolvimento de Sistemas na UMC (fev 2026 a jun 2028).
- Auxiliar Técnico N1/N2 na Renea Infraestrutura S.A. desde jun 2026, empresa de construção e infraestrutura.
- Constrói as ferramentas operacionais web da RENEA, no projeto Complexo Alto do Tietê.
- Antes: Auxiliar Técnico de Informática na Rede Lojas Imagem (dez 2025 a mai 2026) e Aprendiz de TI na Innovapack Embalagens (jun 2024 a out 2025).
- Certificações: Google IT Support Professional (Coursera), Cyber Security (FIAP), Gestão de Infraestrutura de TI (FIAP) e Cloud Fundamentals (FIAP, expirada em ago 2025).

## Como responder

- Português do Brasil, tom casual.
- Explicar em passos bem simples, como se fosse para uma criança de 10 anos.

## Ferramentas e jeito de trabalhar

- Usa GitHub Desktop, VS Code, Postman, Cisco Packet Tracer, Oracle VirtualBox com Ubuntu, DBeaver e Notion.
- Não usa o terminal: precisa de fluxos de Git por interface gráfica (GitHub Desktop).
- Está aprendendo a publicar código no GitHub para deploy automático.
- Organiza a área de trabalho em zonas: ferramentas da faculdade, jogos e documentos.

## Sistema RENEA (histórico do projeto)

Ecossistema de aplicações web para a RENEA Infraestrutura, no Complexo Alto do Tietê. Passou por várias pilhas: apps React/TypeScript/Vite/Firebase, dashboards em HTML de arquivo único e planilhas Excel operacionais.

### Sistema React/TypeScript/Vite/Firebase

- Módulos: frota de equipamentos, combustível e lubrificação, RDOs (relatórios diários), ordens de serviço de manutenção e presença de funcionários.
- Tailwind CSS v4 e Firebase Firestore. Versão antiga publicada na Netlify (reneadadoscombustivell.netlify.app); hoje a produção roda na Render.
- Correções feitas: mudança de API do jspdf-autotable v5, ExcelJS no lugar de um xlsx falso em MHTML, erros de campo `undefined` no Firestore resolvidos com o utilitário `stripUndefinedDeep`.
- A aba que juntava manutenção e presença foi separada em duas abas.

### Identidade visual RENEA

- Verde-marinho escuro #063B2E, detalhes em âmbar #F5A623, fontes Barlow Condensed e Inter, logos oficiais em SVG e PNG (versões clara e escura).
- Menu lateral azul-marinho escuro com detalhes âmbar.
- A SPMAR é empresa parceira e o logo aparece nos relatórios.
- A identidade foi aplicada no sistema React por troca sistemática de classes Tailwind.

### Outras entregas

- Dashboard de controle de materiais: HTML único com Chart.js e cerca de 8.900 registros de uma planilha Excel embutidos como JSON.
- Dashboard operacional em `index.html` de arquivo único, com Firebase, IndexedDB e interface animada.
- Planilha Excel "SISTEMA OPERACIONAL RENEA" feita com openpyxl: várias abas, só verde, barra de navegação com links, cores por status e uma aba filtrada ESPERANDO_MOTORISTA.
- Primeira versão do sistema de combustível: Firebase Auth com bloqueio, regras de segurança do Firestore, gestão de usuários, formulário de abastecimento com cálculo de bomba (Bomba Final = Bomba Inicial + Litros), importação de 1.142 registros históricos, especificação técnica e `prompt-claude-code.md`.
- Controle de presença de obra com login anônimo para trabalhadores, painel do administrador em tempo real, exportação em PDF e Excel e correção manual de horário.
- App de presença para uma equipe de 67 pessoas no Complexo Alto do Tietê, em HTML/CSS/JS, com troca de status, grupos por categoria e relatórios para impressão.
- Combustível em React/Vite com autocompletar (frota, descrição, família), detecção de duplicados, exportação CSV com BOM igual à planilha original e plano de integração com Supabase.

### Redesign "estilo TOTVS" (em andamento)

- Quer o visual de todas as telas no estilo das referências que enviou: painel limpo, cartões brancos, fundo cinza claro, KPIs com ícone circular, listas com linha do tempo ou barra de progresso e detalhes em verde-escuro.
- Para esse trabalho enviou o zip do repositório `projeto-sistemadecontrole-main`.
- O padrão visual vigente está em `docs/superpowers/CHECKLIST_REDESIGN_ABAS.md`.

## Faculdade (ADS, UMC)

- Python básico: laços `for` e `while`, contadores, `range` com passo, fluxogramas em XML do draw.io.
- Exercícios progressivos e um trabalho de contador de classificação de suspeitos.
- Prefere código mínimo, sem `import random` e sem `break`.
- Trabalho de Linux contra Windows usando Ubuntu no VirtualBox.
- Mini banco em linha de comando (`mini_banco.py`) com dados salvos em JSON.
- Trabalho de desenvolvimento web (HTML e CSS) com header, footer, nav, menu, efeitos e Google Maps.
- Trabalho de banco de dados: modelagem MER/DER em notação Peter Chen Expandida no draw.io, tema sistema de gestão de biblioteca (o tema de locação de carros esportivos foi descartado).

## Configuração do Claude

- As skills de design e de fluxo do projeto ficam em `.claude/skills/` e `.agents/skills/` (lista em `CONTRIBUTING.md`, seção 7).
- Regras do repositório: `CLAUDE.md`, `AGENTS.md` e `CONTRIBUTING.md`.
- Plugin Superpowers disponível no catálogo do Claude; as skills equivalentes (brainstorming, TDD, debug sistemático, planos, code review) já estão no projeto.
- Skills do caveman (`JuliusBrussee/caveman`) foram instaladas apenas na sessão em nuvem, sem entrar no projeto.
