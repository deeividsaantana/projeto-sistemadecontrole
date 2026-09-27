/**
 * Rotina do assistente de engenharia (terraplanagem), como o Deivid escreveu
 * em 27/09/2026: o checklist do dia em blocos, as pendências com prioridade e
 * o fechamento que não deixa o dia acabar sem saber onde cada frente está.
 * Esse é o modelo padrão: cada pessoa pode criar, editar e apagar blocos e
 * itens, e passa a ter o próprio ModeloRotina. Os ids dos itens ficam
 * gravados em RotinaDiaria.feitos: nunca renomeie um id, só acrescente.
 */
import type { BlocoRotina, ItemRotina, ModeloRotina, MomentoRotina, PendenciaRotina, PrioridadeRotina, RotinaDiaria, TipoPendenciaRotina } from '../../types';

const itens = (prefixo: string, textos: readonly string[]): ItemRotina[] =>
  textos.map((texto, posicao) => ({ id: `${prefixo}-${posicao + 1}`, texto }));

export const BLOCOS_CHECKLIST: readonly BlocoRotina[] = [
  {
    id: 'inicio', titulo: 'Início do dia', momento: 'manha', ajuda: 'Frentes, prioridades e o que ficou de ontem',
    itens: itens('inicio', [
      'Identificar todos os ramos e frentes que vão trabalhar hoje',
      'Confirmar os serviços previstos em cada frente',
      'Identificar as estacas e trechos que serão executados',
      'Conferir as prioridades passadas pelo engenheiro e pelo encarregado',
      'Verificar as pendências deixadas no dia anterior',
      'Conferir se existe alguma medição urgente',
      'Conferir e-mails e solicitações importantes',
      'Listar documentos, notas e informações que ainda precisam ser cobrados',
    ]),
  },
  {
    id: 'projeto', titulo: 'Projeto de cada frente', momento: 'manha', ajuda: 'Abrir o projeto antes de ir ao campo',
    itens: itens('projeto', [
      'Abrir o projeto correspondente e confirmar nome e número',
      'Confirmar o ramo e o trecho (estacas)',
      'Identificar o serviço que será executado',
      'Conferir cotas e níveis',
      'Conferir o perfil longitudinal, se houver',
      'Conferir as seções transversais, se houver',
      'Identificar cortes, aterros e taludes',
      'Identificar o tipo de material previsto',
      'Identificar o quantitativo previsto',
      'Anotar dúvidas para o engenheiro ou a topografia',
    ]),
  },
  {
    id: 'avanco', titulo: 'Avanço físico', momento: 'durante', ajuda: 'Avanço = acumulado ÷ previsto × 100 · Saldo = previsto − acumulado',
    itens: itens('avanco', [
      'Confirmar se o avanço informado corresponde ao campo',
      'Conferir se houve alteração de projeto',
      'Conferir se houve retrabalho',
      'Registrar as atividades que não avançaram',
      'Registrar o motivo de baixa produção',
      'Atualizar a medição da frente',
      'Atualizar o controle previsto x realizado',
    ]),
  },
  {
    id: 'terraplanagem', titulo: 'Terraplanagem', momento: 'durante', ajuda: 'O serviço de cada frente, da origem ao destino',
    itens: itens('terraplanagem', [
      'Identificar o serviço em execução (corte, aterro, carga, transporte, compactação...)',
      'Confirmar o local, o ramo e as estacas inicial e final',
      'Confirmar o material utilizado',
      'Confirmar a origem e o destino do material',
      'Registrar a produção do dia',
      'Conferir as condições do terreno e o acesso dos equipamentos',
      'Conferir interferências',
      'Registrar paralisações, retrabalhos e alterações',
      'Tirar fotos da execução',
      'Organizar as fotos por data, ramo e serviço',
    ]),
  },
  {
    id: 'equipamentos', titulo: 'Equipamentos', momento: 'durante', ajuda: 'Frente, horas e motivo de cada parada',
    itens: itens('equipamentos', [
      'Apontar prefixo, tipo e frente de cada equipamento',
      'Registrar início, parada e horas trabalhadas',
      'Registrar horas improdutivas',
      'Registrar equipamentos parados e o motivo (manutenção, operador, diesel, serviço, chuva)',
      'Conferir: todos os equipamentos foram apontados',
      'Conferir: nenhum equipamento duplicado ou sem frente',
      'Conferir: nenhuma hora incompatível',
      'Conferir: todo equipamento parado tem justificativa',
      'Conferir: a produção da frente combina com os equipamentos',
    ]),
  },
  {
    id: 'diesel', titulo: 'Combustível e diesel', momento: 'durante', ajuda: 'Abastecimentos, consumo e divergências',
    itens: itens('diesel', [
      'Conferir os abastecimentos realizados',
      'Conferir equipamento, quantidade, data e horário',
      'Conferir o operador ou responsável',
      'Atualizar a planilha de diesel',
      'Conferir o consumo por equipamento',
      'Identificar consumo muito acima do normal',
      'Verificar possíveis divergências',
      'Atualizar o relatório de combustível',
      'Conferir o total do dia e o acumulado',
    ]),
  },
  {
    id: 'materiais', titulo: 'Materiais e estoque', momento: 'durante', ajuda: 'Estoque atual = anterior + entradas − saídas',
    itens: itens('materiais', [
      'Conferir cada material recebido: data, quantidade, unidade e fornecedor',
      'Conferir o número da nota, a frente de destino, o ramo e o recebedor',
      'Conferir se o material e a quantidade estão corretos',
      'Registrar divergência, se houver',
      'Conferir o saldo: anterior, recebido, utilizado e atual',
      'Conferir o estoque físico com o sistema',
      'Identificar material acabando, em excesso ou parado',
      'Informar a necessidade de reposição',
    ]),
  },
  {
    id: 'notas', titulo: 'Notas e documentos', momento: 'durante', ajuda: 'Receber, conferir, relacionar e cobrar',
    itens: itens('notas', [
      'Receber as notas',
      'Conferir fornecedor, material ou serviço, quantidade, data e número',
      'Relacionar a nota com a frente',
      'Registrar na planilha ou no sistema',
      'Salvar o arquivo na pasta correta',
      'Enviar ao responsável, quando necessário',
      'Cobrar notas e documentos faltantes',
      'Registrar quem foi contatado e o retorno recebido',
    ]),
  },
  {
    id: 'medicao', titulo: 'Medição', momento: 'durante', ajuda: 'Do serviço executado até a aprovação',
    itens: itens('medicao', [
      'Conferir os serviços executados e a unidade de medição',
      'Conferir o quantitativo com o projeto',
      'Conferir o levantamento da topografia, quando houver',
      'Conferir o período, o acumulado anterior, a medição atual e o total',
      'Conferir o saldo contratual ou projetado',
      'Atualizar a planilha',
      'Separar a memória de cálculo e as fotos',
      'Enviar a medição e anotar a data de envio',
      'Acompanhar a aprovação e responder questionamentos',
    ]),
  },
  {
    id: 'rdo', titulo: 'RDO de terraplanagem', momento: 'durante', ajuda: 'O que precisa estar no diário de obra',
    itens: itens('rdo', [
      'Data e condição climática',
      'Frentes e ramos trabalhados',
      'Serviços e quantidades executadas',
      'Equipamentos utilizados e efetivo',
      'Materiais recebidos e utilizados',
      'Ocorrências, paralisações e interferências',
      'Manutenções, falta de material e problemas de acesso',
      'Visitas e fiscalização',
      'Observações técnicas e fotos',
      'Conferir o RDO antes de finalizar',
    ]),
  },
  {
    id: 'emails', titulo: 'E-mails e cobranças', momento: 'durante', ajuda: 'Manhã, durante o dia e antes de sair',
    itens: itens('emails', [
      'Ler as mensagens importantes e separar as urgentes',
      'Responder o que depende de mim',
      'Encaminhar o que depende de outra pessoa',
      'Solicitar informações faltantes e cobrar documentos e notas',
      'Enviar medições e relatórios',
      'Registrar por escrito as informações importantes',
      'Antes de sair: ver a caixa de novo e marcar o que fica para amanhã',
    ]),
  },
  {
    id: 'sistemas', titulo: 'Sistema, planilhas e SGE', momento: 'durante', ajuda: 'Apontamentos conferidos e nada faltando',
    itens: itens('sistemas', [
      'Atualizar o painel e a presença',
      'Conferir os apontamentos dos encarregados e dos apontadores',
      'Validar materiais recebidos e estoque',
      'Validar frentes e equipamentos',
      'Corrigir registros incorretos e procurar registros faltantes',
      'Fazer backup ou exportação, quando necessário',
      'Anotar melhorias para o sistema',
    ]),
  },
  {
    id: 'campo', titulo: 'Visita de campo', momento: 'durante', ajuda: 'Nunca ir ao campo sem saber o que confirmar',
    itens: itens('campo', [
      'Antes: saber a frente, o ramo, o trecho e o serviço que deveria acontecer',
      'Antes: saber o projeto do local e quanto deveria estar executado',
      'No campo: confirmar serviço, equipamentos, material e avanço',
      'No campo: conferir as condições da frente e tirar fotos',
      'No campo: anotar divergências e falar com o encarregado ou apontador',
      'Na volta: atualizar anotações, planilha e sistema',
      'Na volta: registrar pendências e avisar o problema crítico ao responsável',
    ]),
  },
  {
    id: 'aprendizado', titulo: 'Aprendizado do projeto', momento: 'durante', ajuda: 'Um trecho estudado por dia',
    itens: itens('aprendizado', [
      'Localizei o trecho na planta e sei qual ramo é',
      'Sei identificar as estacas e o eixo',
      'Entendi as cotas, o perfil e as seções',
      'Identifiquei corte e aterro',
      'Sei o material, o serviço e a unidade de medição',
      'Sei o quantitativo previsto',
      'Consegui relacionar o projeto com o que vi no campo',
    ]),
  },
  {
    id: 'fechamento', titulo: 'Fechamento do dia', momento: 'fechamento', ajuda: 'Obrigatório antes de ir embora',
    itens: itens('fechamento', [
      'Sei o que foi executado hoje, quanto e onde',
      'Sei quanto temos acumulado, o avanço em % e quanto falta',
      'Sei o que chegou de material, quanto e onde foi usado',
      'Sei quanto temos em estoque',
      'Todos os equipamentos foram apontados',
      'Sei quais equipamentos ficaram parados e por quê',
      'RDO atualizado',
      'Medições atualizadas',
      'Combustível atualizado',
      'Notas e materiais atualizados',
      'E-mails importantes respondidos',
      'Pendências anotadas',
    ]),
  },
];

