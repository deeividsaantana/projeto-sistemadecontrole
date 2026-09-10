/**
 * Colaboradores: o efetivo e a ficha individual, reunindo o que os módulos já
 * registraram sobre a pessoa — equipe, presença, frota operada e viagens.
 */
import { useMemo, useState } from 'react';
import { ArrowLeft, Building2, ClipboardCheck, Search, Truck, UserRound, UserCog, Users } from 'lucide-react';
import type {
  ChecklistEquipamento,
  ControleEquipamentoDiario,
  Empresa,
  Funcionario,
  GrupoEquipe,
  PresencaApontamento,
  TicketJazida,
} from '../types';
import { normalizeComparable } from '../utils/canonicalIdentity';
import { Badge, Card, EmptyState, Modal, PageHeader, TextInput, statusTone } from '../shared/ui';
import {
  SITUACOES_COLABORADOR,
  aplicarSituacao,
  descreverMudanca,
  situacaoAtualDe,
  type SituacaoColaborador,
} from '../utils/situacaoColaborador';

interface ColaboradoresTabProps {
  funcionarios: Funcionario[];
  empresas: Empresa[];
  gruposEquipe: GrupoEquipe[];
  presencasLink: PresencaApontamento[];
  controlesEquipamentos: ControleEquipamentoDiario[];
  ticketsJazida: TicketJazida[];
  checklists?: ChecklistEquipamento[];
  onNavigate: (tab: string) => void;
  /** Ausente quando o perfil não pode mexer no cadastro: a ação nem aparece. */
  onAlterarSituacao?: (proximo: Funcionario, descricao: string) => void;
  responsavel?: string;
}

const SITUACOES = ['Todas', 'ATIVO', 'INATIVO', 'FÉRIAS', 'AFASTADO', 'DESMOBILIZADO'] as const;

const formatarData = (valor?: string) => (valor ? valor.slice(0, 10).split('-').reverse().join('/') : '—');

