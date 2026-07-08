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
