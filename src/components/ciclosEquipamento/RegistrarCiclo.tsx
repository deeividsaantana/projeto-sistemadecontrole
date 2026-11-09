import { useState } from 'react';
import type { CycleStatus } from '../../fleet/cycleHistory';
import { adicionarEventoAoCiclo, salvarCiclosNoStorage, carregarCiclosDoStorage } from '../../fleet/cycleHistory';
import { CAMPO } from '../cadastros/estilos';

interface Props {
  equipamentoId: string;
  prefixo: string;
  usuarioAtual: string;
  onSalvar?: () => void;
}

const SITUACOES: CycleStatus[] = [
  'Em operação',
  'Em manutenção',
  'À disposição',
  'Aguardando manutenção',
];

const COR_BOTAO: Record<CycleStatus, string> = {
  'Em operação': 'bg-green-500 hover:bg-green-600',
  'Em manutenção': 'bg-orange-500 hover:bg-orange-600',
  'À disposição': 'bg-blue-500 hover:bg-blue-600',
  'Aguardando manutenção': 'bg-yellow-500 hover:bg-yellow-600',
};

export const RegistrarCiclo: React.FC<Props> = ({ equipamentoId, prefixo, usuarioAtual, onSalvar }) => {
  const [status, setStatus] = useState<CycleStatus>('Em operação');
  const [motivo, setMotivo] = useState('');
  const [operador, setOperador] = useState('');
  const [salvando, setSalvando] = useState(false);

  const handleRegistrar = async () => {
    if (!status) return;

    setSalvando(true);
    try {
      const agora = new Date();
      const timestamp = agora.toISOString();
      const hora = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;

      // Carrega ciclos atuais
      let ciclos = carregarCiclosDoStorage();

      // Adiciona novo evento
      ciclos = adicionarEventoAoCiclo(ciclos, {
        id: `evt-${equipamentoId}-${timestamp}`,
        equipamentoId,
        prefixo,
        status,
        timestamp,
        hora,
        responsavel: usuarioAtual,
        motivo: motivo.trim() || undefined,
        operador: operador.trim() || undefined,
      });

      // Salva de volta
      salvarCiclosNoStorage(ciclos);

      // Reset form
      setMotivo('');
      setOperador('');
      setStatus('Em operação');

      onSalvar?.();
    } catch (e) {
      console.error('Erro ao registrar ciclo:', e);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm">
      <h3 className="font-semibold text-slate-800 mb-3">Registrar situação · {prefixo}</h3>

      {/* Botões de status rápido */}
      <div className="grid grid-cols-2 gap-2 mb-4 md:grid-cols-4">
        {SITUACOES.map(sit => (
          <button
            key={sit}
            onClick={() => setStatus(sit)}
            className={`py-2 px-3 rounded-lg text-white text-sm font-medium transition-all ${
              status === sit ? `${COR_BOTAO[sit]} ring-2 ring-offset-2 ring-slate-300` : 'bg-slate-300 hover:bg-slate-400'
            }`}
            disabled={salvando}
          >
            {sit}
          </button>
        ))}
      </div>

      {/* Campo de motivo (obrigatório para manutenção) */}
      {(status === 'Em manutenção' || status === 'Aguardando manutenção') && (
        <div className="mb-4">
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            Motivo da manutenção *
          </label>
          <input
            type="text"
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            placeholder="Ex: Troca de óleo, pneu furado"
            className={`${CAMPO}`}
            disabled={salvando}
          />
        </div>
      )}

      {/* Campo de operador (só para "Em operação") */}
      {status === 'Em operação' && (
        <div className="mb-4">
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            Motorista/Operador (opcional)
          </label>
          <input
            type="text"
            value={operador}
            onChange={e => setOperador(e.target.value)}
            placeholder="Ex: João Silva"
            className={`${CAMPO}`}
            disabled={salvando}
          />
        </div>
      )}

      {/* Campo de observação opcional */}
      {status !== 'Em manutenção' && status !== 'Aguardando manutenção' && (
        <div className="mb-4">
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            Observação (opcional)
          </label>
          <input
            type="text"
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            placeholder="Ex: Canteiro SP-066"
            className={`${CAMPO}`}
            disabled={salvando}
          />
        </div>
      )}

      {/* Botão de salvar */}
      <button
        onClick={handleRegistrar}
        disabled={
          salvando ||
          !status ||
          (status === 'Em manutenção' && !motivo.trim()) ||
          (status === 'Aguardando manutenção' && !motivo.trim())
        }
        className="w-full bg-slate-800 hover:bg-slate-900 disabled:bg-slate-400 text-white font-medium py-2 rounded-lg transition-colors"
      >
        {salvando ? 'Salvando...' : 'Registrar'}
      </button>

      <p className="text-xs text-slate-500 mt-3">
        ⌨️ Atalho: Enter = salvar | Ctrl+S = salvar
      </p>
    </div>
  );
};
