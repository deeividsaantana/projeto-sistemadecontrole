import { useState } from 'react';
import { Calendar, Save } from 'lucide-react';
import type { Funcionario, GrupoEquipe } from '../../types';
import { criarEscalaSabado, type EscalaSabadoRecord } from '../../utils/presencaManual';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, ROTULO } from '../cadastros/estilos';

interface Props {
  funcionarios: readonly Funcionario[];
  gruposEquipe: readonly GrupoEquipe[];
  escalaExistente?: EscalaSabadoRecord;
  onSalvar: (escala: EscalaSabadoRecord) => void;
  onCancelar: () => void;
}

// Data local, não toISOString: à noite em Brasília o UTC já é o dia seguinte.
const proximoSabado = (hoje = new Date()) => {
  const dia = new Date(hoje);
  dia.setDate(dia.getDate() + ((6 - hoje.getDay() + 7) % 7 || 7));
  return `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, '0')}-${String(dia.getDate()).padStart(2, '0')}`;
};

const dataBr = (iso: string) => iso.split('-').reverse().join('/');

export function EscalaSabado({ funcionarios, gruposEquipe, escalaExistente, onSalvar, onCancelar }: Props) {
  const [escala, setEscala] = useState<EscalaSabadoRecord>(
    () => escalaExistente ?? criarEscalaSabado(proximoSabado(), funcionarios, ''),
  );
  const [observacao, setObservacao] = useState(escala.observacaoGeral ?? '');
  const escalados = escala.funcionarios.filter(pessoa => pessoa.escalado).length;

  const alternar = (funcionarioId: string) => {
    setEscala(atual => ({
      ...atual,
      funcionarios: atual.funcionarios.map(pessoa =>
        pessoa.id === funcionarioId ? { ...pessoa, escalado: !pessoa.escalado } : pessoa),
    }));
  };

  const salvar = () => {
    onSalvar({ ...escala, observacaoGeral: observacao.trim() || undefined, atualizadoEm: new Date().toISOString() });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Calendar className="size-5 text-emerald-700" aria-hidden="true" />
        <h2 className="text-lg font-bold text-slate-950">Escala para sábado</h2>
        <span className="ml-auto text-sm text-slate-600">{dataBr(escala.data)}</span>
      </div>

      <div className="space-y-3">
        <label className={`${ROTULO} block`}>
          Equipe
          <select
            value={escala.grupoEquipeId}
            onChange={event => setEscala({ ...escala, grupoEquipeId: event.target.value })}
            className={`${CAMPO} mt-2`}
          >
            <option value="">Selecione uma equipe</option>
            {gruposEquipe.map(grupo => (
              <option key={grupo.id} value={grupo.id}>{grupo.nome}</option>
            ))}
          </select>
        </label>

        <fieldset className="space-y-2">
          <legend className={ROTULO}>
            Quem vem no sábado ({escalados} de {escala.funcionarios.length})
          </legend>
          <div className="grid max-h-72 gap-1 overflow-y-auto rounded-xl border border-slate-200 p-2">
            {escala.funcionarios.length === 0 && (
              <p className="p-2 text-sm text-slate-600">Nenhum funcionário cadastrado.</p>
            )}
            {escala.funcionarios.map(pessoa => (
              <label key={pessoa.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={pessoa.escalado}
                  onChange={() => alternar(pessoa.id)}
                  className="size-5 rounded border-slate-300 accent-emerald-700"
                />
                <span className="text-base text-slate-900 sm:text-sm">{pessoa.nome}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className={`${ROTULO} block`}>
          Observações
          <textarea
            value={observacao}
            onChange={event => setObservacao(event.target.value)}
            placeholder="Anotações sobre a escala"
            className={`${CAMPO} mt-2 min-h-24 py-2`}
          />
        </label>
      </div>

      <div className="flex gap-2 pt-2">
        <button type="button" onClick={onCancelar} className={`${BOTAO_SECUNDARIO} flex-1`}>
          Cancelar
        </button>
        <button type="button" onClick={salvar} className={`${BOTAO_PRIMARIO} flex-1`}>
          <Save className="size-4" aria-hidden="true" />
          Salvar escala
        </button>
      </div>
    </div>
  );
}
