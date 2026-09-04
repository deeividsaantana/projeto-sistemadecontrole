/**
 * Frota: lista o cadastro de equipamentos e abre a ficha individual, reunindo
 * o que os outros módulos já registraram sobre aquele prefixo.
 */
import { useMemo, useState } from 'react';
import { ArrowLeft, Building2, ClipboardList, Droplets, Gauge, Search, Truck, UserRound, Wrench } from 'lucide-react';
import type {
  Abastecimento,
  ControleEquipamentoDiario,
  Empresa,
  Equipamento,
  Funcionario,
  GrupoEquipe,
  ObraLocal,
  OrdemServico,
  TicketJazida,
} from '../types';
import { buildEquipmentOperationalSummaries } from '../utils/equipmentOperations';
import { normalizeComparable } from '../utils/canonicalIdentity';
import { Badge, Card, EmptyState, PageHeader, statusTone } from '../shared/ui';

interface FrotaTabProps {
  equipamentos: Equipamento[];
  empresas: Empresa[];
  obras: ObraLocal[];
  funcionarios: Funcionario[];
  gruposEquipe: GrupoEquipe[];
  controlesEquipamentos: ControleEquipamentoDiario[];
  ordensServico: OrdemServico[];
  abastecimentos: Abastecimento[];
  ticketsJazida: TicketJazida[];
  onNavigate: (tab: string) => void;
}

const CATEGORIAS = ['Todas', 'Equipamento', 'Veículo', 'Implemento'] as const;
const OS_ENCERRADAS = ['Concluída', 'Cancelada'];

const formatarData = (valor?: string) => {
  if (!valor) return '—';
  const dia = valor.slice(0, 10);
  return dia.includes('-') ? dia.split('-').reverse().join('/') : valor;
};

const formatarMomento = (valor?: string) => {
  if (!valor) return '—';
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? valor : data.toLocaleString('pt-BR');
};