export const MOMENTOS: ReadonlyArray<{ id: MomentoRotina; nome: string; ajuda: string }> = [
  { id: 'manha', nome: 'Começo do dia', ajuda: 'Antes de ir ao campo' },
  { id: 'durante', nome: 'Durante o dia', ajuda: 'Campo, escritório e sistema' },
  { id: 'fechamento', nome: 'Fim do dia', ajuda: 'Antes de ir embora' },
];

export const PRIORIDADES: ReadonlyArray<{ id: PrioridadeRotina; nome: string; ajuda: string; marca: string }> = [
  { id: 'critico', nome: 'Crítico', ajuda: 'Resolver agora', marca: '🔴' },
  { id: 'importante', nome: 'Importante', ajuda: 'Resolver hoje', marca: '🟠' },
  { id: 'acompanhar', nome: 'Acompanhar', ajuda: 'Depende de acompanhamento', marca: '🟡' },
  { id: 'rotina', nome: 'Rotina', ajuda: 'Atividade normal', marca: '🟢' },
];

export const TIPOS_PENDENCIA: ReadonlyArray<{ id: TipoPendenciaRotina; nome: string }> = [
  { id: 'cobrar', nome: 'Cobrar alguém' },
  { id: 'campo', nome: 'Verificar no campo' },
  { id: 'projeto', nome: 'Conferir no projeto' },
  { id: 'planilha', nome: 'Atualizar planilha' },
  { id: 'sistema', nome: 'Lançar no sistema' },
  { id: 'rdo', nome: 'Entra no RDO' },
  { id: 'medicao', nome: 'Entra na medição' },
  { id: 'email', nome: 'Mandar e-mail' },
  { id: 'outro', nome: 'Outro' },
];

