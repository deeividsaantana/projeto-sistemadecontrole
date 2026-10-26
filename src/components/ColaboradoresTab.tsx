/**
 * Colaboradores: o efetivo e a ficha individual, reunindo o que os módulos já
 * registraram sobre a pessoa — equipe, presença, frota operada e viagens.
 */
import { useMemo, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { ArrowLeft, ClipboardCheck, Search, Truck, UserRound, UserCog, Users } from 'lucide-react';
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
import { displayText } from '../utils/displayText';
import { Card, EmptyState, Modal, PageHeader, TextInput, isoDay, statusTone } from '../shared/ui';
import { TelaCheia } from '../shared/ui/TelaCheia';
import { TabelaPadrao, type ColunaTabela } from '../shared/ui/TabelaPadrao';
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
  /** Quem não abre a aba não vê o botão que leva até ela. */
  podeAbrir?: (tab: string) => boolean;
  /** Ausente quando o perfil não pode mexer no cadastro: a ação nem aparece. */
  onAlterarSituacao?: (proximo: Funcionario, descricao: string) => void;
  responsavel?: string;
}

const SITUACOES = ['Todas', 'ATIVO', 'INATIVO', 'FÉRIAS', 'AFASTADO', 'DESMOBILIZADO'] as const;

const FOCO = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--renea-focus)';
const situacaoDe = (item: Funcionario) => item.status || (item.ativo ? 'ATIVO' : 'INATIVO');

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
  podeAbrir = () => true,
  onAlterarSituacao,
  responsavel = '',
}: ColaboradoresTabProps) {
  const escopo = useRef<HTMLElement>(null);
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
      .filter(item => situacao === 'Todas' || situacaoDe(item) === situacao)
      .filter(item => !termo || normalizeComparable(`${item.nome} ${item.matricula || ''} ${item.cargo} ${item.area || ''} ${item.liderNome || ''}`).includes(termo))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [funcionarios, situacao, busca]);

  const nomeEmpresa = useMemo(() => new Map(empresas.map(empresa => [empresa.id, empresa.nome])), [empresas]);

  // A lista é paginada pela TabelaPadrao (50 por página), o que mantém o
  // celular leve com 400 pessoas (auditoria de desempenho de 16/10/2026, G10).
  const colunas: ColunaTabela<Funcionario>[] = [
    { chave: 'nome', titulo: 'Nome', larguraMinima: 220, valorOrdenacao: item => item.nome, render: item => <span className="font-bold text-slate-900">{item.nome}</span> },
    { chave: 'matricula', titulo: 'Matrícula', larguraMinima: 100, valorOrdenacao: item => item.matricula, render: item => <span className="tabular-nums">{item.matricula || '—'}</span> },
    { chave: 'cargo', titulo: 'Função', larguraMinima: 140, valorOrdenacao: item => item.cargo, render: item => item.cargo || '—' },
    {
      chave: 'situacao', titulo: 'Situação', larguraMinima: 120, valorOrdenacao: situacaoDe, dica: situacaoDe,
      render: item => <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${statusTone(situacaoDe(item))}`}>{situacaoDe(item)}</span>,
    },
    { chave: 'equipe', titulo: 'Equipe', larguraMinima: 150, valorOrdenacao: item => equipePorFuncionario.get(item.id)?.nome, render: item => { const equipe = equipePorFuncionario.get(item.id); return equipe ? displayText(equipe.nome, 'Equipe sem nome') : '—'; } },
    { chave: 'lider', titulo: 'Encarregado', larguraMinima: 150, valorOrdenacao: item => item.liderNome, render: item => displayText(item.liderNome, '—') },
    { chave: 'empresa', titulo: 'Empresa', larguraMinima: 150, valorOrdenacao: item => nomeEmpresa.get(item.empresaId), render: item => nomeEmpresa.get(item.empresaId) || 'Sem empresa' },
  ];

  const selecionado = selecionadoId ? funcionarios.find(item => item.id === selecionadoId) : undefined;

  useGSAP(() => {
    const raiz = escopo.current;
    if (!raiz || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(raiz.querySelectorAll('[data-colaboradores-reveal]'), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.06, ease: 'power3.out', clearProps: 'transform,opacity' });
  }, { scope: escopo, dependencies: [selecionadoId] });

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
      <TelaCheia ref={escopo} id="colaboradores-tab" rotulo={`Ficha de ${selecionado.nome}`} longa testId="colaborador-ficha"
        cabecalho={<div data-colaboradores-reveal className="space-y-3">
          <button
            type="button"
            onClick={() => setSelecionadoId(null)}
            className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 transition-colors hover:border-emerald-500 hover:text-emerald-700 lg:min-h-10 ${FOCO}`}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Voltar para colaboradores
          </button>
          <PageHeader
            eyebrow="Ficha do colaborador"
            title={selecionado.nome}
            description={[selecionado.matricula && `Matrícula ${selecionado.matricula}`, selecionado.cargo, empresa].filter(Boolean).join(' · ')}
            actions={(
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${statusTone(situacaoAtual)}`}>{situacaoAtual}</span>
                {onAlterarSituacao && (
                  <button
                    type="button"
                    onClick={() => setMudanca({
                      situacao: situacaoAtual === 'ATIVO' ? 'FÉRIAS' : 'ATIVO',
                      data: isoDay(new Date()),
                      motivo: '',
                    })}
                    className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 transition-colors hover:border-emerald-500 hover:text-emerald-700 lg:min-h-10 ${FOCO}`}
                  >
                    <UserCog className="h-4 w-4" aria-hidden="true" /> Alterar situação
                  </button>
                )}
              </div>
            )}
          />
        </div>}
      >
        <section data-colaboradores-reveal aria-label="Resumo do colaborador" className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {indicadores.map(item => (
            <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{item.label}</p>
              <strong className="mt-1.5 block text-lg font-black leading-tight text-slate-900">{item.valor}</strong>
              <span className="text-xs text-[#5b6870]">{item.detalhe}</span>
            </div>
          ))}
        </section>

        <div data-colaboradores-reveal className="grid gap-4 xl:grid-cols-2">
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
                  <dt className="text-xs font-bold uppercase tracking-wide text-[#5b6870]">{rotulo}</dt>
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
            actions={<button type="button" onClick={() => onNavigate('presenca')} className="text-xs font-bold text-emerald-800 hover:text-emerald-900 inline-flex min-h-11 items-center lg:min-h-8">Ver módulo</button>}
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
                      <span className="block truncate text-xs text-[#5b6870]">{item.grupoNome}{item.frenteServico ? ` · ${item.frenteServico}` : ''}</span>
                    </span>
                    <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${statusTone(item.status)}`}>{item.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card
            className="min-w-0"
            title="Frota operada"
            description={operacoes.length ? `${operacoes.length} dia(s) com lançamento` : undefined}
            actions={<button type="button" onClick={() => onNavigate('controle-equipamentos')} className="text-xs font-bold text-emerald-800 hover:text-emerald-900 inline-flex min-h-11 items-center lg:min-h-8">Ver módulo</button>}
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
                      <span className="block text-xs text-[#5b6870]">{formatarData(item.data)}</span>
                    </span>
                    <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${statusTone(item.status)}`}>{item.status}</span>
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
                      <span className="block truncate text-xs text-[#5b6870]">{item.prefixo} · {item.tipoMaterial}</span>
                    </span>
                    <span className="shrink-0 text-slate-600">{formatarData(item.data)}</span>
                  </li>
                ))}
                {inspecoes.slice(0, 5).map(item => (
                  <li key={item.id} className="flex items-center justify-between gap-3 px-5 py-3 text-xs">
                    <span className="min-w-0">
                      <strong className="block text-slate-900">Checklist {item.prefixo}</strong>
                      {item.ordemServicoNumero && <span className="block text-xs text-rose-600">abriu {item.ordemServicoNumero}</span>}
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
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Situação</span>
              <select
                value={mudanca?.situacao || 'ATIVO'}
                onChange={event => setMudanca(atual => atual && { ...atual, situacao: event.target.value as SituacaoColaborador })}
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800"
              >
                {SITUACOES_COLABORADOR.map(item => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">A partir de</span>
              <TextInput
                type="date"
                value={mudanca?.data || ''}
                onChange={event => setMudanca(atual => atual && { ...atual, data: event.target.value })}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Motivo</span>
              <TextInput
                placeholder="Fim de contrato, férias programadas, atestado…"
                value={mudanca?.motivo || ''}
                onChange={event => setMudanca(atual => atual && { ...atual, motivo: event.target.value })}
              />
            </label>
            <p className="text-xs leading-5 text-slate-500">
              Desmobilizado e inativo tiram a pessoa do efetivo disponível e guardam a data de saída.
              Férias e afastamento mantêm a pessoa no efetivo — ela volta.
            </p>
          </div>
        </Modal>
      </TelaCheia>
    );
  }

  return (
    <TelaCheia ref={escopo} id="colaboradores-tab" rotulo="Colaboradores"
      cabecalho={<div data-colaboradores-reveal>
        <PageHeader
          eyebrow="Pessoas"
          title="Colaboradores"
          actions={podeAbrir('cadastros') && <button type="button" onClick={() => onNavigate('cadastros')} className={`inline-flex min-h-11 items-center rounded-xl bg-[#176b4d] px-4 text-sm font-bold text-white transition hover:opacity-90 lg:min-h-10 ${FOCO}`}>Cadastrar colaborador</button>}
        />
      </div>}
      faixa={<div data-colaboradores-reveal className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3 sm:flex-row">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Buscar colaborador</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5b6870]" aria-hidden="true" />
          <input
            type="search"
            value={busca}
            onChange={event => setBusca(event.target.value)}
            placeholder="Nome, matrícula, função, área ou encarregado"
            className={`min-h-11 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 focus:border-emerald-500 ${FOCO}`}
          />
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          Situação
          <select
            value={situacao}
            onChange={event => setSituacao(event.target.value as (typeof SITUACOES)[number])}
            className={`min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 focus:border-emerald-500 ${FOCO}`}
          >
            {SITUACOES.map(item => <option key={item}>{item}</option>)}
          </select>
        </label>
      </div>}
    >
      <div data-colaboradores-reveal className="flex min-h-0 flex-1 flex-col">
        <TabelaPadrao
          titulo="Colaboradores da obra"
          linhas={lista}
          colunas={colunas}
          idDaLinha={item => item.id}
          nomeDoItem={{ um: 'colaborador', varios: 'colaboradores' }}
          vazio={<EmptyState icon={UserRound} title="Nenhum colaborador encontrado" description="Ajuste a busca ou cadastre o efetivo." />}
          onAbrirLinha={item => setSelecionadoId(item.id)}
          className="flex-1"
          testId="colaboradores-lista"
        />
      </div>
    </TelaCheia>
  );
}
