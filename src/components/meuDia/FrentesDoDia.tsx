import { useMemo, useState } from 'react';
import { HardHat, Plus, Target, TrendingUp } from 'lucide-react';
import type { FrenteServico, PlanejamentoItem, RegistroProducao, ServicoObra } from '../../types';
import { SEM_FRENTE, avancoPorFrente, resumoDasFrentes, type AvancoFrente, type LinhaAvanco } from '../../modules/rotina/avancoFrentes';
import { formatarData, numero } from '../../utils/formato';
import { EmptyState, Modal } from '../../shared/ui';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, CARTAO, ROTULO } from '../cadastros/estilos';

interface Props {
  dia: string;
  responsavel: string;
  frentes: readonly FrenteServico[];
  servicos: readonly ServicoObra[];
  registros: readonly RegistroProducao[];
  planos: readonly PlanejamentoItem[];
  onSaveProducao?: (registro: RegistroProducao, isNew: boolean) => void;
  onSavePlano?: (plano: PlanejamentoItem, isNew: boolean) => void;
}

type Formulario = { tipo: 'producao' | 'previsto'; frente: string; servicoId: string; quantidade: string; ate: string; observacao: string };

const novoId = (prefixo: string) => `${prefixo}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const fimDoMes = (dia: string) => {
  const [ano, mes] = dia.split('-').map(Number);
  return new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10);
};
const lerNumero = (texto: string) => Number(texto.replace(/\./g, '').replace(',', '.'));

function Linha({ linha }: { linha: LinhaAvanco }) {
  const temPrevisto = linha.previsto !== undefined;
  const largura = Math.min(linha.percentual || 0, 100);
  return (
    <li className="space-y-2 px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <strong className="min-w-0 break-words text-sm font-bold text-slate-900">{linha.servico}</strong>
        {temPrevisto
          ? <span className="text-lg font-black tabular-nums text-slate-900">{numero(linha.percentual || 0, 1)}%</span>
          : <span className="text-xs font-bold text-amber-800">Sem previsto</span>}
      </div>
      {temPrevisto && (
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200" role="img" aria-label={`Avanço ${numero(linha.percentual || 0, 1)}%`}>
          <div className={`h-full rounded-full transition-[width] duration-500 ${largura >= 100 ? 'bg-[#176b4d]' : 'bg-[#f26a2e]'}`} style={{ width: `${largura}%` }} />
        </div>
      )}
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm sm:grid-cols-4">
        <div><dt className="text-xs text-slate-500">Hoje</dt><dd className="font-bold tabular-nums text-slate-900">{numero(linha.hoje)} {linha.unidade}</dd></div>
        <div><dt className="text-xs text-slate-500">Acumulado</dt><dd className="font-bold tabular-nums text-slate-900">{numero(linha.acumulado)} {linha.unidade}</dd></div>
        <div><dt className="text-xs text-slate-500">Previsto</dt><dd className="font-bold tabular-nums text-slate-900">{temPrevisto ? `${numero(linha.previsto || 0)} ${linha.unidade}` : '—'}</dd></div>
        <div><dt className="text-xs text-slate-500">Falta</dt><dd className={`font-bold tabular-nums ${(linha.saldo ?? 0) < 0 ? 'text-[#176b4d]' : 'text-slate-900'}`}>{linha.saldo === undefined ? '—' : linha.saldo < 0 ? `Passou ${numero(-linha.saldo)} ${linha.unidade}` : `${numero(linha.saldo)} ${linha.unidade}`}</dd></div>
      </dl>
      {linha.desde && <p className="text-xs text-slate-500">Previsto de {formatarData(linha.desde)} a {formatarData(linha.ate || linha.desde)}</p>}
    </li>
  );
}

export function FrentesDoDia({ dia, responsavel, frentes, servicos, registros, planos, onSaveProducao, onSavePlano }: Props) {
  const [formulario, setFormulario] = useState<Formulario | null>(null);
  const [erro, setErro] = useState('');
  const avanco = useMemo(() => avancoPorFrente(dia, frentes, servicos, registros, planos), [dia, frentes, servicos, registros, planos]);
  const resumo = resumoDasFrentes(avanco);
  const servicosAtivos = useMemo(() => servicos.filter(item => item.ativo !== false && item.situacao !== 'Concluído').sort((a, b) => a.descricao.localeCompare(b.descricao, 'pt-BR')), [servicos]);

  const abrir = (tipo: Formulario['tipo'], grupo: AvancoFrente) => {
    setErro('');
    setFormulario({ tipo, frente: grupo.nome === SEM_FRENTE ? '' : grupo.nome, servicoId: grupo.linhas[0]?.servicoId || servicosAtivos[0]?.id || '', quantidade: '', ate: grupo.frente?.dataTerminoPrevisto && grupo.frente.dataTerminoPrevisto >= dia ? grupo.frente.dataTerminoPrevisto : fimDoMes(dia), observacao: '' });
  };

  const salvar = () => {
    if (!formulario) return;
    const servico = servicos.find(item => item.id === formulario.servicoId);
    const quantidade = lerNumero(formulario.quantidade);
    if (!servico) return setErro('Escolha o serviço.');
    if (!(quantidade > 0)) return setErro('Escreva uma quantidade maior que zero.');
    const agora = new Date().toISOString();
    const frente = formulario.frente.trim() || undefined;
    if (formulario.tipo === 'producao' && onSaveProducao) {
      onSaveProducao({ id: novoId('producao'), data: dia, servicoId: servico.id, servicoDescricao: servico.descricao, unidade: servico.unidade, quantidade, frente, responsavel, observacao: formulario.observacao.trim() || undefined, ativo: true, criadoEm: agora, atualizadoEm: agora }, true);
    }
    if (formulario.tipo === 'previsto' && onSavePlano) {
      if (!formulario.ate || formulario.ate < dia) return setErro('O fim do previsto não pode ser antes do dia.');
      onSavePlano({ id: novoId('plano'), dataInicio: dia, dataFim: formulario.ate, servicoId: servico.id, servicoDescricao: servico.descricao, unidade: servico.unidade, quantidadePlanejada: quantidade, frente, responsavel, situacao: 'Planejado', observacao: formulario.observacao.trim() || undefined, ativo: true, criadoEm: agora, atualizadoEm: agora }, true);
    }
    setFormulario(null);
  };

  if (!avanco.length) {
    return (
      <div data-meu-dia-reveal className={`${CARTAO} p-4`}>
        <EmptyState icon={HardHat} title="Nenhuma frente em andamento" description="Cadastre as frentes em Central operacional > Frentes e os serviços em Produção. A produção lançada aparece aqui com o avanço." />
      </div>
    );
  }

  const unidade = servicos.find(item => item.id === formulario?.servicoId)?.unidade || '';

  return (
    <div className="space-y-4">
      <div data-meu-dia-reveal className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className={`${CARTAO} p-3 sm:p-4`}><p className="text-xs font-semibold text-slate-600 sm:text-sm">Trabalharam no dia</p><strong className="text-2xl font-black tabular-nums text-slate-900">{resumo.trabalharam}</strong></div>
        <div className={`${CARTAO} p-3 sm:p-4`}><p className="text-xs font-semibold text-slate-600 sm:text-sm">Sem produção lançada</p><strong className={`text-2xl font-black tabular-nums ${resumo.semProducao ? 'text-[#f26a2e]' : 'text-slate-900'}`}>{resumo.semProducao}</strong></div>
        <div className={`${CARTAO} p-3 sm:p-4`}><p className="text-xs font-semibold text-slate-600 sm:text-sm">Serviços sem previsto</p><strong className="text-2xl font-black tabular-nums text-slate-900">{resumo.semPrevisto}</strong></div>
      </div>

      <div className="grid items-start gap-3 lg:grid-cols-2">
        {avanco.map(grupo => (
          <article key={grupo.nome} data-meu-dia-reveal className={`${CARTAO} overflow-hidden`}>
            <header className="flex flex-wrap items-start gap-3 border-b border-slate-100 bg-[#f7f8f6] px-4 py-3">
              <div className="min-w-0 flex-1 basis-40">
                <h3 className="break-words text-base font-bold text-slate-900">{grupo.nome}</h3>
                <p className="text-sm text-slate-600">
                  {[grupo.frente?.servico, grupo.frente?.responsavel && `Resp.: ${grupo.frente.responsavel}`, grupo.frente?.situacao].filter(Boolean).join(' · ') || 'Frente sem cadastro'}
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${grupo.trabalhouHoje ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-amber-50 text-amber-800 ring-amber-200'}`}>
                {grupo.trabalhouHoje ? 'Produziu no dia' : 'Sem produção no dia'}
              </span>
            </header>
            {grupo.linhas.length
              ? <ul className="divide-y divide-slate-100">{grupo.linhas.map(linha => <Linha key={linha.servicoId} linha={linha} />)}</ul>
              : <p className="px-4 py-3 text-sm text-slate-500">Nenhuma produção nem previsto lançado para esta frente.</p>}
            {(onSaveProducao || onSavePlano) && servicosAtivos.length > 0 && (
              <div className="grid grid-cols-2 gap-2 border-t border-slate-100 p-3">
                {onSaveProducao && (
                  <button type="button" className={BOTAO_PRIMARIO} onClick={() => abrir('producao', grupo)}>
                    <Plus className="size-4" aria-hidden="true" />
                    <span className="sm:hidden">Produção</span>
                    <span className="max-sm:hidden">Lançar produção</span>
                  </button>
                )}
                {onSavePlano && (
                  <button type="button" className={BOTAO_SECUNDARIO} onClick={() => abrir('previsto', grupo)}>
                    <Target className="size-4" aria-hidden="true" />
                    <span className="sm:hidden">Previsto</span>
                    <span className="max-sm:hidden">Definir previsto</span>
                  </button>
                )}
              </div>
            )}
          </article>
        ))}
      </div>

      <p data-meu-dia-reveal className="flex items-start gap-2 px-1 text-sm text-slate-500">
        <TrendingUp className="mt-0.5 size-4 shrink-0 text-[#718087]" aria-hidden="true" />
        Avanço = acumulado ÷ previsto × 100. Falta = previsto − acumulado. O acumulado conta a produção da frente desde o início do previsto.
      </p>

      <Modal
        open={Boolean(formulario)}
        title={formulario?.tipo === 'previsto' ? `Previsto de ${formulario.frente || 'serviço sem frente'}` : `Produção de ${formulario?.frente || 'serviço sem frente'} em ${formatarData(dia)}`}
        size="sm"
        onClose={() => setFormulario(null)}
        onSubmit={salvar}
        footer={(
          <div className="grid grid-cols-2 gap-3">
            <button type="button" className={BOTAO_SECUNDARIO} onClick={() => setFormulario(null)}>Cancelar</button>
            <button type="button" className={BOTAO_PRIMARIO} onClick={salvar}>Salvar</button>
          </div>
        )}
      >
        {formulario && (
          <div className="space-y-3">
            <label className="block space-y-1.5">
              <span className={ROTULO}>Serviço</span>
              <select className={CAMPO} value={formulario.servicoId} onChange={event => setFormulario({ ...formulario, servicoId: event.target.value })}>
                {servicosAtivos.map(item => <option key={item.id} value={item.id}>{item.descricao} ({item.unidade})</option>)}
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className={ROTULO}>{formulario.tipo === 'previsto' ? 'Quanto está previsto' : 'Quanto foi feito no dia'}{unidade ? ` (${unidade})` : ''}</span>
              <input className={CAMPO} inputMode="decimal" value={formulario.quantidade} autoFocus placeholder="Ex.: 1.250" onChange={event => setFormulario({ ...formulario, quantidade: event.target.value.replace(/[^\d.,]/g, '') })} />
            </label>
            {formulario.tipo === 'previsto' && (
              <label className="block space-y-1.5">
                <span className={ROTULO}>Previsto até</span>
                <input type="date" className={CAMPO} value={formulario.ate} min={dia} onChange={event => setFormulario({ ...formulario, ate: event.target.value })} />
                <span className="block text-xs text-slate-500">Começa em {formatarData(dia)}. Aparece também em Planejamento.</span>
              </label>
            )}
            <label className="block space-y-1.5">
              <span className={ROTULO}>Observação (opcional)</span>
              <input className={CAMPO} value={formulario.observacao} maxLength={300} onChange={event => setFormulario({ ...formulario, observacao: event.target.value })} />
            </label>
            {erro && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{erro}</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}
