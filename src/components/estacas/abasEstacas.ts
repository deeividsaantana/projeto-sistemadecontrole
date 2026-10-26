import { FileBarChart, FileSpreadsheet, Hammer, LayoutDashboard, ListOrdered, PackageCheck } from 'lucide-react';
import type { AbaDaTela } from '../../shared/ui/AbasDaTela';

/** Subtela aberta no Controle de Estacas. */
export type SecaoEstacas = 'visao' | 'cravar' | 'estacas' | 'relatorios' | 'recebimentos' | 'importar';

interface Numeros {
  /** Estacas que faltam cravar na obra toda (pede atenção). */
  faltam: number;
  /** Estacas na lista (total). */
  estacas: number;
  /** Notas fiscais ainda por conferir (pede atenção). */
  notasPendentes: number;
  /** Lotes recebidos (total). */
  lotes: number;
}

/**
 * As seis subtelas de Estacas como abas no topo (AbasDaTela), na ordem de
 * uso: ver como está, lançar, conferir e trazer planilha. Seis cabem numa
 * linha só, sem grupos. O selo laranja diz o que pede atenção (estacas que
 * faltam, notas a conferir); o cinza, só quantas há.
 */
export const abasEstacas = ({ faltam, estacas, notasPendentes, lotes }: Numeros): AbaDaTela<SecaoEstacas>[] => [
  { id: 'visao', rotulo: 'Visão geral', curto: 'Visão', icone: LayoutDashboard, contador: faltam, contadorRotulo: 'faltam cravar' },
  { id: 'relatorios', rotulo: 'Relatórios', icone: FileBarChart },
  { id: 'cravar', rotulo: 'Lançar cravação', curto: 'Lançar', icone: Hammer },
  { id: 'estacas', rotulo: 'Estacas', icone: ListOrdered, contador: estacas, contadorRotulo: 'estacas', tom: 'neutro' },
  notasPendentes > 0
    ? { id: 'recebimentos', rotulo: 'Recebimentos', icone: PackageCheck, contador: notasPendentes, contadorRotulo: 'notas para conferir' }
    : { id: 'recebimentos', rotulo: 'Recebimentos', icone: PackageCheck, contador: lotes, contadorRotulo: 'lotes', tom: 'neutro' },
  { id: 'importar', rotulo: 'Importar planilha', curto: 'Importar', icone: FileSpreadsheet },
];
