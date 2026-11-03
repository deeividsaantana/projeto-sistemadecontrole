/**
 * Página de exemplo: Rastreamento de ciclos em frotas.
 * Use em /?screen=ciclos para visualizar.
 *
 * Este arquivo é um sandbox para prototipar a interface de ciclos.
 * Em produção, integre com o Controle de Frotas via aba "Ciclos".
 */

import { useState, useEffect } from 'react';
import { RegistrarCiclo, HistoricoCiclos, CycleTimeline } from '../components/ciclosEquipamento';
import { useCycleHistory } from '../fleet/useCycleHistory';
import type { CycleEvent, EquipmentCycle } from '../fleet/cycleHistory';

export const TelaExemploCiclos = () => {
  const { ciclos, registrarEvento, salvar } = useCycleHistory();
  const [selecionadoId, setSelecionadoId] = useState<string>('');
  const [equipamentos] = useState(new Map([
    ['eq-m31', { prefixo: 'M31', nome: 'Motoniveladora 31' }],
    ['eq-m32', { prefixo: 'M32', nome: 'Motoniveladora 32' }],
    ['eq-r45', { prefixo: 'R45', nome: 'Rolo 45' }],
  ]));

  // Dados de exemplo
  useEffect(() => {
    const exemploCiclos = [
      {
        id: 'cic-ex-1',
        equipamentoId: 'eq-m31',
        prefixo: 'M31',
        dataInicio: '2026-11-03',
        statusAtual: 'À disposição',
        eventos: [
          {
            id: 'evt-ex-1',
            equipamentoId: 'eq-m31',
            status: 'Em operação' as const,
            timestamp: '2026-11-03T08:00:00Z',
            hora: '08:00',
            responsavel: 'João',
          },
          {
            id: 'evt-ex-2',
            equipamentoId: 'eq-m31',
            status: 'Em manutenção' as const,
            timestamp: '2026-11-03T08:37:00Z',
            hora: '08:37',
            responsavel: 'João',
            motivo: 'Troca de óleo',
          },
          {
            id: 'evt-ex-3',
            equipamentoId: 'eq-m31',
            status: 'À disposição' as const,
            timestamp: '2026-11-03T09:37:00Z',
            hora: '09:37',
            responsavel: 'Maria',
          },
          {
            id: 'evt-ex-4',
            equipamentoId: 'eq-m31',
            status: 'Em operação' as const,
            timestamp: '2026-11-03T10:00:00Z',
            hora: '10:00',
            responsavel: 'Maria',
          },
        ] as CycleEvent[],
        duracao: 600,
      } as EquipmentCycle,
    ];

    // Carrega exemplo se não houver ciclos
    if (ciclos.length === 0) {
      exemploCiclos.forEach(ciclo => {
        ciclo.eventos.forEach(evento => {
          registrarEvento({
            ...evento,
            prefixo: ciclo.prefixo,
          });
        });
      });
      salvar();
    }
  }, []);

  const cicloDemonstrado = ciclos.find(c => c.equipamentoId === 'eq-m31' && c.dataInicio === '2026-11-03');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Cabeçalho */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Rastreamento de Ciclos</h1>
          <p className="text-slate-600 mt-2">
            Timeline visual de transições operacionais · Tipo Mercado Livre
          </p>
        </div>

        {/* Gradeç: Registrar + Timeline */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Coluna 1: Registrar ciclo */}
          <div className="lg:col-span-1">
            <RegistrarCiclo
              equipamentoId="eq-m31"
              prefixo="M31"
              usuarioAtual="João Silva"
              onSalvar={() => console.log('Novo evento registrado!')}
            />
          </div>

          {/* Coluna 2-3: Timeline do exemplo */}
          {cicloDemonstrado && (
            <div className="lg:col-span-2">
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">
                  Timeline · M31 · {cicloDemonstrado.dataInicio}
                </h2>
                <CycleTimeline
                  ciclo={cicloDemonstrado}
                  prefixo={cicloDemonstrado.prefixo}
                />
              </div>
            </div>
          )}
        </div>

        {/* Histórico completo */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <HistoricoCiclos
            ciclos={ciclos}
            equipamentos={equipamentos}
          />
        </div>

        {/* Info de desenvolvimento */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
          <strong>Desenvolvedor:</strong> Isso é uma página de exemplo. Em produção, integre com Controle de Frotas.
          <br />
          <strong>localStorage:</strong> <code>renea_ciclos_equipamentos</code>
          <br />
          <strong>Testes:</strong> <code>npm run test -- cycleHistory.test.ts</code>
        </div>
      </div>
    </div>
  );
};

export default TelaExemploCiclos;