export default function FrotaTab({
  equipamentos,
  empresas,
  obras,
  funcionarios,
  gruposEquipe,
  controlesEquipamentos,
  ordensServico,
  abastecimentos,
  ticketsJazida,
  onNavigate,
}: FrotaTabProps) {
  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState<(typeof CATEGORIAS)[number]>('Todas');
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);

  const resumos = useMemo(
    () => new Map(buildEquipmentOperationalSummaries(equipamentos, ordensServico).map(item => [item.equipment.id, item])),
    [equipamentos, ordensServico],
  );

  // Último lançamento do controle diário por equipamento: é a situação real.
  const ultimoRegistro = useMemo(() => {
    const mapa = new Map<string, ControleEquipamentoDiario>();
    controlesEquipamentos.forEach(item => {
      [item.equipamentoId, item.prefixo].filter(Boolean).forEach(chave => {
        const atual = mapa.get(chave);
        if (!atual || `${item.data}${item.atualizadoEm}` >= `${atual.data}${atual.atualizadoEm}`) mapa.set(chave, item);
      });
    });
    return mapa;
  }, [controlesEquipamentos]);

  const lista = useMemo(() => {
    const termo = normalizeComparable(busca).trim();
    return equipamentos
      .filter(item => categoria === 'Todas' || (item.categoriaFrota || 'Equipamento') === categoria)
      .filter(item => !termo || normalizeComparable(`${item.prefixo} ${item.nome} ${item.placa || ''} ${item.seriePlaca} ${item.modelo} ${item.marca} ${item.codigoSge || ''}`).includes(termo))
      .sort((a, b) => a.prefixo.localeCompare(b.prefixo, 'pt-BR', { numeric: true }));
  }, [equipamentos, categoria, busca]);

  const selecionado = selecionadoId ? equipamentos.find(item => item.id === selecionadoId) : undefined;

  if (selecionado) {
    const registro = ultimoRegistro.get(selecionado.id) || ultimoRegistro.get(selecionado.prefixo);
    const resumo = resumos.get(selecionado.id);
    const empresa = empresas.find(item => item.id === selecionado.empresaId)?.nome;
    const local = obras.find(item => item.id === selecionado.localAtualId)?.nome;
    const motorista = registro?.nomeMotorista || selecionado.operadorResponsavelNome || '';

    // A frente vem pela equipe do motorista — é o vínculo que hoje existe.
    const funcionarioMotorista = funcionarios.find(item => normalizeComparable(item.nome) === normalizeComparable(motorista));
    const equipe = funcionarioMotorista
      ? gruposEquipe.find(grupo => grupo.funcionarioIds.includes(funcionarioMotorista.id))
      : undefined;

    const ordens = ordensServico
      .filter(item => item.equipamentoId === selecionado.id)
      .sort((a, b) => (b.dataAbertura || '').localeCompare(a.dataAbertura || ''));
    const ordensAbertas = ordens.filter(item => !OS_ENCERRADAS.includes(item.status));

    const combustivel = abastecimentos
      .filter(item => item.equipamentoId === selecionado.id
        || normalizeComparable(item.prefixoInformado || '') === normalizeComparable(selecionado.prefixo))
      .sort((a, b) => `${b.data}${b.hora || ''}`.localeCompare(`${a.data}${a.hora || ''}`));
    const litros = combustivel.reduce((total, item) => total + (Number(item.quantidadeLitros) || 0), 0);

    const viagens = ticketsJazida
      .filter(item => normalizeComparable(item.prefixo) === normalizeComparable(selecionado.prefixo))
      .sort((a, b) => `${b.data}${b.horaSaida || ''}`.localeCompare(`${a.data}${a.horaSaida || ''}`));

    const historico = controlesEquipamentos
      .filter(item => item.equipamentoId === selecionado.id || item.prefixo === selecionado.prefixo)
      .flatMap(item => (item.eventos || []).map(evento => ({ ...evento, data: item.data })))
      .sort((a, b) => (b.ocorridoEm || '').localeCompare(a.ocorridoEm || ''))
      .slice(0, 12);

    const indicadores = [
      { label: 'Situação atual', valor: registro?.status || selecionado.status, detalhe: registro ? `em ${formatarData(registro.data)}` : 'sem lançamento diário' },
      { label: 'Disponibilidade', valor: resumo?.availabilityPercent === null || resumo?.availabilityPercent === undefined ? 'Sem dados' : `${resumo.availabilityPercent.toFixed(1)}%`, detalhe: selecionado.metaDisponibilidade ? `meta ${selecionado.metaDisponibilidade}%` : 'sem meta definida' },
      { label: 'OS em aberto', valor: String(ordensAbertas.length), detalhe: `${ordens.length} no total` },
      { label: 'Abastecimentos', valor: String(combustivel.length), detalhe: litros ? `${litros.toLocaleString('pt-BR')} L` : 'sem litros registrados' },
    ];

    return (
      <div id="frota-ficha" className="min-h-full w-full bg-[#f7f8f6] px-4 pb-12 pt-6 sm:px-7 lg:px-9">
        <button
          type="button"
          onClick={() => setSelecionadoId(null)}
          className="mb-4 inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition-colors hover:border-emerald-500 hover:text-emerald-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar para a frota
        </button>

        <PageHeader
          title={`${selecionado.prefixo} · ${selecionado.nome}`}
          description={[selecionado.marca, selecionado.modelo, selecionado.placa || selecionado.seriePlaca].filter(Boolean).join(' · ')}
          actions={(
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="neutral">{selecionado.categoriaFrota || 'Equipamento'}</Badge>
              <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${statusTone(registro?.status || selecionado.status)}`}>
                {registro?.status || selecionado.status}
              </span>
            </div>
          )}
        />

        <section className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {indicadores.map(item => (
            <div key={item.label} className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{item.label}</p>
              <strong className="mt-1.5 block text-lg font-black leading-tight text-slate-900">{item.valor}</strong>
              <span className="text-[11px] text-slate-400">{item.detalhe}</span>
            </div>
          ))}
        </section>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <Card title="Identificação">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
              {[
                ['Prefixo', selecionado.prefixo],
                ['Tipo', selecionado.tipo || '—'],
                ['Família', selecionado.familia || '—'],
                ['Fabricante', selecionado.marca || '—'],
                ['Modelo', selecionado.modelo || '—'],
                ['Ano', selecionado.ano ? String(selecionado.ano) : '—'],
                ['Placa', selecionado.placa || '—'],
                ['Série', selecionado.seriePlaca || '—'],
                ['Código SGE', selecionado.codigoSge || '—'],
                ['Empresa', empresa || '—'],
                ['Local atual', local || '—'],
                ['Mobilização', formatarData(selecionado.dataMobilizacao)],
              ].map(([rotulo, valor]) => (
                <div key={rotulo} className="min-w-0">
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{rotulo}</dt>
                  <dd className="mt-0.5 break-words font-medium text-slate-800">{valor}</dd>
                </div>
              ))}
            </dl>
            {selecionado.observacao && (
              <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">{selecionado.observacao}</p>
            )}
          </Card>

          <Card title="Operação atual">
            {registro ? (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                {[
                  ['Dia do lançamento', formatarData(registro.data)],
                  ['Motorista', registro.nomeMotorista || '—'],
                  ['Frente de serviço', equipe?.frenteServico || '—'],
                  ['Equipe', equipe?.nome || '—'],
                  ['Saída', registro.horaSaida || '—'],
                  ['Entrada manutenção', registro.horaEntradaManutencao || '—'],
                  ['Liberação', registro.horaLiberacao || '—'],
                  ['Atualizado em', formatarMomento(registro.atualizadoEm)],
                ].map(([rotulo, valor]) => (
                  <div key={rotulo} className="min-w-0">
                    <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{rotulo}</dt>
                    <dd className="mt-0.5 break-words font-medium text-slate-800">{valor}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <EmptyState icon={Truck} title="Sem lançamento no controle diário" description="A situação atual aparece aqui assim que a operação registrar o dia deste equipamento." compact />
            )}
            {registro?.motivoManutencao && (
              <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">{registro.motivoManutencao}</p>
            )}
          </Card>

          <Card title="Manutenção" description={ordens.length ? `${ordensAbertas.length} em aberto de ${ordens.length}` : undefined} flush>
            {ordens.length === 0 ? (
              <EmptyState icon={Wrench} title="Nenhuma ordem de serviço" compact />
            ) : (
              <ul className="divide-y divide-slate-100">
                {ordens.slice(0, 8).map(ordem => (
                  <li key={ordem.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <strong className="font-mono text-xs font-black text-slate-900">{ordem.numero}</strong>
                      <p className="truncate text-xs text-slate-500">{ordem.descricao || ordem.motivo || 'Sem descrição'}</p>
                      <span className="text-[10px] text-slate-400">Abertura {formatarData(ordem.dataAbertura)}</span>
                    </div>
                    <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${statusTone(ordem.status)}`}>{ordem.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Histórico de status" description="Eventos gravados a cada mudança no controle diário." flush>
            {historico.length === 0 ? (
              <EmptyState icon={ClipboardList} title="Sem eventos registrados" compact />
            ) : (
              <ul className="divide-y divide-slate-100">
                {historico.map(evento => (
                  <li key={evento.id} className="px-5 py-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono text-[11px] text-slate-500">{formatarMomento(evento.ocorridoEm)}</span>
                      {evento.statusAnterior && <span className="text-slate-400">{evento.statusAnterior} →</span>}
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${statusTone(evento.statusNovo)}`}>{evento.statusNovo}</span>
                    </div>
                    {(evento.observacao || evento.motivo) && (
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{evento.observacao || evento.motivo}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card
            title="Abastecimentos"
            description={combustivel.length ? `${litros.toLocaleString('pt-BR')} L em ${combustivel.length} registro(s)` : undefined}
            actions={<button type="button" onClick={() => onNavigate('lancamentos')} className="text-xs font-bold text-emerald-700 hover:text-emerald-800">Ver módulo</button>}
            flush
          >
            {combustivel.length === 0 ? (
              <EmptyState icon={Droplets} title="Nenhum abastecimento registrado" compact />
            ) : (
              <ul className="divide-y divide-slate-100">
                {combustivel.slice(0, 6).map(item => (
                  <li key={item.id} className="flex items-center justify-between gap-3 px-5 py-3 text-xs">
                    <span className="text-slate-600">{formatarData(item.data)}{item.hora ? ` · ${item.hora}` : ''}</span>
                    <strong className="font-mono text-slate-900">{Number(item.quantidadeLitros || 0).toLocaleString('pt-BR')} L</strong>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card
            title="Viagens"
            description={viagens.length ? `${viagens.length} viagem(ns) registrada(s)` : undefined}
            actions={<button type="button" onClick={() => onNavigate('tickets-jazida')} className="text-xs font-bold text-emerald-700 hover:text-emerald-800">Ver módulo</button>}
            flush
          >
            {viagens.length === 0 ? (
              <EmptyState icon={Truck} title="Nenhuma viagem registrada" compact />
            ) : (
              <ul className="divide-y divide-slate-100">
                {viagens.slice(0, 6).map(item => (
                  <li key={item.id} className="flex items-center justify-between gap-3 px-5 py-3 text-xs">
                    <div className="min-w-0">
                      <strong className="font-mono text-slate-900">{item.ticketNumero || 'sem número'}</strong>
                      <p className="truncate text-slate-500">{item.tipoMaterial} · {item.destinoObra}</p>
                    </div>
                    <span className="shrink-0 text-slate-600">{formatarData(item.data)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div id="frota-tab" className="min-h-full w-full bg-[#f7f8f6] px-4 pb-12 pt-6 sm:px-7 lg:px-9">
      <PageHeader
        title="Frota"
        description="Cadastro de equipamentos, veículos e implementos. Abra um prefixo para ver a ficha completa."
        actions={<button type="button" onClick={() => onNavigate('cadastros')} className="inline-flex min-h-10 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition-colors hover:border-emerald-500 hover:text-emerald-700">Cadastrar equipamento</button>}
      />

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Buscar frota</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={busca}
            onChange={event => setBusca(event.target.value)}
            placeholder="Prefixo, nome, placa, série, modelo ou SGE"
            className="min-h-11 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-emerald-500"
          />
        </label>
        <select
          value={categoria}
          onChange={event => setCategoria(event.target.value as (typeof CATEGORIAS)[number])}
          aria-label="Categoria da frota"
          className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500"
        >
          {CATEGORIAS.map(item => <option key={item}>{item}</option>)}
        </select>
      </div>

      <p className="mt-3 text-xs font-medium text-slate-500">{lista.length} item(ns) na frota</p>

      {lista.length === 0 ? (
        <div className="mt-4 rounded-lg border border-slate-200 bg-white">
          <EmptyState icon={Truck} title="Nenhum equipamento encontrado" description="Ajuste a busca ou cadastre um novo item da frota." />
        </div>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {lista.map(item => {
            const registro = ultimoRegistro.get(item.id) || ultimoRegistro.get(item.prefixo);
            const resumo = resumos.get(item.id);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setSelecionadoId(item.id)}
                  className="group flex w-full flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <strong className="block font-mono text-sm font-black text-slate-900">{item.prefixo}</strong>
                      <span className="block truncate text-xs text-slate-500">{item.nome}</span>
                    </div>
                    <Badge tone="neutral">{item.categoriaFrota || 'Equipamento'}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${statusTone(registro?.status || item.status)}`}>
                      {registro?.status || item.status}
                    </span>
                    {(resumo?.openWorkOrders ?? 0) > 0 && <Badge tone="warning">{resumo?.openWorkOrders} OS</Badge>}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1"><UserRound className="h-3 w-3" />{registro?.nomeMotorista || item.operadorResponsavelNome || 'Sem motorista'}</span>
                    <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" />{empresas.find(empresa => empresa.id === item.empresaId)?.nome || 'Sem empresa'}</span>
                    {resumo?.availabilityPercent !== null && resumo?.availabilityPercent !== undefined && (
                      <span className="inline-flex items-center gap-1"><Gauge className="h-3 w-3" />{resumo.availabilityPercent.toFixed(0)}%</span>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
