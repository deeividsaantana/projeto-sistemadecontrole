/**
 * O que o sistema já sabe sobre o dia, para o Meu dia: materiais que chegaram
 * e saíram, avisos de estoque, envios dos apontadores, equipamentos parados e
 * diesel. Só lê o que as outras telas gravaram; nada é guardado aqui.
 */
import type { Abastecimento, ControleEquipamentoDiario, Equipamento, Material, MovimentoMaterial, StatusControleEquipamentoDiario } from '../../types';
import { posicaoEstoque } from '../../utils/estoque';
import { avisosDeMateriais, type AvisoMaterial } from '../materials/avisosMateriais';
import { enviosDoCampo, semEnvioNoDia, type EnvioCampo } from '../materials/apontadores';

const arredondar = (valor: number) => Number(valor.toFixed(3));

/** Status em que o equipamento não trabalhou e precisa de motivo. */
export const STATUS_PARADO: readonly StatusControleEquipamentoDiario[] = ['Em manutenção', 'Aguardando manutenção', 'Aguardando motorista', 'Aguardando equipamento', 'A confirmar'];

export interface LinhaMaterialDia {
  material: string;
  unidade: string;
  quantidade: number;
  movimentos: number;
}

export interface EquipamentoParado {
  prefixo: string;
  status: StatusControleEquipamentoDiario;
  motivo: string;
}

export interface ResumoDoDia {
  materiais: {
    entradas: LinhaMaterialDia[];
    saidas: LinhaMaterialDia[];
    /** Só os avisos críticos e de atenção. */
    avisos: AvisoMaterial[];
  };
  apontadores: { envios: EnvioCampo[]; faltando: string[] };
  equipamentos: {
    apontados: number;
    emOperacao: number;
    parados: EquipamentoParado[];
    /** Parados sem motivo escrito: o checklist pede justificativa. */
    semMotivo: number;
    /** Mesmo equipamento apontado mais de uma vez no dia. */
    repetidos: string[];
  };
  diesel: {
    litros: number;
    abastecimentos: number;
    /** Os que mais abasteceram no dia, do maior para o menor. */
    porEquipamento: Array<{ prefixo: string; litros: number }>;
    /** Lançamentos do dia que ainda pedem conferência. */
    aConferir: number;
  };
}

const somarPorMaterial = (movimentos: readonly MovimentoMaterial[]): LinhaMaterialDia[] => {
  const mapa = new Map<string, LinhaMaterialDia>();
  for (const item of movimentos) {
    const chave = `${item.materialId || item.materialDescricao}|${item.unidade}`;
    const linha = mapa.get(chave) ?? { material: item.materialDescricao.trim() || 'Sem material', unidade: item.unidade.trim(), quantidade: 0, movimentos: 0 };
    linha.quantidade = arredondar(linha.quantidade + Math.abs(Number(item.quantidade) || 0));
    linha.movimentos += 1;
    mapa.set(chave, linha);
  }
  return [...mapa.values()].sort((a, b) => b.movimentos - a.movimentos || b.quantidade - a.quantidade || a.material.localeCompare(b.material, 'pt-BR'));
};

export const resumoDoDia = (entrada: {
  dia: string;
  materiais: readonly Material[];
  movimentos: readonly MovimentoMaterial[];
  abastecimentos: readonly Abastecimento[];
  controles: readonly ControleEquipamentoDiario[];
  equipamentos: readonly Equipamento[];
}): ResumoDoDia => {
  const { dia } = entrada;
  const vigentes = entrada.movimentos.filter(item => !item.canceladoEm);
  const doDia = vigentes.filter(item => item.data === dia);
  const avisos = avisosDeMateriais(posicaoEstoque([...entrada.materiais], [...vigentes], dia), vigentes, dia).filter(aviso => aviso.gravidade !== 'info');

  const todosEnvios = enviosDoCampo(entrada.movimentos);

  const controles = entrada.controles.filter(item => item.data === dia && item.status !== 'Desmobilizado');
  const vistos = new Map<string, number>();
  controles.forEach(item => vistos.set(item.prefixo, (vistos.get(item.prefixo) || 0) + 1));
  const parados = controles
    .filter(item => STATUS_PARADO.includes(item.status))
    .map(item => ({ prefixo: item.prefixo || 'Sem prefixo', status: item.status, motivo: (item.motivoManutencao || item.observacao || '').trim() }))
    .sort((a, b) => Number(Boolean(a.motivo)) - Number(Boolean(b.motivo)) || a.prefixo.localeCompare(b.prefixo, 'pt-BR', { numeric: true }));

  const prefixoDe = new Map(entrada.equipamentos.map(item => [item.id, item.prefixo]));
  const abastecimentos = entrada.abastecimentos.filter(item => item.data === dia && item.status !== 'Cancelado' && item.status !== 'Duplicado');
  const porEquipamento = new Map<string, number>();
  abastecimentos.forEach(item => {
    const prefixo = prefixoDe.get(item.equipamentoId) || item.prefixoInformado || 'Sem prefixo';
    porEquipamento.set(prefixo, arredondar((porEquipamento.get(prefixo) || 0) + (Number(item.quantidadeLitros) || 0)));
  });

  return {
    materiais: {
      entradas: somarPorMaterial(doDia.filter(item => item.tipo === 'Entrada')),
      saidas: somarPorMaterial(doDia.filter(item => item.tipo === 'Saída')),
      avisos,
    },
    apontadores: {
      envios: todosEnvios.filter(envio => envio.data === dia),
      faltando: semEnvioNoDia(todosEnvios, dia),
    },
    equipamentos: {
      apontados: vistos.size,
      emOperacao: new Set(controles.filter(item => item.status === 'Em operação').map(item => item.prefixo)).size,
      parados,
      semMotivo: parados.filter(item => !item.motivo).length,
      repetidos: [...vistos.entries()].filter(([, vezes]) => vezes > 1).map(([prefixo]) => prefixo).sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true })),
    },
    diesel: {
      litros: arredondar(abastecimentos.reduce((soma, item) => soma + (Number(item.quantidadeLitros) || 0), 0)),
      abastecimentos: abastecimentos.length,
      porEquipamento: [...porEquipamento.entries()].map(([prefixo, litros]) => ({ prefixo, litros })).sort((a, b) => b.litros - a.litros || a.prefixo.localeCompare(b.prefixo, 'pt-BR', { numeric: true })),
      aConferir: abastecimentos.filter(item => item.status && item.status !== 'OK').length,
    },
  };
};
