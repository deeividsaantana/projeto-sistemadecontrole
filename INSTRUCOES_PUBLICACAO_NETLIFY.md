# Publicação no GitHub + Netlify

## O que foi alterado

- Criada a função `netlify/functions/sync-manutencao.js`.
- Criado o hook `src/hooks/useEquipamentosExternos.ts`.
- O card **Em Manutenção** do dashboard agora usa o número externo salvo no Firestore quando existir.
- Criado `netlify.toml` com build do Vite e agendamento da função a cada 2 minutos.
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
troca futura de projeto Firebase, também pode configurar a chave pública web:

```txt
FIREBASE_WEB_API_KEY=SUA_CHAVE_PUBLICA_DO_FIREBASE
```

Para restringir a análise a administradores específicos, informe os e-mails
separados por vírgula:

```txt
AI_ALLOWED_EMAILS=admin@empresa.com.br,gestor@empresa.com.br
```

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

## Testar a função

Depois do deploy, acesse:

```txt
https://SEU-SITE.netlify.app/.netlify/functions/sync-manutencao
```

Se retornar `success: true`, a sincronização está funcionando.
