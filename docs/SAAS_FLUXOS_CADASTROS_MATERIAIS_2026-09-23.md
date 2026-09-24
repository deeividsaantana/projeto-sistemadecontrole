# Fluxos de referência — Cadastros e Materiais/Estoque

Auditoria do código deste checkout em 2026-09-23. Esta ficha separa comportamento atual de destino SaaS; nenhum dado de produção foi aberto.

## Cadastros: onze subáreas na tela ativa

`CadastrosTab.tsx` ainda concentra formulários, filtros, importação e exclusão. Seu contrato de entrada recebe oito coleções (`empresas`, `obras`, `equipamentos`, `funcionarios`, `comboios`, `combustiveis`, `lubrificantes`, `etapas`) e `ordensServico`, mais callbacks de gravação/exclusão. A tela começa em Equipamentos. O `RegistryScreen` compartilhado não é renderizado aqui; sua equivalência precisa ser provada antes de substituir qualquer subárea.

| Subárea | Entidade real | Chave/vínculo que precisa sobreviver | Destino |
| --- | --- | --- | --- |
| Empresas | `Empresa` | ID e CNPJ; tipos de empresa | Cadastro de organizações/parceiros |
| Fornecedores | `Empresa` filtrada | mesmo ID e CNPJ, tipo `FORNECEDOR` | Visão do cadastro de parceiros |
| Terceiras | `Empresa` filtrada | mesmo ID e CNPJ, tipo de terceira | Visão do cadastro de parceiros |
| Locais | `ObraLocal` | ID e referências de obra/local | Obras e locais; distinguir obra SaaS de local operacional |
| Equipamentos | `Equipamento` | prefixo, placa/série, empresa, local e OS | Ativos mestres |
| Veículos | `Equipamento` filtrado | mesmo ativo, categoria Frota | Visão de frota, sem tabela duplicada |
| Colaboradores | `Funcionario` | matrícula, empresa, status e histórico | Pessoas; inativação preserva presença |
| Comboios | `Comboio` | identificador de abastecimento | Combustível > tanques/comboios |
| Combustíveis | `TipoCombustivel` | tipo/unidade usados em lançamentos | Parâmetros de combustível |
| Lubrificantes | `ProdutoLubrificacao` | produto/unidade usados em lançamentos | Parâmetros de lubrificação |
| Ramos/Trechos | `EtapaServico` | estrutura espacial/serviço atual | Obras > estrutura e frentes |

### Fluxos atuais e validação de equivalência

- Busca textual e filtros variam por subárea; equipamentos/veículos filtram status, obra, tipo e empresa; colaboradores filtram atividade, cargo e empresa; locais filtram status. A troca de subárea limpa filtros e formulário. O novo FilterBar já envolve o fluxo ativo; a futura extração deve manter essa regra observável.
- Inclusão/edição usa um formulário condicional extenso com callbacks do `App.tsx`; importação possui prévia e confirmação. A migração deve comparar campo a campo, mantendo IDs, vínculos, erros visíveis e retorno de falha de gravação.
- A seleção "Fornecedores", "Terceiras" e "Veículos" é uma visão de entidades compartilhadas. Separá-las em cadastros independentes duplicaria dados e quebraria consumidores.
- Exclusão precisa ser revista por entidade e vínculo antes de substituir por inativação; a UI atual não é prova de que remoção física seja segura.

### Dependências confirmadas no modelo atual

Os comandos de exclusão de `App.tsx` filtravam fisicamente as coleções de empresas, obras, equipamentos e colaboradores, apesar de a confirmação visual prometer inativação. O modelo guarda `empresaId` em equipamentos e colaboradores, `localAtualId` em equipamentos, `obraId` em presença e outros registros, e `equipamentoId` e `funcionarioId` em históricos operacionais. O vínculo operador/equipamento usa uma coleção própria e também grava campos espelho no equipamento. A exclusão física de um mestre referenciado pode deixar histórico órfão. Nesta fatia, empresas, equipamentos e colaboradores passaram a inativação/desmobilização mantendo o ID e a posição na coleção, com auditoria `UPDATE`. Obra/local e cadastros auxiliares ainda têm remoção física; seus botões agora descrevem a ação real. Antes de alterar cada um, é preciso completar a matriz de referências por coleção persistida e provar consulta e sincronização.

A primeira extração de comandos fica em `src/masterData/registryCommands.ts`: normalização de empresa e colaborador, e atualização imutável da coleção. Validação central, `saveAndLog`, chaves de armazenamento, notificação e sincronização permanecem no adaptador atual. Os testes de caracterização cobrem status, tipos, `criadoEm`, ordem e identidade; não substituem a futura prova de persistência e autorização no servidor.

