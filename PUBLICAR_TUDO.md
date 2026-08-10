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

## Segurança

- `.env`, conta de serviço, vínculo local do Netlify e marca da primeira
  configuração estão ignorados pelo Git.
- O publicador se recusa a usar uma conta de serviço guardada dentro da pasta do
  projeto.
- O remoto de produção é `deeividsaantana/projeto-sistemadecontrole`, conectado ao site Netlify `fluffy-gecko-609e90`, e a branch precisa ser `main`.
- Se houver conflito no `pull --rebase`, o processo para antes do push.
