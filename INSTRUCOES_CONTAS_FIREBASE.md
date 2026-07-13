# Contas de usuario no Firebase

O sistema agora usa contas reais do Firebase Authentication. A senha padrao
`admin / renea123` foi removida do codigo.

## Ativacao unica

1. Abra o Console do Firebase do projeto `sistemarenea`.
2. Acesse **Authentication** e clique em **Vamos comecar**.
3. Em **Sign-in method**, habilite **E-mail/senha**.
4. Publique o site novamente.

Depois disso, use **Criar conta** na tela de login. O Firebase armazena a senha
com seguranca e mantem a sessao do usuario no navegador.

## Conferencia recomendada

- Crie primeiro a conta do responsavel administrativo.
- Teste sair e entrar novamente.
- Confirme no Firebase em **Authentication > Users** se a conta foi criada.
- Remova pelo Console do Firebase qualquer conta que nao deva mais acessar.
