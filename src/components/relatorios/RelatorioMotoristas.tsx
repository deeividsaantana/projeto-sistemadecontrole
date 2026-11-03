import { useMemo } from 'react';
import type { Funcionario, ControleEquipamentoDiario } from '../../types';
import { TabelaPadrao, type ColunaTabela } from '../../shared/ui/TabelaPadrao';

interface Props {
  funcionarios: readonly Funcionario[];
  registros: readonly ControleEquipamentoDiario[];
}

interface MotoristaAgregado {
  id: string;
  nome: string;
  matricula?: string;
  quantidadeLancamentos: number;
  equipamentoUltimo?: string;
  dataUltimo?: string;
}

export function RelatorioMotoristas({ funcionarios, registros }: Props) {
  const dados = useMemo(() => {
    const motoristas = new Map<string, MotoristaAgregado>();

    registros.forEach((reg) => {
      if (!reg.nomeMotorista) return;

      const key = reg.nomeMotorista;
      const atual = motoristas.get(key) || {
        id: `motorista-${key}`,
        nome: reg.nomeMotorista,
        matricula: funcionarios.find(f => f.nome === reg.nomeMotorista)?.matricula,
        quantidadeLancamentos: 0,
      };

      motoristas.set(key, {
        ...atual,
        quantidadeLancamentos: atual.quantidadeLancamentos + 1,
        equipamentoUltimo: reg.prefixo,
        dataUltimo: reg.data,
      });
    });

    return Array.from(motoristas.values()).sort(
      (a, b) => b.quantidadeLancamentos - a.quantidadeLancamentos,
    );
  }, [funcionarios, registros]);

  const colunas: ColunaTabela<MotoristaAgregado>[] = [
    {
      chave: 'nome',
      titulo: 'Nome',
      render: linha => linha.nome,
      valorOrdenacao: linha => linha.nome,
    },
    {
      chave: 'matricula',
      titulo: 'Matrícula',
      render: linha => linha.matricula || '—',
      valorOrdenacao: linha => linha.matricula,
    },
    {
      chave: 'quantidadeLancamentos',
      titulo: 'Lançamentos',
      alinhamento: 'direita',
      render: linha => linha.quantidadeLancamentos,
      valorOrdenacao: linha => linha.quantidadeLancamentos,
    },
    {
      chave: 'equipamentoUltimo',
      titulo: 'Último Equipamento',
      render: linha => linha.equipamentoUltimo || '—',
      valorOrdenacao: linha => linha.equipamentoUltimo,
    },
    {
      chave: 'dataUltimo',
      titulo: 'Data Último Uso',
      render: linha => linha.dataUltimo || '—',
      valorOrdenacao: linha => linha.dataUltimo,
    },
  ];

  return (
    <div className="space-y-6 rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-slate-50 p-6">
      <div className="flex items-end justify-between border-b border-emerald-200 pb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-emerald-950">Desempenho dos Motoristas</h2>
          <p className="mt-2 text-sm font-medium text-emerald-700">
            {dados.length}
            {' '}
            {dados.length === 1 ? 'motorista ativo' : 'motoristas ativos'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-emerald-600">
            {dados.reduce((acc, m) => acc + m.quantidadeLancamentos, 0)}
          </p>
          <p className="text-xs font-medium text-slate-600">lançamentos total</p>
        </div>
      </div>
      <TabelaPadrao
        titulo="Relatório de motoristas"
        linhas={dados}
        colunas={colunas}
        idDaLinha={item => item.id}
        nomeDoItem={{ um: 'motorista', varios: 'motoristas' }}
        semPaginacao
      />
    </div>
  );
}
