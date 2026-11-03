import { useState, memo } from 'react';
import { Calendar, Check, RefreshCw, Save, X } from 'lucide-react';
import type { Funcionario, GrupoEquipe } from '../../types';

interface FuncionarioEscalado {
  id: string;
  nome: string;
  escalado: boolean;
  observacao?: string;
}

interface EscalaSabadoData {
  funcionarios: FuncionarioEscalado[];
  observacaoGeral?: string;
}

interface Props {
  grupo: GrupoEquipe;
  funcionarios: Funcionario[];
  escalaExistente?: EscalaSabadoData | null;
  proximoSabado: string;
  onSalvar: (scale: EscalaSabadoData) => Promise<{ success: boolean; message: string }>;
  onCancelar: () => void;
}

const dataBr = (iso: string) => {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return iso;
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
};

export const PresencaEscalaSabado = memo(function PresencaEscalaSabado({
  grupo,
  funcionarios,
  escalaExistente,
  proximoSabado,
  onSalvar,
  onCancelar,
}: Props) {
  const grupoFuncionarios = new Set(grupo.funcionarioIds || []);
  const membros = funcionarios.filter(f => grupoFuncionarios.has(f.id));

  const [funcionariosEscalados, setFuncionariosEscalados] = useState<Record<string, boolean>>(() => {
    if (!escalaExistente?.funcionarios) {
      return Object.fromEntries(membros.map(f => [f.id, false]));
    }
    return Object.fromEntries(
      escalaExistente.funcionarios.map(f => [f.id, f.escalado]),
    );
  });

  const [observacao, setObservacao] = useState(escalaExistente?.observacaoGeral || '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const escalados = Object.values(funcionariosEscalados).filter(Boolean).length;

  const alternar = (funcionarioId: string) => {
    setFuncionariosEscalados(current => ({
      ...current,
      [funcionarioId]: !current[funcionarioId],
    }));
    setErro('');
  };

  const salvar = async () => {
    if (salvando) return;
    setSalvando(true);
    setErro('');
    try {
      const scale: EscalaSabadoData = {
        funcionarios: membros.map(f => ({
          id: f.id,
          nome: f.nome,
          escalado: funcionariosEscalados[f.id] || false,
        })),
        observacaoGeral: observacao.trim() || undefined,
      };
      const response = await onSalvar(scale);
      if (!response.success) {
        setErro(response.message);
        return;
      }
      onCancelar();
    } catch (caught) {
      setErro(caught instanceof Error ? caught.message : 'Não foi possível salvar a escala.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <article className="presence-public__saturday-scale">
      <div className="presence-public__saturday-header">
        <Calendar className="h-5 w-5 text-emerald-700" aria-hidden="true" />
        <h2>Escala para sábado</h2>
        <span className="ml-auto text-sm text-slate-600">{dataBr(proximoSabado)}</span>
      </div>

      <fieldset className="presence-public__saturday-fieldset">
        <legend className="presence-public__saturday-legend">
          Quem vem ({escalados} de {membros.length})
        </legend>
        <div className="presence-public__saturday-list">
          {membros.length === 0 && (
            <p className="presence-public__empty">Nenhum funcionário nesta equipe.</p>
          )}
          {membros.map(pessoa => (
            <label
              key={pessoa.id}
              className="presence-public__saturday-item"
            >
              <input
                type="checkbox"
                checked={funcionariosEscalados[pessoa.id] || false}
                onChange={() => alternar(pessoa.id)}
                className="presence-public__saturday-checkbox"
                aria-label={`Escalar ${pessoa.nome} para sábado`}
              />
              <div className="presence-public__saturday-info">
                <span className="presence-public__saturday-name">{pessoa.nome}</span>
                <span className="presence-public__saturday-cargo">{pessoa.cargo}</span>
              </div>
              {funcionariosEscalados[pessoa.id] && (
                <Check className="h-5 w-5 text-emerald-700" aria-hidden="true" />
              )}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="presence-public__saturday-label">
        <span>Observações</span>
        <textarea
          value={observacao}
          onChange={event => setObservacao(event.target.value)}
          placeholder="Anotações sobre a escala…"
          rows={2}
          className="presence-public__saturday-textarea"
          disabled={salvando}
          aria-label="Observações da escala de sábado"
        />
      </label>

      {erro && (
        <div role="alert" className="presence-public__card-error">
          {erro}
        </div>
      )}

      <div className="presence-public__saturday-actions">
        <button
          type="button"
          onClick={onCancelar}
          disabled={salvando}
          className="presence-public__secondary"
        >
          <X className="h-4 w-4" />
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => void salvar()}
          disabled={salvando}
          className="presence-public__primary"
        >
          {salvando ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Salvando…
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Salvar escala
            </>
          )}
        </button>
      </div>
    </article>
  );
});
