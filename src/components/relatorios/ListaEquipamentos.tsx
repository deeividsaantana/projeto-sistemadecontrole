import { useMemo } from 'react';
import type { Equipamento, ControleEquipamentoDiario } from '../../types';
import { TabelaPadrao, type ColunaTabela } from '../../shared/ui/TabelaPadrao';

interface Props {
  equipamentos: readonly Equipamento[];
  registros: readonly ControleEquipamentoDiario[];
}

interface EquipamentoComAtividade extends Equipamento {
  atividades: number;
}

const COLUNAS: ColunaTabela<EquipamentoComAtividade>[] = [
  { chave: 'prefixo', titulo: 'Prefixo', valorOrdenacao: eq => eq.prefixo, render: eq => <span className="font-mono font-bold text-slate-950">{eq.prefixo}</span> },
  { chave: 'modelo', titulo: 'Modelo', valorOrdenacao: eq => eq.modelo || null, render: eq => eq.modelo || 'Sem modelo' },
  { chave: 'atividades', titulo: 'Lançamentos', alinhamento: 'direita', valorOrdenacao: eq => eq.atividades, render: eq => eq.atividades.toLocaleString('pt-BR') },
];

export function ListaEquipamentos({ equipamentos, registros }: Props) {
  const equipamentosComAtividade = useMemo(() => {
    const mapa = new Map<string, number>();

    registros.forEach((reg) => {
      mapa.set(reg.equipamentoId, (mapa.get(reg.equipamentoId) || 0) + 1);
    });

    return equipamentos
      .map(eq => ({
        ...eq,
        atividades: mapa.get(eq.id) || 0,
      }))
      .sort((a, b) => b.atividades - a.atividades);
  }, [equipamentos, registros]);

  return (
    <TabelaPadrao
      titulo="Equipamentos e lançamentos na frota"
      linhas={equipamentosComAtividade}
      colunas={COLUNAS}
      idDaLinha={item => item.id}
      nomeDoItem={{ um: 'equipamento', varios: 'equipamentos' }}
      ordenacaoInicial={{ chave: 'atividades', direcao: 'desc' }}
      vazio="Nenhum equipamento cadastrado ainda."
    />
  );
}
