/**
 * Central Operacional: o retrato do dia em uma tela só. Lê os registros que a
 * operação já preenche e permite corrigir o status da frota sem sair daqui.
 */
import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronRight, ClipboardList, MapPin, Truck, Users, Wrench } from 'lucide-react';
import type {
  ControleEquipamentoDiario,
  Equipamento,
  GrupoEquipe,
  ObraLocal,
  OrdemServico,
  PresencaApontamento,
  StatusControleEquipamentoDiario,
  TicketJazida,
} from '../types';
import { Badge, Card, EmptyState, PageHeader, isoDay, statusTone } from '../shared/ui';

interface CentralOperacionalTabProps {
  equipamentos: Equipamento[];
  controlesEquipamentos: ControleEquipamentoDiario[];
  gruposEquipe: GrupoEquipe[];
  presencasLink: PresencaApontamento[];
  ordensServico: OrdemServico[];
  ticketsJazida: TicketJazida[];
  obras: ObraLocal[];
  /** Somente perfis operacionais alteram status daqui. */
  podeAtualizar: boolean;
  onSaveControleEquipamento: (registro: ControleEquipamentoDiario, isNew: boolean) => void;
  onNavigate: (tab: string) => void;
}

/** Status oferecidos na troca rápida. A tela completa cobre o resto do fluxo. */
const STATUS_RAPIDOS: StatusControleEquipamentoDiario[] = [
  'Em operação',
  'Em manutenção',
  'Aguardando manutenção',
  'Disponível',
  'A confirmar',
];

const OS_ENCERRADAS = ['Concluída', 'Cancelada'];

const formatarData = (dia: string) => dia.split('-').reverse().join('/');

