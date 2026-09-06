/**
 * Central Operacional: o retrato do dia em uma tela só. Lê os registros que a
 * operação já preenche e permite corrigir o status da frota sem sair daqui.
 */
import { useMemo, useState } from 'react';
import { Activity, AlertTriangle, ChevronRight, ClipboardList, MapPin, Truck, Users, Wrench } from 'lucide-react';
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
import type { FleetPersistedRecord } from '../fleet/domain';
import { isOrdemEncerrada } from '../utils/manutencao';
import {
  Badge,
  Card,
  CompactMetric,
  DataTable,
  EmptyState,
  PageHeader,
  isoDay,
  statusTone,
} from '../shared/ui';

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
  /** Quem está informando: fica gravado no histórico do registro. */
  responsavel: string;
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
  responsavel,
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
      .filter(item => !isOrdemEncerrada(item.status))
      .sort((a, b) => (b.dataAbertura || '').localeCompare(a.dataAbertura || ''))
      .slice(0, 8),
    [ordensServico],
  );

  const viagensDoDia = useMemo(() => ticketsJazida.filter(item => item.data === dia), [ticketsJazida, dia]);

  const operando = frota.informados.filter(item => item.status === 'Em operação');
  const emManutencao = frota.informados.filter(item => ['Em manutenção', 'Aguardando manutenção'].includes(item.status));
  const aConfirmar = frota.informados.filter(item => ['A confirmar', 'Aguardando motorista', 'Aguardando equipamento'].includes(item.status));
  const aDisposicao = frota.informados.filter(item => ['Disponível', 'Reserva'].includes(item.status));
  const disponibilidade = frota.informados.length
    ? Math.round((operando.length / frota.informados.length) * 100)
    : 0;

  /**
   * Painel de posição por frente. O sistema não guarda coordenada de GPS, então
   * a posição mostrada é a frente de serviço informada no lançamento — que é o
   * que a operação de fato registra. Inventar latitude e longitude seria criar
   * um dado que ninguém preencheu.
   */
  const posicaoPorFrente = useMemo(() => {
    const mapa = new Map<string, { operando: number; manutencao: number; confirmar: number; disposicao: number }>();
    frota.informados.forEach(item => {
      const frente = (item as FleetPersistedRecord).frenteServico?.trim() || 'Sem frente informada';
      const atual = mapa.get(frente) || { operando: 0, manutencao: 0, confirmar: 0, disposicao: 0 };
      if (item.status === 'Em operação') atual.operando += 1;
      else if (['Em manutenção', 'Aguardando manutenção'].includes(item.status)) atual.manutencao += 1;
      else if (['Disponível', 'Reserva'].includes(item.status)) atual.disposicao += 1;
      else atual.confirmar += 1;
      mapa.set(frente, atual);
    });
    return [...mapa.entries()]
      .map(([nome, dados]) => ({ nome, ...dados, total: dados.operando + dados.manutencao + dados.confirmar + dados.disposicao }))
      .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [frota.informados]);

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
          responsavel,
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

      <section className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CompactMetric label="Equipamentos" valor={frota.informados.length} contexto={`de ${equipamentos.length} cadastrados`} icone={Truck} estado="operacao" />
        <CompactMetric label="Frentes" valor={posicaoPorFrente.length} contexto="com equipamento no dia" icone={MapPin} estado="confirmar" />
        <CompactMetric label="Equipes" valor={equipes.filter(item => item.total > 0).length} contexto={`de ${equipes.length} ativas`} icone={Users} estado="neutro" />
        <CompactMetric label="Disponibilidade" valor={`${disponibilidade}%`} contexto={`${operando.length} em operação`} icone={Activity} estado="operacao" />
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <article className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
            <h2 className="text-[13px] font-semibold text-slate-800">Posição da frota por frente</h2>
            <span className="text-[11px] text-slate-400">Posição informada no lançamento, não GPS</span>
          </header>
          {posicaoPorFrente.length === 0 ? (
            <EmptyState icon={MapPin} title="Nenhum equipamento posicionado" description="A frente aparece assim que o controle diário for lançado." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {posicaoPorFrente.map(frente => (
                <li key={frente.nome} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-[13px] font-semibold text-slate-800">{frente.nome}</span>
                    <span className="shrink-0 text-[12px] tabular-nums text-slate-500">{frente.total} equipamento(s)</span>
                  </div>
                  <div className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    {frente.operando > 0 && <span style={{ width: `${(frente.operando / frente.total) * 100}%`, backgroundColor: '#087353' }} title={`Em operação: ${frente.operando}`} />}
                    {frente.manutencao > 0 && <span style={{ width: `${(frente.manutencao / frente.total) * 100}%`, backgroundColor: '#d97706' }} title={`Manutenção: ${frente.manutencao}`} />}
                    {frente.confirmar > 0 && <span style={{ width: `${(frente.confirmar / frente.total) * 100}%`, backgroundColor: '#0284c7' }} title={`A confirmar: ${frente.confirmar}`} />}
                    {frente.disposicao > 0 && <span style={{ width: `${(frente.disposicao / frente.total) * 100}%`, backgroundColor: '#94a3b8' }} title={`À disposição: ${frente.disposicao}`} />}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <footer className="flex flex-wrap gap-3 border-t border-slate-100 px-4 py-3 text-[11px] text-slate-500">
            {[['#087353', 'Em operação'], ['#d97706', 'Manutenção'], ['#0284c7', 'A confirmar'], ['#94a3b8', 'À disposição']].map(([cor, rotulo]) => (
              <span key={rotulo} className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ backgroundColor: cor }} /> {rotulo}
              </span>
            ))}
          </footer>
        </article>

        <article className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <h2 className="text-[13px] font-semibold text-slate-800">Equipamentos em operação</h2>
            <button type="button" onClick={() => onNavigate('controle-equipamentos')} className="text-[12px] font-semibold text-[#087353] hover:text-[#065f3c]">Ver todos</button>
          </header>
          <DataTable
            larguraMinima={560}
            itens={operando}
            chaveDe={item => item.id}
            vazio={<EmptyState icon={Truck} title="Nenhum equipamento em operação" description="Os lançamentos aparecem aqui assim que a operação registrar." />}
            colunas={[
              { chave: 'prefixo', titulo: 'Prefixo', render: item => <span className="font-semibold text-slate-800">{item.prefixo}</span> },
              { chave: 'local', titulo: 'Local', render: item => (item as FleetPersistedRecord).frenteServico || '—' },
              { chave: 'equipe', titulo: 'Equipe', render: item => item.nomeMotorista || '—', ocultarNoCelular: true },
              { chave: 'atualizacao', titulo: 'Última atualização', render: item => <span className="tabular-nums text-slate-500">{item.horaSaida || (item.atualizadoEm || '').slice(11, 16) || '—'}</span>, ocultarNoCelular: true },
            ]}
            acoes={[{ rotulo: 'Abrir controle diário', onSelect: () => onNavigate('controle-equipamentos') }]}
          />
        </article>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <Card
          className="min-w-0"
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
                      {(registro as FleetPersistedRecord).frenteServico ? ` · ${(registro as FleetPersistedRecord).frenteServico}` : ''}
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

        <div className="flex min-w-0 flex-col gap-4">
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
