# Publicação no GitHub + Netlify
# Publicação do Sistema RENEA no Netlify

## Forma automática recomendada

Execute `PUBLICAR_TUDO.cmd` na raiz do projeto. Na primeira vez, o assistente
solicita somente os logins, o e-mail administrativo e o arquivo JSON da conta de
serviço. Ele vincula o Netlify, envia as variáveis, autoriza o usuário, testa,
sincroniza o Git e publica as regras. Consulte `PUBLICAR_TUDO.md`.

As instruções manuais abaixo ficam como alternativa e referência de recuperação.

## O que foi alterado

- Criada a função `netlify/functions/sync-manutencao.js`.
- Criado o hook `src/hooks/useEquipamentosExternos.ts`.
- O card **Em Manutenção** do dashboard agora usa o número externo salvo no Firestore quando existir.
- Criado `netlify.toml` com build do Vite, sincronização a cada 10 minutos e
  limpeza diária segura de blocos de backup que não estão mais em uso.
- Mantidas as correções da exportação de planilhas com visual técnico/operacional.

## Importante sobre segurança

Não coloque chave privada do Firebase dentro do código.
Configure a chave no Netlify em:

Site settings → Environment variables → Add a variable

Nome da variável:

```txt
FIREBASE_SERVICE_ACCOUNT_KEY
```

Valor:

Cole o JSON inteiro da conta de serviço em uma única linha.

Também pode configurar:

```txt
FIREBASE_DATABASE_URL=https://sistemarenea-default-rtdb.firebaseio.com
MANUTENCAO_SOURCE_URL=https://dynamic-manatee-66561d.netlify.app/
FIREBASE_DEFAULT_ORGANIZATION_ID=renea
```

## Ativar leitura de PDF e foto de combustível

A Central de Combustível possui a função protegida
`netlify/functions/analisar-combustivel-documento.js`. Ela envia o PDF ou a foto
para análise somente quando um administrador clicar em **Analisar documento**.
O arquivo original não é salvo no Firestore; ficam apenas o nome, o hash, a
transcrição revisada e os registros aprovados.

No mesmo menu de variáveis do Netlify, adicione:

```txt
GEMINI_API_KEY=SUA_CHAVE_DA_API_GOOGLE_AI
```

Opcionalmente, fixe o modelo usado:

```txt
GEMINI_DOCUMENT_MODEL=gemini-2.5-flash
```

A função valida o token do usuário logado antes de usar a IA. Para facilitar a
troca futura de projeto Firebase, configure também as variáveis públicas do Vite usadas pelo navegador:

```txt
VITE_FIREBASE_API_KEY=SUA_CHAVE_PUBLICA_DO_FIREBASE
VITE_FIREBASE_AUTH_DOMAIN=sistemarenea.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://sistemarenea-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=sistemarenea
VITE_FIREBASE_STORAGE_BUCKET=sistemarenea.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=259137561260
VITE_FIREBASE_APP_ID=1:259137561260:web:835cac33a4a8ba6afaf509
VITE_FIREBASE_MEASUREMENT_ID=G-JJXRKV2FB7
```

`FIREBASE_WEB_API_KEY` ainda pode existir em scripts legados de publicação, mas o front-end Vite só lê variáveis iniciadas por `VITE_`.

Para liberar a análise somente a administradores específicos, informe os e-mails
separados por vírgula:

```txt
AI_ALLOWED_EMAILS=admin@empresa.com.br,gestor@empresa.com.br
```

`AI_ALLOWED_EMAILS` passou a ser obrigatório. Sem essa lista a função recusa a
análise para evitar uso indevido da cota da IA.

## Links públicos seguros

Presença, apontamentos e tickets agora usam funções Netlify intermediárias. Os
links não leem mais o backup administrativo do Firestore. As funções exigem a
mesma `FIREBASE_SERVICE_ACCOUNT_KEY` e aplicam validação, limite de requisições
e projeção mínima dos dados.

Após a primeira publicação, entre em **Controle de presença > Grupos** e use
**Gerar** no cartão de link único. O endereço antigo `/presenca-link/geral` foi
intencionalmente invalidado: o novo link contém uma chave aleatória que pode ser
trocada pela administração caso seja compartilhada com a pessoa errada.

Depois de criar ou alterar essas variáveis, execute um novo deploy no Netlify.
A chave nunca deve ser escrita no código, no GitHub ou em uma tela pública.

## Publicar

Na pasta do projeto:

```bash
npm install
npm run build
git add .
git commit -m "feat: sincronizacao manutencao externa e planilhas tecnicas"
git push
```

O Netlify deve publicar automaticamente após o push.

## Regras Firebase obrigatórias

Antes do primeiro uso de anexos, usuários ou importações protegidas, publique
as regras e a configuração de índices com:

firebase deploy --only firestore:rules,firestore:indexes,storage

O arquivo storage.rules aceita somente imagens, PDF, CSV e planilhas até
10 MB no caminho obras/<obra>/<modulo>/<registro>/arquivo. Links públicos não
possuem leitura direta no Storage.

## Conferência antes de liberar a equipe

1. Execute npm run verify.
2. Publique em uma cópia de homologação da Netlify.
3. Entre como administrador e crie um usuário de teste em Usuários.
4. Valide recuperação de senha, inativação, auditoria, upload de anexo e uma
   importação com linhas inválidas.
5. Exporte um backup antes de publicar para a operação.

## Testar a sincronização de manutenção

Funções agendadas não aceitam acesso direto por URL em produção. Use **Run
now** na página da função no painel Netlify ou `netlify functions:invoke` no
ambiente local. A rotina executa a cada dez minutos e mantém o último valor
válido quando a estrutura da fonte externa não puder ser reconhecida.

```txt
netlify functions:invoke sync-manutencao
```

Se retornar `success: true`, a sincronização está funcionando.
