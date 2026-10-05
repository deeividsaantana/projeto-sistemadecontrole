# Validação da v2.0

Data: 31/07/2026

## Validações estáticas executadas

- inventário dos 113 arquivos originais;
- inspeção das 12 planilhas por OOXML;
- conferência de todas as abas, tabelas, fórmulas e validações estruturais;
- verificação de resolução dos imports relativos;
- comparação das chaves localStorage antes e depois da refatoração;
- comparação dos IDs de navegação e permissões;
- verificação dos padrões de rotas públicas;
- comparação de hashes para confirmar que arquivos operacionais não relacionados permaneceram intactos;
- inspeção dos arquivos novos e dos pontos de integração.

## Limitação do ambiente

O ZIP não contém node_modules.

O Windows bloqueia PowerShell com:

CreateProcessAsUserW failed: 1260

O runtime persistente bloqueia subprocessos com:

spawn EPERM

Por isso, nesta máquina não foi possível executar:

- npm install;
- npm run lint;
- npm run test;
- npm run build;
- navegador automatizado.

## Validação obrigatória em CI ou outra máquina

### Instalação

npm install

### Tipagem

npm run lint

Resultado esperado: zero erros TypeScript.

### Testes

npm run test

Resultado esperado: todos os testes antigos e os novos testes de navegação e rotas aprovados.

### Build

npm run build

Resultado esperado: bundle Vite concluído sem erro.

## Checklist funcional

### Autenticação

- login válido;
- login inválido;
- logout;
- claim admin;
- claim gestor;
- claim operador;
- claim leitura;
- claim antiga ou ausente.

### Navegação

- dashboard;
- relatórios;
- parte diária;
- combustível;
- tickets;
- materiais;
- manutenção;
- presença;
- controle de presença;
- apontamentos;
- cadastros;
- configurações;
- busca de módulo;
- menu mobile.

### Links públicos

- /presenca-link/<token>;
- ?presenca=<token>;
- /apontamento-link/<token>;
- ?apontamento=<token>;
- /ticket-link;
- ?tickets=1.

### Dados

- hidratação local;
- restauração do espelho;
- salvamento automático;
- backup local;
- importação de backup;
- reset;
- upload Firebase;
- download Firebase;
- sincronização automática;
- submissões públicas;
- tickets públicos;
- OneDrive combustível.

### Exportações

- Excel de cadastros;
- Excel de combustível;
- Excel de materiais;
- Excel de tickets;
- PDF de parte diária;
- PDF de presença;
- PDF de relatórios;
- impressão de tickets.

### UX

- desktop;
- celular;
- fallback de carregamento;
- boundary de erro em ambiente de teste;
- ausência de tela branca;
- console sem erro novo.

## Critério de conclusão

A v2.0 somente deve ser publicada depois de lint, testes, build e checklist manual aprovados em ambiente sem a política restritiva.



## Resultados estáticos obtidos nesta entrega

- 113 arquivos do ZIP original comparados por hash.
- Nenhum arquivo original ausente.
- Somente README.md, src/App.tsx, src/main.tsx e tests/run.ts foram alterados entre os arquivos originais.
- 14 arquivos novos adicionados.
- 130 referências de leitura, escrita ou remoção de storage permaneceram idênticas antes e depois da extração.
- 87 arquivos de código tiveram imports relativos verificados; nenhum import relativo ficou sem destino.
- Os 12 IDs de navegação permaneceram na mesma ordem e sem duplicidade.
- As permissões de admin, gestor, operador e leitura permaneceram equivalentes.
- Sete cenários de rota pública foram executados com sucesso em módulo ESM temporário.
- Todos os arquivos JSON foram parseados sem erro.
- Arquivos alterados não possuem marcadores de conflito.
- Delimitadores de chaves, parênteses e colchetes ficaram balanceados nos arquivos de código alterados.

