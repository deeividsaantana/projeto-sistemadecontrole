# Contas de usuario no Firebase

O sistema agora usa contas reais do Firebase Authentication. A senha padrao
`admin / renea123` foi removida do codigo.

## Ativacao unica

1. Abra o Console do Firebase do projeto `sistemarenea`.
2. Acesse **Authentication** e clique em **Vamos comecar**.
3. Em **Sign-in method**, habilite **E-mail/senha**.
4. Publique o site novamente.

Crie o primeiro administrador pelo Console do Firebase e conceda a claim
staff. Depois da publicação, administradores também podem criar, alterar
perfil, inativar e reativar usuários em Administração > Usuários.
Não existe cadastro público na tela de login.

Antes de publicar as novas regras, conceda a permissão `staff` a pelo menos uma
conta administrativa. Com `FIREBASE_SERVICE_ACCOUNT_KEY` configurada localmente:

```bash
npm run provision:staff -- usuario@empresa.com.br
```

O comando preserva outras claims, adiciona `staff: true` e revoga as sessões
anteriores. O usuário deve sair e entrar novamente.

## Conferencia recomendada

- Crie primeiro a conta do responsável administrativo e conceda a claim `staff`.
- Teste sair e entrar novamente.
- Confirme no Firebase em **Authentication > Users** se a conta foi criada.
- Remova pelo Console do Firebase qualquer conta que nao deva mais acessar.

## Ordem segura de publicação

1. Configurar a conta de serviço Firebase no terminal administrativo (variáveis
   `FIREBASE_SERVICE_ACCOUNT_KEY_BASE64`/`FIREBASE_DATABASE_URL` no Render).
2. Criar o usuário no Firebase Authentication.
3. Executar `npm run provision:staff -- EMAIL`.
4. Publicar `firestore.rules` com `firebase deploy --only firestore:rules`.
5. Dar push em `main`; o Render publica automaticamente o site e o backend.
6. Testar login, presença, apontamento e ticket em uma janela anônima.