const ORDEM_PRIORIDADE: Record<PrioridadeRotina, number> = { critico: 0, importante: 1, acompanhar: 2, rotina: 3 };

export const idDaRotina = (dia: string, responsavel: string) => `${dia}:${responsavel.trim()}`;

export const rotinaVazia = (dia: string, responsavel: string, agora = new Date().toISOString()): RotinaDiaria => ({
  id: idDaRotina(dia, responsavel), dia, responsavel: responsavel.trim(), feitos: [], levantar: '', duvida: '', aprendi: '', amanha: ['', '', ''], criadoEm: agora, atualizadoEm: agora,
});

/** Os blocos da pessoa: o dela, se já montou, ou uma cópia do padrão. */
export const blocosDaPessoa = (modelos: readonly ModeloRotina[], responsavel: string): BlocoRotina[] => {
  const modelo = modelos.find(item => item.id === responsavel.trim());
  return modelo ? modelo.blocos : copiarPadrao();
};

export const copiarPadrao = (): BlocoRotina[] => BLOCOS_CHECKLIST.map(bloco => ({ ...bloco, itens: bloco.itens.map(item => ({ ...item })) }));

export const temModeloProprio = (modelos: readonly ModeloRotina[], responsavel: string) => modelos.some(item => item.id === responsavel.trim());

