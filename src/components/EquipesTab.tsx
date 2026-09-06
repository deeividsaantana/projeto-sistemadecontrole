/**
 * Equipes: como cada equipe está hoje — efetivo, presença, frota relacionada e
 * pendências — e a realocação de colaborador entre equipes.
 */
import { useMemo, useState } from 'react';
import { Activity, ArrowLeft, ArrowRightLeft, HardHat, Truck, Users } from 'lucide-react';
import type {
  ControleEquipamentoDiario,
  Funcionario,
  GrupoEquipe,
  ObraLocal,
  PresencaApontamento,
} from '../types';
import { normalizeComparable } from '../utils/canonicalIdentity';
import { Badge, Card, ConfirmDialog, EmptyState, PageHeader, StatCard, isoDay, statusTone } from '../shared/ui';

interface EquipesTabProps {
  gruposEquipe: GrupoEquipe[];
  funcionarios: Funcionario[];
  obras: ObraLocal[];
  presencasLink: PresencaApontamento[];
  controlesEquipamentos: ControleEquipamentoDiario[];
  podeRealocar: boolean;
  onSaveGrupoEquipe: (grupo: GrupoEquipe, isNew: boolean) => void;
  onNavigate: (tab: string) => void;
}

export default function EquipesTab({
  gruposEquipe,
  funcionarios,
  obras,
  presencasLink,
  controlesEquipamentos,
  podeRealocar,
  onSaveGrupoEquipe,
  onNavigate,
}: EquipesTabProps) {
  const hoje = isoDay(new Date());
  const [dia, setDia] = useState(hoje);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [realocacao, setRealocacao] = useState<{ funcionario: Funcionario; destinoId: string } | null>(null);

  const ativas = useMemo(
    () => gruposEquipe.filter(item => item.status !== 'inativo').sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [gruposEquipe],
  );

  const resumoDaEquipe = (grupo: GrupoEquipe) => {
    const apontamentos = presencasLink.filter(item => item.grupoId === grupo.id && item.data === dia);
    return {
      efetivo: grupo.funcionarioIds.length,
      apontados: apontamentos.length,
      presentes: apontamentos.filter(item => item.status === 'Presente').length,
      ausentes: apontamentos.filter(item => item.status === 'Ausente').length,
      obra: obras.find(item => item.id === grupo.obraId)?.nome,
    };
  };

  const selecionada = selecionadoId ? ativas.find(item => item.id === selecionadoId) : undefined;

  const realocar = () => {
    if (!realocacao || !selecionada) return;
    const destino = ativas.find(item => item.id === realocacao.destinoId);
    if (!destino) return;
    const agora = new Date().toISOString();
    // Duas gravações: sai de uma equipe e entra na outra. Cada uma passa pelo
    // log do sistema, então a realocação fica rastreada dos dois lados.
    onSaveGrupoEquipe({
      ...selecionada,
      funcionarioIds: selecionada.funcionarioIds.filter(id => id !== realocacao.funcionario.id),
      updatedAt: agora,
    }, false);
    onSaveGrupoEquipe({
      ...destino,
      funcionarioIds: [...new Set([...destino.funcionarioIds, realocacao.funcionario.id])],
      updatedAt: agora,
    }, false);
    setRealocacao(null);
  };

  if (selecionada) {
    const resumo = resumoDaEquipe(selecionada);
    const membros = selecionada.funcionarioIds
      .map(id => funcionarios.find(item => item.id === id))
      .filter((item): item is Funcionario => Boolean(item))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    const apontamentosDoDia = presencasLink.filter(item => item.grupoId === selecionada.id && item.data === dia);
    const nomesDaEquipe = new Set(membros.map(item => normalizeComparable(item.nome)));
    const frota = controlesEquipamentos
      .filter(item => item.data === dia && (
        selecionada.funcionarioIds.includes(item.funcionarioId)
        || nomesDaEquipe.has(normalizeComparable(item.nomeMotorista))
      ))
      .sort((a, b) => a.prefixo.localeCompare(b.prefixo, 'pt-BR', { numeric: true }));

    const pendencias = [
      resumo.apontados === 0 && 'Equipe sem apontamento de presença no dia',
      resumo.apontados > 0 && resumo.apontados < resumo.efetivo && `${resumo.efetivo - resumo.apontados} colaborador(es) do efetivo sem apontamento`,
      !selecionada.frenteServico?.trim() && 'Equipe sem frente de serviço informada',
      membros.length === 0 && 'Equipe sem colaborador vinculado',
    ].filter((item): item is string => Boolean(item));

    return (
      <div id="equipe-ficha" className="min-h-full w-full bg-[#f7f8f6] px-4 pb-12 pt-6 sm:px-7 lg:px-9">
        <button
          type="button"
          onClick={() => setSelecionadoId(null)}
          className="mb-4 inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition-colors hover:border-emerald-500 hover:text-emerald-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar para equipes
        </button>

        <PageHeader
          title={selecionada.nome}
          description={[selecionada.responsavel && `Encarregado ${selecionada.responsavel}`, selecionada.frenteServico, resumo.obra].filter(Boolean).join(' · ')}
          actions={(
            <input
              type="date"
              value={dia}
              onChange={event => setDia(event.target.value || hoje)}
              aria-label="Dia da equipe"
              className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-emerald-500"
            />
          )}
        />

        <section className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {[
          { label: 'Efetivo', valor: resumo.efetivo, tone: 'info' as const, icone: HardHat },
          { label: 'Presentes', valor: resumo.presentes, tone: 'success' as const, icone: Users },
          { label: 'Ausentes', valor: resumo.ausentes, tone: 'danger' as const, icone: Users },
          { label: 'Frota do dia', valor: frota.length, tone: 'neutral' as const, icone: Truck },
        ].map(item => (
          <StatCard key={item.label} label={item.label} value={item.valor} tone={item.tone} icon={item.icone} />
        ))}
      </section>

        {pendencias.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {pendencias.map(item => (
              <li key={item} className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-900">{item}</li>
            ))}
          </ul>
        )}

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <Card
            className="min-w-0"
            title="Colaboradores"
            description={podeRealocar ? 'Realocar move o colaborador para outra equipe e registra nas duas.' : undefined}
            flush
          >
            {membros.length === 0 ? (
              <EmptyState icon={Users} title="Nenhum colaborador na equipe" compact />
            ) : (
              <ul className="divide-y divide-slate-100">
                {membros.map(membro => {
                  const apontamento = apontamentosDoDia.find(item => item.funcionarioId === membro.id);
                  return (
                    <li key={membro.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <strong className="block truncate text-sm font-bold text-slate-800">{membro.nome}</strong>
                        <span className="block truncate text-xs text-slate-500">{membro.cargo}{membro.matricula ? ` · ${membro.matricula}` : ''}</span>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${apontamento ? statusTone(apontamento.status) : 'bg-slate-100 text-slate-500'}`}>
                          {apontamento?.status || 'Sem apontamento'}
                        </span>
                        {podeRealocar && ativas.length > 1 && (
                          <select
                            value=""
                            onChange={event => event.target.value && setRealocacao({ funcionario: membro, destinoId: event.target.value })}
                            aria-label={`Realocar ${membro.nome}`}
                            className="min-h-9 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-bold text-slate-600 outline-none focus:border-emerald-500"
                          >
                            <option value="">Realocar…</option>
                            {ativas.filter(item => item.id !== selecionada.id).map(item => (
                              <option key={item.id} value={item.id}>{item.nome}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card
            className="min-w-0"
            title="Frota relacionada"
            description={frota.length ? `${frota.length} equipamento(s) com a equipe no dia` : undefined}
            actions={<button type="button" onClick={() => onNavigate('controle-equipamentos')} className="text-xs font-bold text-emerald-700 hover:text-emerald-800">Ver módulo</button>}
            flush
          >
            {frota.length === 0 ? (
              <EmptyState icon={Truck} title="Nenhum equipamento com a equipe no dia" compact />
            ) : (
              <ul className="divide-y divide-slate-100">
                {frota.map(item => (
                  <li key={item.id} className="flex items-center justify-between gap-3 px-5 py-3 text-xs">
                    <span className="min-w-0">
                      <strong className="block font-mono text-slate-900">{item.prefixo}</strong>
                      <span className="block truncate text-[10px] text-slate-400">{item.nomeMotorista || 'Sem motorista'}</span>
                    </span>
                    <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${statusTone(item.status)}`}>{item.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <ConfirmDialog
          open={Boolean(realocacao)}
          tone="warning"
          title={`Realocar ${realocacao?.funcionario.nome}?`}
          description={`Sai de ${selecionada.nome} e entra em ${ativas.find(item => item.id === realocacao?.destinoId)?.nome || 'outra equipe'}. As duas equipes ficam registradas no histórico do sistema.`}
          confirmLabel="Realocar"
          onCancel={() => setRealocacao(null)}
          onConfirm={realocar}
        />
      </div>
    );
  }

  return (
    <div id="equipes-tab" className="min-h-full w-full bg-[#f7f8f6] px-4 pb-12 pt-6 sm:px-7 lg:px-9">
      <PageHeader
        title="Equipes"
        description="Como cada equipe está no dia: efetivo, presença, frota e pendências."
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={dia}
              onChange={event => setDia(event.target.value || hoje)}
              aria-label="Dia das equipes"
              className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-emerald-500"
            />
            <button type="button" onClick={() => onNavigate('presenca')} className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition-colors hover:border-emerald-500 hover:text-emerald-700">Montar equipe</button>
          </div>
        )}
      />

      {ativas.length === 0 ? (
        <div className="mt-4 rounded-lg border border-slate-200 bg-white">
          <EmptyState icon={HardHat} title="Nenhuma equipe ativa" description="Monte a equipe na tela de Presença e Controle." />
        </div>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {ativas.map(grupo => {
            const resumo = resumoDaEquipe(grupo);
            return (
              <li key={grupo.id}>
                <button
                  type="button"
                  onClick={() => setSelecionadoId(grupo.id)}
                  className="group flex w-full flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <strong className="block truncate text-sm font-bold text-slate-900">{grupo.nome}</strong>
                      <span className="block truncate text-xs text-slate-500">{grupo.responsavel || 'Sem encarregado'}</span>
                    </div>
                    {grupo.frenteServico && <Badge tone="info">{grupo.frenteServico}</Badge>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="rounded-full bg-slate-100 px-2 py-1 font-bold text-slate-600">{resumo.efetivo} no efetivo</span>
                    {resumo.apontados === 0
                      ? <Badge tone="warning">Sem apontamento</Badge>
                      : <span className="rounded-full bg-emerald-50 px-2 py-1 font-bold text-emerald-700">{resumo.presentes} presente(s)</span>}
                    {resumo.ausentes > 0 && <span className="rounded-full bg-rose-50 px-2 py-1 font-bold text-rose-700">{resumo.ausentes} ausente(s)</span>}
                  </div>
                  {podeRealocar && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 transition-colors group-hover:text-emerald-700">
                      <ArrowRightLeft className="h-3 w-3" /> Abrir para realocar
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
