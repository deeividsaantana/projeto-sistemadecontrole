import type { ChecklistEquipamento, ItemChecklist, ModeloChecklist, OrdemServico } from '../types';

/** Modelo padrão de saída. A operação edita os itens sem precisar de deploy. */
export const MODELO_CHECKLIST_PADRAO: ModeloChecklist = {
  id: 'modelo-padrao',
  nome: 'Checklist de saída',
  itens: [
    { id: 'freios', descricao: 'Freios', critico: true },
    { id: 'pneus', descricao: 'Pneus e rodas', critico: true },
    { id: 'direcao', descricao: 'Direção', critico: true },
    { id: 'luzes', descricao: 'Luzes e sinalização', critico: true },
    { id: 'vazamentos', descricao: 'Vazamentos (óleo, água, hidráulico)', critico: true },
    { id: 'nivel-oleo', descricao: 'Nível de óleo', critico: false },
    { id: 'agua', descricao: 'Nível de água', critico: false },
    { id: 'extintor', descricao: 'Extintor', critico: false },
    { id: 'cinto', descricao: 'Cinto de segurança', critico: true },
    { id: 'espelhos', descricao: 'Espelhos', critico: false },
    { id: 'limpeza', descricao: 'Limpeza da cabine', critico: false },
    { id: 'documentos', descricao: 'Documentação a bordo', critico: false },
  ],
  atualizadoEm: '',
};

export const itensReprovados = (itens: ItemChecklist[]) => itens.filter(item => item.resposta === 'Não conforme');

export const itensCriticosReprovados = (itens: ItemChecklist[]) => itensReprovados(itens).filter(item => item.critico);

/**
 * Item crítico reprovado tira o equipamento de operação, então o checklist abre
 * a ordem de serviço na hora — sem depender de alguém lembrar de abrir depois.
 */
export const ordemDoChecklist = (
  checklist: ChecklistEquipamento,
  numero: string,
): OrdemServico | undefined => {
  const criticos = itensCriticosReprovados(checklist.itens);
  if (criticos.length === 0) return undefined;
  return {
    id: `os-checklist-${checklist.id}`,
    numero,
    equipamentoId: checklist.equipamentoId,
    tipo: 'Corretiva',
    prioridade: 'Alta',
    status: 'Aberta',
    dataAbertura: checklist.data,
    horaAbertura: checklist.hora,
    responsavel: checklist.responsavel,
    motivo: 'Checklist reprovado',
    descricao: `Itens críticos não conformes no checklist de ${checklist.prefixo}: ${criticos.map(item => item.descricao).join(', ')}.`,
    observacao: criticos.map(item => item.observacao).filter(Boolean).join(' · '),
  };
};

/** Resumo usado na lista e no cabeçalho do checklist. */
export const resumoChecklist = (itens: ItemChecklist[]) => ({
  total: itens.length,
  ok: itens.filter(item => item.resposta === 'OK').length,
  atencao: itens.filter(item => item.resposta === 'Atenção').length,
  naoConforme: itensReprovados(itens).length,
  criticos: itensCriticosReprovados(itens).length,
});