/** Quanto do checklist está feito, no total e por bloco. Ids que não existem mais não contam. */
export const progresso = (rotina: Pick<RotinaDiaria, 'feitos'> | null | undefined, blocos: readonly BlocoRotina[] = BLOCOS_CHECKLIST) => {
  const feitos = new Set(rotina?.feitos || []);
  const porBloco: Record<string, { feitos: number; total: number }> = Object.fromEntries(blocos.map(bloco => [bloco.id, {
    feitos: bloco.itens.filter(item => feitos.has(item.id)).length,
    total: bloco.itens.length,
  }]));
  const todos = blocos.flatMap(bloco => bloco.itens);
  const total = todos.filter(item => feitos.has(item.id)).length;
  return { feitos: total, total: todos.length, percentual: todos.length ? Math.round((total / todos.length) * 100) : 0, porBloco };
};

/** O dia só fecha quando todos os itens dos blocos de fim do dia foram marcados. */
export const diaFechado = (rotina: Pick<RotinaDiaria, 'feitos'> | null | undefined, blocos: readonly BlocoRotina[] = BLOCOS_CHECKLIST) => {
  const itensDoFim = blocos.filter(bloco => bloco.momento === 'fechamento').flatMap(bloco => bloco.itens);
  const feitos = new Set(rotina?.feitos || []);
  return itensDoFim.length > 0 && itensDoFim.every(item => feitos.has(item.id));
};

export const alternarItem = (rotina: RotinaDiaria, itemId: string, agora = new Date().toISOString()): RotinaDiaria => ({
  ...rotina,
  feitos: rotina.feitos.includes(itemId) ? rotina.feitos.filter(id => id !== itemId) : [...rotina.feitos, itemId],
  atualizadoEm: agora,
});

/** Marca ou desmarca o bloco inteiro de uma vez. */
export const alternarBloco = (rotina: RotinaDiaria, bloco: BlocoRotina, agora = new Date().toISOString()): RotinaDiaria => {
  const ids = bloco.itens.map(item => item.id);
  const todos = ids.every(id => rotina.feitos.includes(id));
  const feitos = todos ? rotina.feitos.filter(id => !ids.includes(id)) : [...new Set([...rotina.feitos, ...ids])];
  return { ...rotina, feitos, atualizadoEm: agora };
};