| Mestre | Referência tipada confirmada | Tratamento nesta fatia |
| --- | --- | --- |
| Empresa/fornecedor | `Equipamento.empresaId`, `Funcionario.empresaId`, `MovimentoMaterial.fornecedorId`, `LancamentoCusto.fornecedorId` | Inativar sem trocar ID |
| Obra/local | `Equipamento.localAtualId`; `obraId` em presença, equipes, frentes, diários, serviços, produção, planejamento, FVS, inspeções, não conformidades, medições, documentos, ocorrências, custos e orçamento | Bloqueia exclusão local quando há referência carregada; sem referência mantém comando legado |
| Equipamento/veículo | `Abastecimento.equipamentoId`, `Lubrificacao.equipamentoId` e históricos operacionais | Desmobilizar sem trocar ID |
| Colaborador | `PresencaApontamento.funcionarioId`, `ApontamentoOperacional.funcionarioId` e vínculo operador/equipamento | Desmobilizar sem trocar ID; vínculo ativo ainda exige reconciliação |
| Comboio | `Abastecimento.comboioId`; sequência de bomba consulta esse ID | Bloqueia exclusão local quando há abastecimento referenciado |
| Tipo de combustível | `Abastecimento.tipoCombustivelId`, `Equipamento.combustivelId` | Bloqueia exclusão local quando há abastecimento ou equipamento referenciado |
| Produto de lubrificação | `Lubrificacao.produtoLubrificacaoId` | Bloqueia exclusão local quando há lubrificação referenciada |
| Etapa de serviço | `ApontamentoOperacional.etapaServicoId` | Bloqueia exclusão local quando há apontamento referenciado |

O bloqueio acima consulta somente o retrato carregado no cliente. Ainda não é uma garantia transacional nem de autorização entre dispositivos: a API do domínio migrado deverá repetir essa checagem no servidor com isolamento por organização e obra. Obra/local e cadastros auxiliares sem referência seguem o comando legado de exclusão física, até existir uma regra de ciclo de vida específica para cada entidade. `ObraLocal.id` operacional não deve ser automaticamente tratado como `project_id` do SaaS.

## Materiais/Estoque: contrato atual

`MateriaisTab.tsx` recebe `Material[]`, `MovimentoMaterial[]`, `Empresa[]`, identidade do responsável, `podeEditar` e três callbacks (`onSaveMaterial`, `onSaveMovimento`, `onApplyImport`). São cinco visões internas: resumo, estoque, movimentos, cadastro, importações.

| Fluxo | Dados e regra | Destino |
| --- | --- | --- |
| Cadastro mestre | `Material` tem ID string, código, descrição, categoria, unidade, fornecedor padrão, mínimo, atividade e timestamps | `materiais` com ID legado preservado/mapeado; versão e autoria |
| Movimento | ID string, data, tipo, material, quantidade, unidade, fornecedor, NF, placa, ticket, origem/destino, custo e responsável | ledger operacional com escopo de organização/obra e linhagem |
| Saldo | `utils/estoque.ts`: Entrada soma, Saída subtrai, Ajuste aplica sinal, Transferência é neutra no total; não há saldo persistido | consulta agregada/reconciliação; local precisa ser explicitado para saldo por local |
| Recebimento | quantidade recebida movimenta estoque; quantidade da nota mede divergência | recebimento com conferência, sem substituir fato recebido por NF |
| Importação | `materialImportApplication.ts`: ID estável por hash/aba/linha; só `disposition === 'new'` é aplicada; divergentes ficam em revisão | wizard de importação idempotente, lote e trilha de origem |

`App.tsx` guarda ambas as coleções, carrega cache local, sincroniza pelo gateway, passa as coleções ao painel e a outras telas. Essa lista de consumidores impede retirar o estado central antes de criar adaptadores equivalentes.

## Lacuna do piloto Supabase

A migration `202609150004_pilot_parceiros_materiais.sql` criou `materiais` com UUID, `organization_id` e RLS, mas o modelo operacional usa IDs string estáveis. O piloto não contém movimentos nem vínculo de obra no material. Inserir o legado diretamente gerando novos UUIDs quebraria referências e a idempotência. A próxima migration deve especificar uma chave legada única por organização, ledger de movimentos com IDs operacionais preservados, escopo de obra/local, autoria, versão e RLS que valide também o vínculo material/obra. A reconciliação deve comparar IDs, contagem de movimentos e saldos por material antes de ativar leitura Supabase. Não executar virada de provedor com apenas a tabela piloto.

## Próximos testes de equivalência

1. Cada subárea de Cadastros mantém todos os campos e vínculos após salvar, recarregar e sincronizar.
2. Usuário sem permissão não consegue comando no servidor mesmo que manipule URL ou UI.
3. Material importado duas vezes gera o mesmo conjunto de IDs e não duplica movimentos.
4. Saldos por material e data batem entre fonte Firebase/cache e consulta relacional; transferência permanece neutra no total.
5. Registros com obra/local incompleto ficam para revisão, sem escopo SaaS inventado.
