import { FileBarChart, FileSpreadsheet, Hammer, LayoutDashboard, ListOrdered, PackageCheck } from 'lucide-react';
import type { ItemDasAbas } from '../../shared/ui/AbasDaTela';

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
 * Subtelas de Estacas como abas no topo (AbasDaTela). A primeira linha tem só
 * o que se usa todo dia: ver como está, lançar e a lista. Relatórios, notas
 * recebidas e planilha ficam num grupo só, que abre a segunda linha. O selo
 * laranja diz o que pede atenção (estacas que faltam, notas a conferir); o
 * cinza, só quantas há.
 */
export const abasEstacas = ({ faltam, estacas, notasPendentes, lotes }: Numeros): ItemDasAbas<SecaoEstacas>[] => [
  { id: 'visao', rotulo: 'Visão geral', curto: 'Visão', icone: LayoutDashboard, contador: faltam, contadorRotulo: 'faltam cravar' },
  { id: 'cravar', rotulo: 'Lançar cravação', curto: 'Lançar', icone: Hammer },
  { id: 'estacas', rotulo: 'Estacas', icone: ListOrdered, contador: estacas, contadorRotulo: 'estacas', tom: 'neutro' },
  {
    grupo: 'documentos',
    rotulo: 'Relatórios e notas',
    curto: 'Relatórios',
    icone: FileBarChart,
    abas: [
      { id: 'relatorios', rotulo: 'Relatórios', icone: FileBarChart },
      notasPendentes > 0
        ? { id: 'recebimentos', rotulo: 'Recebimentos', icone: PackageCheck, contador: notasPendentes, contadorRotulo: 'notas para conferir' }
        : { id: 'recebimentos', rotulo: 'Recebimentos', icone: PackageCheck, contador: lotes, contadorRotulo: 'lotes', tom: 'neutro' },
      { id: 'importar', rotulo: 'Importar planilha', curto: 'Importar', icone: FileSpreadsheet },
    ],
  },
];
