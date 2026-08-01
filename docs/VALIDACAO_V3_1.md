# Validação da versão 3.1

Data: 01/08/2026

## Validação automatizada

Comandos obrigatórios:

```bash
npm run lint
npm test
npm run build
```

Resultado esperado:

- TypeScript sem erros;
- todos os testes aprovados;
- bundle de produção gerado em `dist`;
- nenhuma chamada pública de tickets aceita sem convite;
- tokens antigos previsíveis são substituídos;
- perfil desconhecido não recebe privilégios administrativos.

## Backup e restauração

O teste automatizado serializa e restaura um conjunto com:

- cadastro mestre;
- equipamento;
- lançamento válido;
- lançamento incompleto;
- ticket pendente.

Critério: a restauração deve validar o formato e manter todas as linhas, inclusive as incompletas e pendentes.

Checklist manual antes da publicação:

1. exportar backup pelo sistema;
2. guardar uma cópia fora do navegador;
3. importar o arquivo em uma sessão de homologação;
4. conferir contagens de empresas, equipamentos, abastecimentos, tickets, materiais, presenças e estacas;
5. confirmar que alertas e duplicidades continuam visíveis;
6. confirmar que nenhum dado de junho ou julho foi incorporado pelo agente;
7. acessar o sistema com um usuário de cada perfil;
8. gerar novos links de presença, apontamento e tickets;
9. confirmar que os endereços antigos não são mais divulgados;
10. testar Excel e PDF dos módulos mais usados.

## Checklist de produção

- configurar `RENEA_PUBLIC_TICKET_LINK_TOKEN` no Netlify;
- confirmar o deploy do commit da v3.1;
- verificar a página inicial e o login;
- abrir os módulos Combustível, Jazida, Materiais, Estacas e Presença;
- verificar a última sincronização do OneDrive;
- acompanhar a primeira execução de cada função agendada;
- registrar o hash do commit publicado e o horário do teste.

## Limite da validação

O teste automatizado cobre contratos, regras puras e build. A conferência visual em navegador, o teste real das credenciais do Netlify e a restauração contra dados de produção devem ser registrados durante a publicação.