export default function ColaboradoresTab({
  funcionarios,
  empresas,
  gruposEquipe,
  presencasLink,
  controlesEquipamentos,
  ticketsJazida,
  checklists = [],
  onNavigate,
  onAlterarSituacao,
  responsavel = '',
}: ColaboradoresTabProps) {
  const [busca, setBusca] = useState('');
  const [situacao, setSituacao] = useState<(typeof SITUACOES)[number]>('Todas');
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  // Mudança de situação: sempre com data e motivo, porque é registro de RH.
  const [mudanca, setMudanca] = useState<{ situacao: SituacaoColaborador; data: string; motivo: string } | null>(null);

  const equipePorFuncionario = useMemo(() => {
    const mapa = new Map<string, GrupoEquipe>();
    gruposEquipe.forEach(grupo => grupo.funcionarioIds.forEach(id => mapa.set(id, grupo)));
    return mapa;
  }, [gruposEquipe]);

  const lista = useMemo(() => {
    const termo = normalizeComparable(busca).trim();
    return funcionarios
      .filter(item => situacao === 'Todas' || (item.status || (item.ativo ? 'ATIVO' : 'INATIVO')) === situacao)
      .filter(item => !termo || normalizeComparable(`${item.nome} ${item.matricula || ''} ${item.cargo} ${item.area || ''} ${item.liderNome || ''}`).includes(termo))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [funcionarios, situacao, busca]);

  const selecionado = selecionadoId ? funcionarios.find(item => item.id === selecionadoId) : undefined;

  if (selecionado) {
    const situacaoAtual = selecionado.status || (selecionado.ativo ? 'ATIVO' : 'INATIVO');
    const empresa = empresas.find(item => item.id === selecionado.empresaId)?.nome;
    const equipe = equipePorFuncionario.get(selecionado.id);
    const nomeNormalizado = normalizeComparable(selecionado.nome);

    const presencas = presencasLink
      .filter(item => item.funcionarioId === selecionado.id)
      .sort((a, b) => `${b.data}${b.horaEnvio}`.localeCompare(`${a.data}${a.horaEnvio}`));
    const presentes = presencas.filter(item => item.status === 'Presente').length;

    // O controle diário guarda o nome do motorista, então a ligação é pelo nome
    // quando o vínculo por id não foi preenchido no lançamento.
    const operacoes = controlesEquipamentos
      .filter(item => item.funcionarioId === selecionado.id || normalizeComparable(item.nomeMotorista) === nomeNormalizado)
      .sort((a, b) => b.data.localeCompare(a.data));

    const viagens = ticketsJazida
      .filter(item => normalizeComparable(item.motoristaNome || '') === nomeNormalizado)
      .sort((a, b) => b.data.localeCompare(a.data));

    const inspecoes = checklists
      .filter(item => normalizeComparable(item.responsavel) === nomeNormalizado)
      .sort((a, b) => `${b.data}${b.hora}`.localeCompare(`${a.data}${a.hora}`));

    const indicadores = [
      { label: 'Situação', valor: situacaoAtual, detalhe: selecionado.situacaoRh || 'sem detalhe do RH' },
      { label: 'Presenças', valor: String(presentes), detalhe: `${presencas.length} apontamento(s)` },
      { label: 'Dias operando', valor: String(operacoes.length), detalhe: operacoes[0] ? `último em ${formatarData(operacoes[0].data)}` : 'sem lançamento' },
      { label: 'Viagens', valor: String(viagens.length), detalhe: inspecoes.length ? `${inspecoes.length} checklist(s)` : 'sem checklist' },
    ];

    return (
      <div id="colaborador-ficha" className="min-h-full w-full bg-[#f7f8f6] px-4 pb-12 pt-6 sm:px-7 lg:px-9">
        <button
          type="button"
          onClick={() => setSelecionadoId(null)}
          className="mb-4 inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition-colors hover:border-emerald-500 hover:text-emerald-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar para colaboradores
        </button>

        <PageHeader
          title={selecionado.nome}
          description={[selecionado.matricula && `Matrícula ${selecionado.matricula}`, selecionado.cargo, empresa].filter(Boolean).join(' · ')}
          actions={(
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${statusTone(situacaoAtual)}`}>{situacaoAtual}</span>
              {onAlterarSituacao && (
                <button
                  type="button"
                  onClick={() => setMudanca({
                    situacao: situacaoAtual === 'ATIVO' ? 'FÉRIAS' : 'ATIVO',
                    data: new Date().toISOString().slice(0, 10),
                    motivo: '',
                  })}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition-colors hover:border-emerald-500 hover:text-emerald-700"
                >
                  <UserCog className="h-4 w-4" /> Alterar situação
                </button>
              )}
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
          <Card className="min-w-0" title="Identificação">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
              {[
                ['Matrícula', selecionado.matricula || '—'],
                ['Função', selecionado.cargo || '—'],
                ['Encarregado', selecionado.liderNome || '—'],
                ['Equipe', equipe?.nome || '—'],
                ['Frente', equipe?.frenteServico || '—'],
                ['Empresa', empresa || '—'],
                ['Área', selecionado.area || '—'],
                ['Telefone', selecionado.telefone || '—'],
                ['Mobilização', formatarData(selecionado.dataMobilizacao)],
                ['Desmobilização', formatarData(selecionado.dataDesmobilizacao)],
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

          <Card
            className="min-w-0"
            title="Presença"
            description={presencas.length ? `${presentes} presente(s) de ${presencas.length}` : undefined}
            actions={<button type="button" onClick={() => onNavigate('presenca')} className="text-xs font-bold text-emerald-700 hover:text-emerald-800">Ver módulo</button>}
            flush
          >
            {presencas.length === 0 ? (
              <EmptyState icon={Users} title="Sem apontamentos de presença" compact />
            ) : (
              <ul className="divide-y divide-slate-100">
                {presencas.slice(0, 8).map(item => (
                  <li key={item.id} className="flex items-center justify-between gap-3 px-5 py-3 text-xs">
                    <span className="min-w-0">
                      <span className="block text-slate-600">{formatarData(item.data)} · {item.horaEnvio}</span>
                      <span className="block truncate text-[10px] text-slate-400">{item.grupoNome}{item.frenteServico ? ` · ${item.frenteServico}` : ''}</span>
                    </span>
                    <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${statusTone(item.status)}`}>{item.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card
            className="min-w-0"
            title="Frota operada"
            description={operacoes.length ? `${operacoes.length} dia(s) com lançamento` : undefined}
            actions={<button type="button" onClick={() => onNavigate('controle-equipamentos')} className="text-xs font-bold text-emerald-700 hover:text-emerald-800">Ver módulo</button>}
            flush
          >
            {operacoes.length === 0 ? (
              <EmptyState icon={Truck} title="Sem equipamento operado" compact />
            ) : (
              <ul className="divide-y divide-slate-100">
                {operacoes.slice(0, 8).map(item => (
                  <li key={item.id} className="flex items-center justify-between gap-3 px-5 py-3 text-xs">
                    <span className="min-w-0">
                      <strong className="block font-mono text-slate-900">{item.prefixo}</strong>
                      <span className="block text-[10px] text-slate-400">{formatarData(item.data)}</span>
                    </span>
                    <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${statusTone(item.status)}`}>{item.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card
            className="min-w-0"
            title="Viagens e inspeções"
            description={viagens.length || inspecoes.length ? `${viagens.length} viagem(ns) · ${inspecoes.length} checklist(s)` : undefined}
            flush
          >
            {viagens.length === 0 && inspecoes.length === 0 ? (
              <EmptyState icon={ClipboardCheck} title="Sem viagens ou checklists" compact />
            ) : (
              <ul className="divide-y divide-slate-100">
                {viagens.slice(0, 5).map(item => (
                  <li key={item.id} className="flex items-center justify-between gap-3 px-5 py-3 text-xs">
                    <span className="min-w-0">
                      <strong className="block font-mono text-slate-900">Ticket {item.ticketNumero || '—'}</strong>
                      <span className="block truncate text-[10px] text-slate-400">{item.prefixo} · {item.tipoMaterial}</span>
                    </span>
                    <span className="shrink-0 text-slate-600">{formatarData(item.data)}</span>
                  </li>
                ))}
                {inspecoes.slice(0, 5).map(item => (
                  <li key={item.id} className="flex items-center justify-between gap-3 px-5 py-3 text-xs">
                    <span className="min-w-0">
                      <strong className="block text-slate-900">Checklist {item.prefixo}</strong>
                      {item.ordemServicoNumero && <span className="block text-[10px] text-rose-600">abriu {item.ordemServicoNumero}</span>}
                    </span>
                    <span className="shrink-0 text-slate-600">{formatarData(item.data)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Modal
          open={Boolean(mudanca)}
          title={`Situação de ${selecionado.nome}`}
          size="sm"
          onClose={() => setMudanca(null)}
          footer={(
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMudanca(null)}
                className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!mudanca?.data}
                onClick={() => {
                  if (!mudanca || !onAlterarSituacao) return;
                  const entrada = { ...mudanca, por: responsavel };
                  onAlterarSituacao(aplicarSituacao(selecionado, entrada), descreverMudanca(selecionado, entrada));
                  setMudanca(null);
                }}
                className="min-h-11 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                Salvar situação
              </button>
            </div>
          )}
        >
          <div className="space-y-3">
            <label className="block space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Situação</span>
              <select
                value={mudanca?.situacao || 'ATIVO'}
                onChange={event => setMudanca(atual => atual && { ...atual, situacao: event.target.value as SituacaoColaborador })}
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800"
              >
                {SITUACOES_COLABORADOR.map(item => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">A partir de</span>
              <TextInput
                type="date"
                value={mudanca?.data || ''}
                onChange={event => setMudanca(atual => atual && { ...atual, data: event.target.value })}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Motivo</span>
              <TextInput
                placeholder="Fim de contrato, férias programadas, atestado…"
                value={mudanca?.motivo || ''}
                onChange={event => setMudanca(atual => atual && { ...atual, motivo: event.target.value })}
              />
            </label>
            <p className="text-[11px] leading-5 text-slate-500">
              Desmobilizado e inativo tiram a pessoa do efetivo disponível e guardam a data de saída.
              Férias e afastamento mantêm a pessoa no efetivo — ela volta.
            </p>
          </div>
        </Modal>
      </div>
    );
  }

  return (
    <div id="colaboradores-tab" className="min-h-full w-full bg-[#f7f8f6] px-4 pb-12 pt-6 sm:px-7 lg:px-9">
      <PageHeader
        title="Colaboradores"
        description="Efetivo da obra. Abra um colaborador para ver a ficha completa."
        actions={<button type="button" onClick={() => onNavigate('cadastros')} className="inline-flex min-h-10 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition-colors hover:border-emerald-500 hover:text-emerald-700">Cadastrar colaborador</button>}
      />

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Buscar colaborador</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={busca}
            onChange={event => setBusca(event.target.value)}
            placeholder="Nome, matrícula, função, área ou encarregado"
            className="min-h-11 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-emerald-500"
          />
        </label>
        <select
          value={situacao}
          onChange={event => setSituacao(event.target.value as (typeof SITUACOES)[number])}
          aria-label="Situação do colaborador"
          className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500"
        >
          {SITUACOES.map(item => <option key={item}>{item}</option>)}
        </select>
      </div>

      <p className="mt-3 text-xs font-medium text-slate-500">{lista.length} colaborador(es)</p>

      {lista.length === 0 ? (
        <div className="mt-4 rounded-lg border border-slate-200 bg-white">
          <EmptyState icon={UserRound} title="Nenhum colaborador encontrado" description="Ajuste a busca ou cadastre o efetivo." />
        </div>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {lista.map(item => {
            const equipe = equipePorFuncionario.get(item.id);
            const situacaoItem = item.status || (item.ativo ? 'ATIVO' : 'INATIVO');
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setSelecionadoId(item.id)}
                  className="group flex w-full flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <strong className="block truncate text-sm font-bold text-slate-900">{item.nome}</strong>
                      <span className="block truncate text-xs text-slate-500">{item.cargo}</span>
                    </div>
                    {item.matricula && <Badge tone="neutral">{item.matricula}</Badge>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${statusTone(situacaoItem)}`}>{situacaoItem}</span>
                    {equipe && <Badge tone="info">{equipe.nome}</Badge>}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1"><UserRound className="h-3 w-3" />{item.liderNome || 'Sem encarregado'}</span>
                    <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" />{empresas.find(empresa => empresa.id === item.empresaId)?.nome || 'Sem empresa'}</span>
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
