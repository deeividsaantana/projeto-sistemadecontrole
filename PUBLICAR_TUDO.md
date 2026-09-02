# Publicador automático RENEA

O arquivo `PUBLICAR_TUDO.cmd` concentra configuração, teste e publicação.

## Primeira execução

1. Dê dois cliques em `PUBLICAR_TUDO.cmd`.
2. Informe o e-mail que será administrador.
3. Quando solicitado, baixe a conta de serviço Firebase e arraste o arquivo
   JSON para a janela.
4. Conclua os logins oficiais do Netlify e Firebase que abrirem no navegador.

O assistente executa automaticamente:

- vínculo deste repositório com o site Netlify existente;
- envio protegido das variáveis para o Netlify;
- criação do usuário, se ainda não existir, e concessão de `staff: true`;
- instalação de dependências, TypeScript e build de produção;
- commit, `pull --rebase` seguro e push para `main`;
- publicação das regras, índices e Storage do Firebase.

Se o usuário for criado, a senha inicial aparece uma única vez na janela. Anote
essa senha antes de fechar.

## Próximas publicações

Basta executar novamente `PUBLICAR_TUDO.cmd`. A configuração local contém
somente o e-mail e o identificador do projeto; chaves privadas ficam no Netlify.

## Apenas conferir

Execute no Prompt de Comando:

```bat
PUBLICAR_TUDO.cmd --check
```

Esse modo não faz commit, push ou deploy. Ele confere os arquivos e, quando as
dependências estão disponíveis, repete o TypeScript e o build.

## Trocar de conta ou de site no Netlify

O site de produção deixou de ser fixo no código. Para publicar em outro site
Netlify, sem editar `scripts/publicar-tudo.mjs`:

1. Crie o site na conta nova. Ela precisa ser de **outro time**: o limite de
   créditos vale para o time inteiro, então um site novo dentro do mesmo time
   continua bloqueado.
2. Aponte o publicador para ele. O endereço basta — o vínculo é feito pelo nome
   do site e o identificador é descoberto sozinho:

```bat
set RENEA_NETLIFY_SITE_URL=https://<subdominio-novo>.netlify.app
PUBLICAR_TUDO.cmd
```

Com domínio próprio não há nome derivável; nesse caso informe o `Site ID`, que
fica em *Site configuration → General → Site details*:

```bat
set RENEA_NETLIFY_SITE_ID=<site-id-da-conta-nova>
set RENEA_NETLIFY_SITE_URL=https://erp.exemplo.com.br
PUBLICAR_TUDO.cmd
```

O publicador grava a escolha em `.publicar-tudo.local.json`, que fica fora do
Git. Nas próximas vezes basta rodar `PUBLICAR_TUDO.cmd`. O site padrão do
projeto é `https://reneaerp.netlify.app`.

Depois da primeira publicação no site novo, faltam dois passos manuais:

- **Firebase → Authentication → Settings → Authorized domains**: adicione o novo
  domínio. Sem isso o login para de funcionar.
- **Links públicos**: presença, apontamento e tickets passam a apontar para o
  domínio novo. Os links já distribuídos continuam válidos enquanto o site
  antigo estiver no ar; gere e redistribua os novos antes de desligá-lo.

As variáveis de ambiente do Firebase são reenviadas pelo próprio publicador a
partir do `.env` local, então não é preciso recriá-las à mão no painel.

## Segurança

- `.env`, conta de serviço, vínculo local do Netlify e marca da primeira
  configuração estão ignorados pelo Git.
- O publicador se recusa a usar uma conta de serviço guardada dentro da pasta do
  projeto.
- O remoto de produção é `deeividsaantana/projeto-sistemadecontrole`, conectado ao site Netlify `fluffy-gecko-609e90`, e a branch precisa ser `main`.
- Se houver conflito no `pull --rebase`, o processo para antes do push.
