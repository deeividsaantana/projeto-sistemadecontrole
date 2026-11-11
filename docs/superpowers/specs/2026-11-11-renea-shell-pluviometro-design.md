# RENEA: shell, navegação e Pluviômetro

## Objetivo

Modernizar o shell operacional do RENEA sem alterar dados persistidos,
permissões ou links públicos, retirar `Meu dia` e `Diário de Obra` da
navegação principal e transformar o Pluviômetro em módulo próprio.

## Decisões

- `pluviometro` será um módulo primário, com acesso por perfil equivalente ao
  fluxo operacional de lançamento.
- `lancamentos` continuará sendo Combustível; “Lançamentos” do Pluviômetro
  será uma subtela interna.
- Os registros continuarão em `DiarioObra`. A nova tela apenas reutilizará os
  mesmos tipos, handlers e gateway de persistência.
- Links antigos para `meu-dia` e `diario-obra` terão redirecionamentos
  compatíveis, sem remoção de registros.
- Relatórios continuará como módulo próprio.

## Alterações de interface

- Sidebar desktop e menu mobile terão superfície branca, grupos abertos,
  item ativo verde-claro com faixa verde à esquerda e modo recolhido por
  ícones.
- O cartão “Ambiente RENEA” terá hierarquia visual maior; o logo Cintravyse
  não terá fundo verde. O rodapé manterá “Cintravyse v3.5.1”.
- Login perderá o texto de acesso restrito solicitado.
- Dashboard manterá indicadores e filtros de período, removendo título
  duplicado e filtro de obra.
- Topbar exibirá o nome real priorizando `displayName` e metadados; o estado
  da nuvem será uma bolinha com `title` e nome acessível, sem texto visível.

## Pluviômetro

`PluviometroTab` seguirá `TelaCheia`, `PageHeader` e `AbasDaTela`, com:

1. **Resumo mensal**: filtro mês/ano, calendário, totais, dias com chuva,
   dias impraticáveis, horas paradas e dias sem registro.
2. **Lançamentos**: consulta filtrada e formulário para lançar/editar o
   registro diário, usando o mesmo `onSave` do Diário de Obra.

A exportação mensal existente será mantida por importação sob demanda. O
Diário de Obra poderá continuar acessível por redirecionamento legado ou por
fluxo interno, mas não aparecerá no menu principal.

## Compatibilidade e segurança

- `PRIMARY_MODULE_IDS`, `ROLE_ACCESS`, destinos antigos e renderização do
  `App` serão atualizados juntos.
- Nenhum acesso novo será concedido ao perfil `leitura` além do necessário
  para consulta.
- Ausência de registro continuará distinta de zero milímetro.
- Dados inativados continuarão fora dos totais sem serem apagados.

## Validação

- Atualizar testes de navegação, sidebar, molde de abas e Pluviômetro.
- Executar `npm run verify`.
- Conferir preview em desktop, sidebar recolhida, menu mobile e 390 px.
- Preparar PR somente após verificação verde; merge e deploy somente após os
  checks do GitHub aprovados.