export default function CentralOperacionalTab({
  equipamentos,
  controlesEquipamentos,
  gruposEquipe,
  presencasLink,
  ordensServico,
  ticketsJazida,
  obras,
  podeAtualizar,
  onSaveControleEquipamento,
  onNavigate,
}: CentralOperacionalTabProps) {
  const hoje = isoDay(new Date());
  const [dia, setDia] = useState(hoje);
  const [salvando, setSalvando] = useState<string | null>(null);

  const registrosDoDia = useMemo(
    () => controlesEquipamentos.filter(item => item.data === dia),
    [controlesEquipamentos, dia],
  );

  // Um equipamento pode ter mais de um lançamento no dia: vale o mais recente.
  const frota = useMemo(() => {
    const porEquipamento = new Map<string, ControleEquipamentoDiario>();
    registrosDoDia.forEach(item => {
      const chave = item.equipamentoId || item.prefixo;
      const atual = porEquipamento.get(chave);
      if (!atual || (item.atualizadoEm || '') >= (atual.atualizadoEm || '')) porEquipamento.set(chave, item);
    });
    const informados = Array.from(porEquipamento.values())
      .sort((a, b) => a.prefixo.localeCompare(b.prefixo, 'pt-BR', { numeric: true }));
    const chavesInformadas = new Set(informados.flatMap(item => [item.equipamentoId, item.prefixo].filter(Boolean)));
    const semInformacao = equipamentos
      .filter(item => item.status !== 'Desmobilizado' && !chavesInformadas.has(item.id) && !chavesInformadas.has(item.prefixo))
      .sort((a, b) => a.prefixo.localeCompare(b.prefixo, 'pt-BR', { numeric: true }));
    return { informados, semInformacao };
  }, [registrosDoDia, equipamentos]);

  const presencasDoDia = useMemo(
    () => presencasLink.filter(item => item.data === dia),
    [presencasLink, dia],
  );

  const equipes = useMemo(() => gruposEquipe
    .filter(grupo => grupo.status !== 'inativo')
    .map(grupo => {
      const apontamentos = presencasDoDia.filter(item => item.grupoId === grupo.id);
      return {
        grupo,
        total: apontamentos.length,
        presentes: apontamentos.filter(item => item.status === 'Presente').length,
        ausentes: apontamentos.filter(item => item.status === 'Ausente').length,
        obra: obras.find(obra => obra.id === grupo.obraId)?.nome,
      };
    })
    .sort((a, b) => Number(a.total > 0) - Number(b.total > 0) || a.grupo.nome.localeCompare(b.grupo.nome, 'pt-BR')),
  [gruposEquipe, presencasDoDia, obras]);

  // Frentes ainda vêm do campo de texto que equipes e apontamentos já usam.
  // A entidade própria de Frente de Serviço entra em versão posterior.
  const frentes = useMemo(() => {
    const mapa = new Map<string, { equipes: Set<string>; pessoas: number; presentes: number }>();
    equipes.forEach(item => {
      const nome = item.grupo.frenteServico?.trim() || 'Sem frente informada';
      const atual = mapa.get(nome) || { equipes: new Set<string>(), pessoas: 0, presentes: 0 };
      atual.equipes.add(item.grupo.id);
      atual.pessoas += item.total;
      atual.presentes += item.presentes;
      mapa.set(nome, atual);
    });
    return Array.from(mapa.entries())
      .map(([nome, dados]) => ({ nome, equipes: dados.equipes.size, pessoas: dados.pessoas, presentes: dados.presentes }))
      .sort((a, b) => b.presentes - a.presentes || a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [equipes]);

  const manutencao = useMemo(
    () => ordensServico
      .filter(item => !OS_ENCERRADAS.includes(item.status))
      .sort((a, b) => (b.dataAbertura || '').localeCompare(a.dataAbertura || ''))
      .slice(0, 8),
    [ordensServico],
  );

  const viagensDoDia = useMemo(() => ticketsJazida.filter(item => item.data === dia), [ticketsJazida, dia]);

  const resumo = [
    { label: 'Em operação', valor: frota.informados.filter(item => item.status === 'Em operação').length, tone: 'success' as const, icon: Truck },
    { label: 'Em manutenção', valor: frota.informados.filter(item => ['Em manutenção', 'Aguardando manutenção'].includes(item.status)).length, tone: 'warning' as const, icon: Wrench },
    { label: 'Sem informação', valor: frota.semInformacao.length, tone: 'danger' as const, icon: AlertTriangle },
    { label: 'Presentes', valor: presencasDoDia.filter(item => item.status === 'Presente').length, tone: 'success' as const, icon: Users },
    { label: 'Viagens', valor: viagensDoDia.length, tone: 'info' as const, icon: ClipboardList },
  ];

  const alterarStatus = (registro: ControleEquipamentoDiario, status: StatusControleEquipamentoDiario) => {
    if (!podeAtualizar || status === registro.status) return;
    const agora = new Date().toISOString();
    setSalvando(registro.id);
    // Mesma regra da tela completa: o status anterior fica registrado no evento.
    onSaveControleEquipamento({
      ...registro,
      status,
      atualizadoEm: agora,
      eventos: [
        ...(registro.eventos || []),
        {
          id: `evt-central-${Date.now()}-${registro.id}`,
          ocorridoEm: agora,
          tipo: 'ALTERACAO_STATUS',
          statusAnterior: registro.status,
          statusNovo: status,
          observacao: 'Alteração rápida pela Central Operacional.',
        },
      ],
    }, false);
    setSalvando(null);
  };

  return (
    <div id="central-operacional-tab" className="min-h-full w-full bg-[#f7f8f6] px-4 pb-12 pt-6 sm:px-7 lg:px-9">
      <PageHeader
        title="Central Operacional"
        description="O dia da obra em uma tela: frota, equipes, frentes e manutenção."
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setDia(hoje)}
              className={`min-h-10 rounded-lg border px-3 text-xs font-bold transition-colors ${dia === hoje ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-500'}`}
            >
              Hoje
            </button>
            <input
              type="date"
              value={dia}
              onChange={event => setDia(event.target.value || hoje)}
              aria-label="Dia da operação"
              className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-emerald-500"
            />
          </div>
        )}
      />

      <section className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        {resumo.map(item => (
          <div key={item.label} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex items-center gap-2 text-slate-500">
              <item.icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="min-w-0 text-[10px] font-bold uppercase leading-tight tracking-wide">{item.label}</span>
            </div>
            <strong className={`mt-1.5 block text-2xl font-black tabular-nums ${item.tone === 'danger' && item.valor > 0 ? 'text-rose-700' : 'text-slate-900'}`}>
              {item.valor}
            </strong>
          </div>
        ))}
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <Card
          title={`Frota do dia · ${formatarData(dia)}`}
          description={podeAtualizar ? 'Troque o status direto na lista; o anterior fica no histórico.' : 'Somente leitura para o seu perfil.'}
          actions={<button type="button" onClick={() => onNavigate('controle-equipamentos')} className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800">Tela completa <ChevronRight size={14} /></button>}
          flush
        >
          {frota.informados.length === 0 ? (
            <EmptyState icon={Truck} title="Nenhum equipamento informado neste dia" description="Os lançamentos aparecem aqui assim que a operação registrar o controle diário." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {frota.informados.map(registro => (
                <li key={registro.id} className="flex flex-col gap-2 px-5 py-3 transition-colors hover:bg-slate-50/70 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <strong className="font-mono text-sm font-black text-slate-900">{registro.prefixo}</strong>
                      <Badge tone="neutral">{registro.familia || registro.tipoEquipamento || 'Equipamento'}</Badge>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {registro.nomeMotorista || 'Sem motorista informado'}
                      {registro.motivoManutencao ? ` · ${registro.motivoManutencao}` : ''}
                    </p>
                  </div>
                  <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">
                    <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${statusTone(registro.status)}`}>{registro.status}</span>
                    {podeAtualizar && (
                      <select
                        value={registro.status}
                        disabled={salvando === registro.id}
                        onChange={event => alterarStatus(registro, event.target.value as StatusControleEquipamentoDiario)}
                        aria-label={`Alterar status de ${registro.prefixo}`}
                        className="min-h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 outline-none focus:border-emerald-500 disabled:opacity-50 sm:flex-none"
                      >
                        {[...new Set([registro.status, ...STATUS_RAPIDOS])].map(status => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {frota.semInformacao.length > 0 && (
            <div className="border-t border-slate-100 bg-amber-50/60 px-5 py-3">
              <p className="text-xs font-bold text-amber-800">{frota.semInformacao.length} equipamento(s) ainda sem informação no dia</p>
              <p className="mt-1 text-[11px] leading-relaxed text-amber-700">
                {frota.semInformacao.slice(0, 8).map(item => item.prefixo).join(', ')}
                {frota.semInformacao.length > 8 ? '…' : ''}
              </p>
              <button
                type="button"
                onClick={() => onNavigate('controle-equipamentos')}
                className="mt-2 inline-flex min-h-9 items-center gap-1 rounded-lg border border-amber-300 bg-white px-3 text-xs font-bold text-amber-800 hover:border-amber-500"
              >
                Lançar controle do dia <ChevronRight size={14} />
              </button>
            </div>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          <Card
            title="Equipes do dia"
            actions={<button type="button" onClick={() => onNavigate('presenca')} className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800">Presença <ChevronRight size={14} /></button>}
            flush
          >
            {equipes.length === 0 ? (
              <EmptyState icon={Users} title="Nenhuma equipe ativa cadastrada" compact />
            ) : (
              <ul className="divide-y divide-slate-100">
                {equipes.map(item => (
                  <li key={item.grupo.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <strong className="block truncate text-sm font-bold text-slate-800">{item.grupo.nome}</strong>
                      <p className="truncate text-xs text-slate-500">
                        {item.grupo.responsavel || 'Sem encarregado'}
                        {item.obra ? ` · ${item.obra}` : ''}
                      </p>
                    </div>
                    {item.total === 0 ? (
                      <Badge tone="warning">Sem apontamento</Badge>
                    ) : (
                      <span className="shrink-0 text-right">
                        <strong className="block text-sm font-black tabular-nums text-emerald-700">{item.presentes}</strong>
                        <span className="text-[10px] font-bold uppercase text-slate-400">de {item.total}</span>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Frentes de serviço" flush>
            {frentes.length === 0 ? (
              <EmptyState icon={MapPin} title="Nenhuma frente informada" compact />
            ) : (
              <ul className="divide-y divide-slate-100">
                {frentes.map(frente => (
                  <li key={frente.nome} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <strong className="block truncate text-sm font-bold text-slate-800">{frente.nome}</strong>
                      <p className="text-xs text-slate-500">{frente.equipes} equipe(s)</p>
                    </div>
                    <span className="shrink-0 text-right">
                      <strong className="block text-sm font-black tabular-nums text-slate-900">{frente.presentes}</strong>
                      <span className="text-[10px] font-bold uppercase text-slate-400">presentes</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <Card
        className="mt-4"
        title="Manutenção em aberto"
        description={manutencao.length ? undefined : 'Nenhuma ordem de serviço aberta no momento.'}
        actions={<button type="button" onClick={() => onNavigate('controle-equipamentos')} className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800">Ver frota <ChevronRight size={14} /></button>}
        flush
      >
        {manutencao.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {manutencao.map(ordem => {
              const equipamento = equipamentos.find(item => item.id === ordem.equipamentoId);
              return (
                <li key={ordem.id} className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="font-mono text-sm font-black text-slate-900">{ordem.numero}</strong>
                      <span className="text-xs font-bold text-slate-600">{equipamento?.prefixo || 'Frota não localizada'}</span>
                    </div>
                    <p className="truncate text-xs text-slate-500">{ordem.descricao || ordem.motivo || 'Sem descrição'}</p>
                  </div>
                  <span className={`inline-flex shrink-0 self-start rounded-full px-2.5 py-1 text-[10px] font-bold sm:self-auto ${statusTone(ordem.status)}`}>{ordem.status}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
