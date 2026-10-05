# Uso diário de materiais por ramo

## Situação atual

`MovimentoMaterial` já registra entradas e saídas, mas `destino` e `servico` são texto livre. Não existe vínculo estruturado com `EtapaServico` nem distinção entre saída operacional e consumo efetivo. O link público de presença é o único acesso dos apontadores e usa token de grupo, API leve, limite de requisições e fila idempotente. O módulo administrativo de Materiais é acessível a perfis de operação e gestão autenticados.

## Regra da entrega

- Um recebimento pode ser vinculado explicitamente a um ramo/trecho existente. Movimento antigo sem vínculo continua visível como não classificado; nome semelhante não é associação automática.
- Cada uso diário registra material, quantidade na unidade cadastrada, data, ramo/trecho, responsável, grupo/origem e observação opcional. Uso é fato imutável de lançamento; correção futura exige estorno ou ajuste auditado.
- O painel calcula, por material e ramo, `recebido = soma de entradas vinculadas`, `utilizado = soma de saídas de consumo vinculadas`, `% = utilizado / recebido × 100`. Sem recebimento vinculado, o percentual é desconhecido (`—`), não zero. Mostrar utilizado acima do recebido como divergência, sem truncar a percentagem.
- O saldo global continua vindo de `efeitoNoSaldo`; o indicador de utilização não substitui saldo de estoque, nem deduz que toda saída antiga foi consumo em um ramo.
- O vínculo com obra/tenant e a autorização de comandos seguem o contexto real da fonte; não inferir organização ou obra pela URL, descrição ou primeiro item da lista.
- Apontadores usam apenas link público: o formulário de campo deve carregar catálogo mínimo e gravar por API autenticada pelo token de grupo, com validação do grupo, limite e idempotência. Não colocar SDK ou segredo no browser público.
- Decisão do usuário: cada envio de campo fica pendente de conferência. A aprovação interna gera uma saída de consumo com vínculo ao envio; antes disso não reduz saldo nem aumenta o percentual. Rejeição preserva o envio e o motivo no histórico.

## UI e padrão visual

Adicionar uma visão `Utilização` dentro de Materiais, com tabela compartilhada, resumo por ramo e ação de apontamento. O acesso de campo deve reutilizar o shell leve do link público. Usar os tokens e componentes do Design System; a direção editorial de `$gpt-taste` melhora hierarquia e movimento de leitura dos resumos, sem prender tabelas nem alongar formulários de campo.

## Aceite

1. Exemplo de 60 tubos recebidos e 50 utilizados no mesmo ramo resulta em 83,3% e 10 unidades ainda não utilizadas naquele recebimento vinculado.
2. Outro ramo ou outro material não altera esse percentual; datas diárias e autoria continuam consultáveis.
3. Recebimento sem ramo não vira dado do ramo automaticamente; ausência de entrada retorna `—`.
4. Campo só envia para o grupo autorizado pelo token; repetição com mesma chave não cria duplicidade, acesso sem token não grava, e registro nunca cruza organização/obra.
5. Desktop e celular exibem valores, unidade, divergência e ações com rótulos claros; testes do domínio, API, UI e `npm run verify` passam.

## Implantação e rollback

Primeira fatia usa os movimentos existentes com campos opcionais, sem migração destrutiva. Firebase continua fonte operacional. A futura normalização PostgreSQL requer `organization_id`, `project_id`, autoria, versão, RLS, reconciliação dos IDs legados e teste de saldo antes da virada. Rollback da interface mantém os movimentos compatíveis com o leitor antigo; nenhum dado histórico será removido.
