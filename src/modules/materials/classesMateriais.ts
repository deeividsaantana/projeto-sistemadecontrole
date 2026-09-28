/**
 * Classe de cada material, para a utilização por ramo ser lida por família:
 * tubo de concreto separado por diâmetro, tubo PEAD, madeira, aço, agregados.
 * A classe sai do nome e da categoria do cadastro; nada é gravado.
 */
import type { Material } from '../../types';
import { normalizeComparable } from '../../utils/canonicalIdentity';
import { toPieces, unitLabel } from './materialPieces';
import type { MaterialBranchUsage } from './materialUsage';

export const CLASSES_MATERIAL = ['Tubo de concreto', 'Tubo PEAD e PVC', 'Madeira', 'Aço', 'Agregados', 'Concreto e argamassa', 'Outros'] as const;
export type ClasseMaterial = typeof CLASSES_MATERIAL[number];

const texto = (material: Pick<Material, 'descricao' | 'categoria'>) => ` ${normalizeComparable(`${material.categoria || ''} ${material.descricao || ''}`)} `;

export const classeDoMaterial = (material: Pick<Material, 'descricao' | 'categoria'>): ClasseMaterial => {
  const t = texto(material);
  const tubo = /\b(tubo|tubos|manilha|aduela)\b/.test(t);
  if (tubo && /\b(pead|pvc|kananet|corrugad\w*)\b/.test(t)) return 'Tubo PEAD e PVC';
  if (tubo && /\b(concreto|pa ?\d|ps ?\d)\b|\baduela\b|\bmanilha\b/.test(t)) return 'Tubo de concreto';
  if (/\b(madeira|compensad\w*|plastificad\w*|pontalete|sarrafo|tabua|caibro|eucalipto|pinus)\b/.test(t)) return 'Madeira';
  if (/\b(aco|vergalh\w*|arame|tela soldada|ca ?50|ca ?60)\b/.test(t)) return 'Aço';
  if (/\b(brita|areia|pedra|pedrisco|rachao|bgs|bgtc|cascalho|macadame|agregad\w*)\b/.test(t)) return 'Agregados';
  if (/\b(concreto|argamassa|cimento|graute)\b/.test(t)) return 'Concreto e argamassa';
  return 'Outros';
};

/** Diâmetro do tubo: o do cadastro, ou o que o nome diz ("Ø800", "DN 1000"). */
export const diametroDoMaterial = (material: Pick<Material, 'descricao' | 'diametroMm'>): number | undefined => {
  if (Number(material.diametroMm) > 0) return Number(material.diametroMm);
  const achado = (material.descricao || '').match(/(?:Ø|ø|\bDN)\s*(\d{2,4})\b/i)?.[1];
  return achado ? Number(achado) : undefined;
};

/** Tipo dentro da classe: o diâmetro para tubo; para o resto, o próprio material. */
export const tipoDoMaterial = (material: Pick<Material, 'descricao' | 'categoria' | 'diametroMm'>): string => {
  const classe = classeDoMaterial(material);
  if (classe === 'Tubo de concreto' || classe === 'Tubo PEAD e PVC') {
    const diametro = diametroDoMaterial(material);
    if (diametro) return `Ø${diametro}`;
  }
  return material.descricao.trim() || 'Sem nome';
};

/** Ordem de leitura: tubo do menor para o maior diâmetro, depois pelo nome. */
export const ordemDoTipo = (a: string, b: string) => {
  const da = Number(a.match(/^Ø(\d+)$/)?.[1]);
  const db = Number(b.match(/^Ø(\d+)$/)?.[1]);
  if (da && db) return da - db;
  if (da) return -1;
  if (db) return 1;
  return a.localeCompare(b, 'pt-BR', { numeric: true });
};

export interface LinhaDoTipo {
  tipo: string;
  /** Peça quando o material tem comprimento de peça; senão, a unidade do cadastro. */
  unidade: string;
  recebido: number;
  usado: number;
  percentual: number | null;
  /** Uso apontado em ramo que não tem entrada: fica fora do percentual. */
  usadoSemEntrada: number;
  ramos: number;
}

/**
 * Soma da classe por tipo (Ø800, Ø1000...), em todos os ramos: recebido,
 * usado e %. Tubo soma em peças; unidades diferentes ficam em linhas separadas.
 */
export const resumoPorTipo = (linhas: readonly MaterialBranchUsage[], catalogo: ReadonlyMap<string, Material>): LinhaDoTipo[] => {
  const grupos = new Map<string, LinhaDoTipo & { ramosVistos: Set<string> }>();
  for (const linha of linhas) {
    const material = catalogo.get(linha.materialId) ?? { descricao: linha.materialDescription, categoria: '' };
    const tipo = tipoDoMaterial(material);
    const pecas = toPieces(catalogo.get(linha.materialId), 1) !== null;
    const unidade = pecas ? 'pç' : unitLabel(linha.unit);
    const emUnidade = (valor: number) => (pecas ? toPieces(catalogo.get(linha.materialId), valor) ?? valor : valor);
    const chave = `${tipo}\u0000${unidade}`;
    const grupo = grupos.get(chave) ?? { tipo, unidade, recebido: 0, usado: 0, percentual: null, usadoSemEntrada: 0, ramos: 0, ramosVistos: new Set<string>() };
    grupo.recebido += emUnidade(linha.received);
    grupo.usado += emUnidade(linha.used);
    if (linha.received <= 0) grupo.usadoSemEntrada += emUnidade(linha.used);
    grupo.ramosVistos.add(linha.branchId);
    grupos.set(chave, grupo);
  }
  return [...grupos.values()]
    .map(({ ramosVistos, ...grupo }) => ({
      ...grupo,
      recebido: Number(grupo.recebido.toFixed(2)),
      usado: Number(grupo.usado.toFixed(2)),
      usadoSemEntrada: Number(grupo.usadoSemEntrada.toFixed(2)),
      percentual: grupo.recebido > 0 ? Number((((grupo.usado - grupo.usadoSemEntrada) / grupo.recebido) * 100).toFixed(1)) : null,
      ramos: ramosVistos.size,
    }))
    .sort((a, b) => ordemDoTipo(a.tipo, b.tipo) || a.unidade.localeCompare(b.unidade));
};
