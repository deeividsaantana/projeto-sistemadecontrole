# Validação — ERP v2.1

## Verificações automatizadas previstas

```bash
npm install
npm run lint
npm test
npm run build
```

Os testes da v2.1 verificam:

- lista fechada de entidades;
- permissões por perfil;
- organização derivada de claim ou configuração do servidor;
- rejeição de campos desconhecidos;
- validação de tipos e obrigatoriedade;
- preservação das linhas de importação;
- presença das tabelas, RLS, auditoria e RPC na migration;
- ausência de `DROP TABLE` e `TRUNCATE`.

## Resultado obtido nesta entrega

- 86 arquivos TypeScript/TSX/JavaScript do frontend, funções e testes inventariados.
- 72 arquivos TypeScript/TSX analisados pelo compilador TypeScript sem erro de sintaxe.
- 13 arquivos JavaScript/MJS analisados pelo parser do Node sem erro de sintaxe.
- Todas as importações relativas resolvidas.
- Três testes novos executados: contrato, gateway e schema.
- Gateway simulado com retorno `200` para administrador autenticado, `403` para arquivamento por operador e `401` sem autenticação.
- 18 tabelas encontradas e 18 ativações de RLS confirmadas.
- Chave `service_role` ausente de todo o código em `src`.
- 149 referências de `localStorage` preservadas, exatamente como na v2.0.
- 34 chaves literais de persistência preservadas.
- Nenhum arquivo da v2.0 removido.
- Alterações limitadas a 6 arquivos existentes e 12 arquivos novos.
- Nenhum marcador de conflito ou caminho absoluto local encontrado no código.

## Homologação Supabase

1. Criar um projeto de homologação.
2. Executar a migration completa.
3. Criar a organização com `bootstrap_organization`.
4. Configurar as três variáveis no Netlify.
5. provisionar um usuário de cada perfil;
6. confirmar o diagnóstico em Configurações;
7. consultar cada cadastro com dados de teste;
8. validar criação e edição por `admin`, `gestor` e `operador`;
9. confirmar que `leitura` não grava;
10. confirmar que `operador` não arquiva;
11. preservar um lote com linhas válidas, inválidas e duplicadas;
12. conferir todas as linhas em `import_rows`;
13. conferir a trilha em `audit_events`;
14. repetir a tentativa com outra organização e confirmar isolamento.

## Critérios de aceite

- O sistema abre e funciona sem variáveis Supabase.
- A chave de serviço não aparece no bundle do frontend.
- A função rejeita usuário sem `staff=true`.
- A organização não pode ser escolhida pelo corpo da requisição.
- Não há exclusão física pelo gateway.
- Importações não descartam linhas.
- O Firebase e os fluxos operacionais permanecem funcionais.

## Limite da validação local

Neste ambiente, a política do Windows bloqueou a criação de processos para `npm`, `tsc` e `vite`. Por isso, a entrega usa verificações estáticas e testes de contrato executados pelo runtime disponível, mas a execução real da migration e o build completo devem ser repetidos no ambiente de homologação.