/**
 * Pendências abertas até o dia, da mais grave para a mais leve; dentro da
 * mesma prioridade, a de prazo vencido e a mais antiga primeiro. As de dias
 * seguintes não aparecem no passado.
 */
export const pendenciasAbertas = (pendencias: readonly PendenciaRotina[], dia: string, responsavel: string) =>
  pendencias
    .filter(item => item.responsavel === responsavel.trim() && !item.excluidaEm && item.dia <= dia && (!item.concluidaEm || item.concluidaEm.slice(0, 10) > dia))
    .sort((a, b) => ORDEM_PRIORIDADE[a.prioridade] - ORDEM_PRIORIDADE[b.prioridade]
      || Number(Boolean(b.prazo && b.prazo < dia)) - Number(Boolean(a.prazo && a.prazo < dia))
      || (a.prazo || '9999').localeCompare(b.prazo || '9999')
      || a.dia.localeCompare(b.dia)
      || a.criadoEm.localeCompare(b.criadoEm));

/** Concluídas naquele dia, para o fechamento mostrar o que foi resolvido. */
export const concluidasNoDia = (pendencias: readonly PendenciaRotina[], dia: string, responsavel: string) =>
  pendencias.filter(item => item.responsavel === responsavel.trim() && !item.excluidaEm && item.concluidaEm?.slice(0, 10) === dia);

export const contarPorPrioridade = (abertas: readonly PendenciaRotina[]) => {
  const contagem: Record<PrioridadeRotina, number> = { critico: 0, importante: 0, acompanhar: 0, rotina: 0 };
  abertas.forEach(item => { contagem[item.prioridade] += 1; });
  return contagem;
};

/** As prioridades de amanhã que a pessoa escreveu ontem, para abrir o dia. */
export const prioridadesDeOntem = (rotinas: readonly RotinaDiaria[], dia: string, responsavel: string) => {
  const anteriores = rotinas
    .filter(item => item.responsavel === responsavel.trim() && item.dia < dia && item.amanha.some(texto => texto.trim()))
    .sort((a, b) => b.dia.localeCompare(a.dia));
  const ultima = anteriores[0];
  return ultima ? { dia: ultima.dia, itens: ultima.amanha.map(texto => texto.trim()).filter(Boolean) } : null;
};

/* Edição do checklist pela própria pessoa. Tudo devolve uma lista nova. */

const novoId = (prefixo: string) => `${prefixo}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const novoBloco = (titulo: string, momento: MomentoRotina): BlocoRotina => ({ id: novoId('bloco'), titulo: titulo.trim(), momento, ajuda: '', itens: [] });

export const novoItem = (texto: string): ItemRotina => ({ id: novoId('item'), texto: texto.trim() });

export const trocarBloco = (blocos: readonly BlocoRotina[], bloco: BlocoRotina) => blocos.map(item => (item.id === bloco.id ? bloco : item));

export const tirarBloco = (blocos: readonly BlocoRotina[], blocoId: string) => blocos.filter(item => item.id !== blocoId);

/** Sobe (-1) ou desce (+1) um bloco dentro da lista. */
export const moverBloco = (blocos: readonly BlocoRotina[], blocoId: string, direcao: -1 | 1) => {
  const lista = [...blocos];
  const posicao = lista.findIndex(item => item.id === blocoId);
  const destino = posicao + direcao;
  if (posicao < 0 || destino < 0 || destino >= lista.length) return lista;
  [lista[posicao], lista[destino]] = [lista[destino], lista[posicao]];
  return lista;
};

export const moverItem = (bloco: BlocoRotina, itemId: string, direcao: -1 | 1): BlocoRotina => {
  const lista = [...bloco.itens];
  const posicao = lista.findIndex(item => item.id === itemId);
  const destino = posicao + direcao;
  if (posicao < 0 || destino < 0 || destino >= lista.length) return bloco;
  [lista[posicao], lista[destino]] = [lista[destino], lista[posicao]];
  return { ...bloco, itens: lista };
};
