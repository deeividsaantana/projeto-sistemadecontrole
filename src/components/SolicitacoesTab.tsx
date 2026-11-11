/**
 * Solicitações e compras: requisição de campo → Suprimentos (cotação e pedido)
 * → aprovação da gerência → entrega no canteiro ou no descarte. As regras
 * (quem pode o quê, atraso, reagendamento com registro) estão em
 * src/utils/solicitacoes.ts; esta tela só mostra e chama.
 */
import { useMemo, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { AlertTriangle, ClipboardCheck, FileSpreadsheet, Inbox, PackagePlus, Search, ShieldCheck, Upload, Users } from 'lucide-react';
import { Drawer, Modal, PageHeader, isoDay } from '../shared/ui';
import { TelaCheia } from '../shared/ui/TelaCheia';
import { AbasDaTela, idDaAba } from '../shared/ui/AbasDaTela';
import { TabelaPadrao, type ColunaTabela } from '../shared/ui/TabelaPadrao';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO } from './cadastros/estilos';
import {
  ETAPAS,
  NOME_DO_PAPEL,
  abrirSolicitacao,
  exerce,
  formatarDia,
  pessoaDoUsuario,
  situacaoDe,
  type Ator,
  type PessoaSuprimentos,
  type SituacaoSolicitacao,
  type Solicitacao,
} from '../utils/solicitacoes';
import { validarImportacao, type ResultadoImportacao } from '../utils/solicitacoesPlanilha';
import { NovaSolicitacao } from './solicitacoes/NovaSolicitacao';
import { DetalheSolicitacao } from './solicitacoes/DetalheSolicitacao';
import { PessoasSuprimentosLista } from './solicitacoes/PessoasSuprimentosLista';
import { SeloSituacao } from './solicitacoes/SeloSituacao';

type Subtela = 'fila' | 'nova' | 'aprovacao' | 'atrasos' | 'pessoas';

interface SolicitacoesTabProps {
  solicitacoes: Solicitacao[];
  pessoas: PessoaSuprimentos[];
  usuario: { nome: string; email?: string | null };
  /** Administrador do app: liga cada login a um papel do módulo. */
  ehAdmin: boolean;
  /** Perfil do app que grava (leitura só consulta). */
  podeEditar: boolean;
  onSalvar: (registros: Solicitacao[], descricao: string) => void;
  onSalvarPessoas: (pessoas: PessoaSuprimentos[]) => void;
}

const FILTROS = ['Todas', 'Em aberto', 'Em Atraso', ...ETAPAS] as const;
type Filtro = typeof FILTROS[number];

const novoId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `sol-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

const abertas = (situacao: SituacaoSolicitacao) => situacao !== 'Entregue' && situacao !== 'Cancelado';

export default function SolicitacoesTab({ solicitacoes, pessoas, usuario, ehAdmin, podeEditar, onSalvar, onSalvarPessoas }: SolicitacoesTabProps) {
  const escopo = useRef<HTMLElement>(null);
  const arquivo = useRef<HTMLInputElement>(null);
  const hoje = isoDay(new Date());
  const [subtela, setSubtela] = useState<Subtela>('fila');
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('Em aberto');
  const [abertaId, setAbertaId] = useState<string | null>(null);
  const [importacao, setImportacao] = useState<ResultadoImportacao | null>(null);
  const [aviso, setAviso] = useState<{ tom: 'ok' | 'erro'; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const pessoa = pessoaDoUsuario(pessoas, { nome: usuario.nome, email: usuario.email });
  // Administrador sem pessoa ligada entra como dev: faz tudo no módulo.
  const papel = pessoa?.papel ?? (ehAdmin ? 'dev' : null);
  const ator: Ator = { nome: pessoa?.nome ?? usuario.nome, papel: podeEditar ? papel : null };

  useGSAP(() => {
    const raiz = escopo.current;
    if (!raiz || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(raiz.querySelectorAll('[data-sol-reveal]'), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.45, stagger: 0.05, ease: 'power3.out', clearProps: 'transform,opacity' });
  }, { scope: escopo, dependencies: [subtela] });

  const comSituacao = useMemo(
    () => solicitacoes.map(sol => ({ sol, situacao: situacaoDe(sol, hoje) })),
    [solicitacoes, hoje],
  );
  const aguardandoAprovacao = comSituacao.filter(item => item.situacao === 'Aguardando Aprovação');
  const emAtraso = comSituacao.filter(item => item.situacao === 'Em Atraso');
  const naFilaDeSuprimentos = comSituacao.filter(item => item.situacao === 'Pendente Suprimentos').length;

  const lista = useMemo(() => {
    const base = subtela === 'aprovacao' ? aguardandoAprovacao : subtela === 'atrasos' ? emAtraso : comSituacao;
    const termo = busca.trim().toLowerCase();
    return base
      .filter(({ situacao }) => subtela !== 'fila' || filtro === 'Todas'
        || (filtro === 'Em aberto' ? abertas(situacao) : situacao === filtro))
      .filter(({ sol }) => !termo || [sol.numero, sol.numeroPedido, sol.solicitante, sol.frente, sol.estacamento, sol.fornecedor, ...sol.itens.map(item => item.descricao)]
        .some(valor => valor?.toLowerCase().includes(termo)));
  }, [subtela, aguardandoAprovacao, emAtraso, comSituacao, busca, filtro]);

  const aberta = solicitacoes.find(sol => sol.id === abertaId) ?? null;

  const salvarUma = (sol: Solicitacao, descricao: string) => {
    onSalvar([sol], descricao);
    setAviso({ tom: 'ok', texto: descricao });
  };

  const escolherArquivo = async (selecionado?: File) => {
    if (arquivo.current) arquivo.current.value = '';
    if (!selecionado) return;
    setOcupado(true);
    setAviso(null);
    try {
      const { lerArquivoDeImportacao } = await import('./solicitacoes/planilhaSolicitacoes');
      setImportacao(validarImportacao(await lerArquivoDeImportacao(selecionado), pessoas));
    } catch (error) {
      setAviso({ tom: 'erro', texto: error instanceof Error ? error.message : 'Não foi possível ler o arquivo.' });
    } finally {
      setOcupado(false);
    }
  };

  const confirmarImportacao = () => {
    if (!importacao) return;
    const agora = new Date().toISOString();
    const criadas: Solicitacao[] = [];
    for (const { dados } of importacao.aceitas) {
      const resultado = abrirSolicitacao(dados, { nome: ator.nome, papel: 'solicitante' }, [...solicitacoes, ...criadas], agora, novoId());
      if ('solicitacao' in resultado) criadas.push({ ...resultado.solicitacao, eventos: [{ data: agora, usuario: ator.nome, acao: 'Importou da planilha' }] });
    }
    if (criadas.length) onSalvar(criadas, `Importou ${criadas.length} solicitação(ões) da planilha.`);
    setAviso({ tom: 'ok', texto: `${criadas.length} solicitação(ões) importada(s)${importacao.rejeitadas.length ? `, ${importacao.rejeitadas.length} linha(s) recusada(s)` : ''}.` });
    setImportacao(null);
  };

  const exportar = async () => {
    setOcupado(true);
    try {
      const { baixarRelatorios } = await import('./solicitacoes/planilhaSolicitacoes');
      await baixarRelatorios(solicitacoes, hoje);
    } catch (error) {
      setAviso({ tom: 'erro', texto: error instanceof Error ? error.message : 'Não foi possível gerar a planilha.' });
    } finally {
      setOcupado(false);
    }
  };

  const baixarModelo = async () => {
    const { baixarModeloDeImportacao } = await import('./solicitacoes/planilhaSolicitacoes');
    await baixarModeloDeImportacao();
  };

  const podeImportar = ehAdmin || exerce(ator, 'solicitante') || exerce(ator, 'suprimentos');

  const subtelas = [
    { id: 'fila' as const, rotulo: 'Solicitações', icone: Inbox, contador: naFilaDeSuprimentos, contadorRotulo: 'esperando Suprimentos' },
    ...(exerce(ator, 'solicitante') ? [{ id: 'nova' as const, rotulo: 'Nova solicitação', curto: 'Nova', icone: PackagePlus }] : []),
    { id: 'aprovacao' as const, rotulo: 'Aprovação', icone: ShieldCheck, contador: aguardandoAprovacao.length, contadorRotulo: 'aguardando aprovação' },
    { id: 'atrasos' as const, rotulo: 'Em atraso', curto: 'Atraso', icone: AlertTriangle, contador: emAtraso.length, contadorRotulo: 'em atraso' },
    ...(ehAdmin ? [{ id: 'pessoas' as const, rotulo: 'Pessoas e papéis', curto: 'Pessoas', icone: Users }] : []),
  ];

  const colunas: ColunaTabela<{ sol: Solicitacao; situacao: SituacaoSolicitacao }>[] = [
    { chave: 'numero', titulo: 'Solicitação', larguraIdeal: 128, render: ({ sol }) => <strong className="font-black text-slate-900">{sol.numero}</strong>, valorOrdenacao: ({ sol }) => sol.abertaEm, valorExportacao: ({ sol }) => sol.numero },
    { chave: 'solicitante', titulo: 'Solicitante', larguraIdeal: 120, render: ({ sol }) => sol.solicitante, valorOrdenacao: ({ sol }) => sol.solicitante },
    { chave: 'frente', titulo: 'Frente / local', larguraIdeal: 140, render: ({ sol }) => [sol.frente, sol.estacamento].filter(Boolean).join(' · '), dica: ({ sol }) => [sol.frente, sol.estacamento].filter(Boolean).join(' · '), valorOrdenacao: ({ sol }) => sol.frente },
    { chave: 'itens', titulo: 'Itens', larguraIdeal: 180, render: ({ sol }) => `${sol.itens[0]?.descricao ?? ''}${sol.itens.length > 1 ? ` (+${sol.itens.length - 1})` : ''}`, dica: ({ sol }) => sol.itens.map(item => item.descricao).join('; ') },
    { chave: 'prazo', titulo: 'Prazo desejado', larguraIdeal: 104, render: ({ sol }) => formatarDia(sol.itens.map(item => item.prazoDesejado).sort()[0]), valorOrdenacao: ({ sol }) => sol.itens.map(item => item.prazoDesejado).sort()[0] },
    { chave: 'situacao', titulo: 'Situação', larguraIdeal: 165, render: ({ situacao }) => <SeloSituacao situacao={situacao} />, valorOrdenacao: ({ situacao }) => situacao, valorExportacao: ({ situacao }) => situacao },
    { chave: 'pedido', titulo: 'Pedido', larguraIdeal: 150, render: ({ sol }) => sol.numeroPedido ? `${sol.numeroPedido} · ${sol.fornecedor ?? ''}` : '—', dica: ({ sol }) => sol.fornecedor, valorOrdenacao: ({ sol }) => sol.numeroPedido },
    { chave: 'janela', titulo: 'Entrega até', larguraIdeal: 100, render: ({ sol }) => formatarDia(sol.janelaFim), valorOrdenacao: ({ sol }) => sol.janelaFim },
  ];

  const ehLista = subtela === 'fila' || subtela === 'aprovacao' || subtela === 'atrasos';

  return (
    <TelaCheia ref={escopo} id="solicitacoes-tab" rotulo="Solicitações e compras"
      longa={!ehLista} idAbaAtiva={idDaAba('solicitacoes', subtela)} idDados="solicitacoes-dados" chaveRolagem={subtela}
      cabecalho={<PageHeader
        eyebrow="Suprimentos"
        title="Solicitações e compras"
        abas={<AbasDaTela<Subtela> id="solicitacoes" rotulo="Subtelas de solicitações" abas={subtelas} ativa={subtela} onTrocar={setSubtela} idPainel="solicitacoes-dados" testId="solicitacoes-aba" />}
        actions={<>
          <button type="button" onClick={() => void exportar()} disabled={ocupado || solicitacoes.length === 0} className={BOTAO_SECUNDARIO}>
            <FileSpreadsheet className="size-4" aria-hidden="true" /> Relatórios Excel
          </button>
          {podeImportar && podeEditar && (
            <button type="button" onClick={() => arquivo.current?.click()} disabled={ocupado} className={BOTAO_SECUNDARIO}>
              <Upload className="size-4" aria-hidden="true" /> Importar planilha
            </button>
          )}
          {exerce(ator, 'solicitante') && subtela !== 'nova' && (
            <button type="button" onClick={() => setSubtela('nova')} className={BOTAO_PRIMARIO}>
              <PackagePlus className="size-4" aria-hidden="true" /> Nova solicitação
            </button>
          )}
        </>}
      />}
      faixa={<div data-sol-reveal className="grid gap-2">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600">
          <ClipboardCheck className="size-4 text-[#176b4d]" aria-hidden="true" />
          {ator.papel
            ? <>Você entra como <strong className="text-slate-900">{ator.nome}</strong> · {NOME_DO_PAPEL[ator.papel]}</>
            : <>Seu login só consulta este módulo.{ehAdmin && ' Ligue o login a uma pessoa em "Pessoas e papéis".'}</>}
        </p>
        {exerce(ator, 'aprovador') && aguardandoAprovacao.length > 0 && subtela !== 'aprovacao' && (
          <button type="button" onClick={() => setSubtela('aprovacao')} className="flex min-h-11 items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 text-left text-sm font-bold text-amber-900">
            <ShieldCheck className="size-4 shrink-0" aria-hidden="true" /> {aguardandoAprovacao.length} pedido(s) de compra esperando a sua aprovação. Toque para ver.
          </button>
        )}
        {emAtraso.length > 0 && subtela !== 'atrasos' && (
          <button type="button" onClick={() => setSubtela('atrasos')} className="flex min-h-11 items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 text-left text-sm font-bold text-rose-800">
            <AlertTriangle className="size-4 shrink-0" aria-hidden="true" /> {emAtraso.length} entrega(s) em atraso: passou o fim da janela sem confirmação de chegada.
          </button>
        )}
        {aviso && (
          <p role={aviso.tom === 'erro' ? 'alert' : 'status'} className={`rounded-xl border px-4 py-2.5 text-sm font-bold ${aviso.tom === 'erro' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{aviso.texto}</p>
        )}
        {ehLista && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Buscar solicitação</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
              <input type="search" value={busca} onChange={event => setBusca(event.target.value)} placeholder="Número, pedido, frente, item, fornecedor..." className={`${CAMPO} pl-9`} />
            </label>
            {subtela === 'fila' && (
              <select value={filtro} onChange={event => setFiltro(event.target.value as Filtro)} aria-label="Filtrar por situação" className={`${CAMPO} sm:w-56`}>
                {FILTROS.map(item => <option key={item}>{item}</option>)}
              </select>
            )}
          </div>
        )}
      </div>}
    >
      <input ref={arquivo} type="file" accept=".xlsx,.csv" hidden onChange={event => void escolherArquivo(event.target.files?.[0])} />

      {ehLista && (
        <div data-sol-reveal className="min-h-0 flex-1">
          <TabelaPadrao
            titulo={subtela === 'aprovacao' ? 'Pedidos aguardando aprovação' : subtela === 'atrasos' ? 'Entregas em atraso' : 'Solicitações'}
            linhas={lista}
            colunas={colunas}
            idDaLinha={({ sol }) => sol.id}
            nomeDoItem={{ um: 'solicitação', varios: 'solicitações' }}
            ordenacaoInicial={{ chave: 'numero', direcao: 'desc' }}
            onAbrirLinha={({ sol }) => setAbertaId(sol.id)}
            linhaAtivaId={abertaId}
            classeLinha={({ situacao }) => (situacao === 'Em Atraso' ? 'bg-rose-50' : undefined)}
            vazio={subtela === 'aprovacao' ? 'Nenhum pedido esperando aprovação.' : subtela === 'atrasos' ? 'Nenhuma entrega em atraso.' : 'Nenhuma solicitação neste filtro.'}
            testIdLinha="solicitacao-linha"
            densa
          />
        </div>
      )}

      {subtela === 'nova' && exerce(ator, 'solicitante') && (
        <NovaSolicitacao
          solicitante={ator.nome}
          onEnviar={dados => {
            const resultado = abrirSolicitacao(dados, ator, solicitacoes, new Date().toISOString(), novoId());
            if ('erro' in resultado) return resultado.erro;
            salvarUma(resultado.solicitacao, `Abriu a solicitação ${resultado.solicitacao.numero}. Suprimentos já vê na fila.`);
            setSubtela('fila');
            return null;
          }}
        />
      )}

      {subtela === 'pessoas' && ehAdmin && (
        <PessoasSuprimentosLista pessoas={pessoas} onSalvar={onSalvarPessoas} />
      )}

      <Drawer open={Boolean(aberta)} onClose={() => setAbertaId(null)}
        title={aberta ? `${aberta.numero} · ${aberta.frente}` : ''}
        description={aberta ? `Aberta por ${aberta.solicitante} em ${formatarDia(aberta.abertaEm)}` : undefined}
        className="sm:max-w-xl">
        {aberta && (
          <DetalheSolicitacao
            key={`${aberta.id}-${aberta.atualizadoEm}`}
            solicitacao={aberta}
            todas={solicitacoes}
            ator={ator}
            hoje={hoje}
            onSalvar={salvarUma}
          />
        )}
      </Drawer>

      <Modal open={Boolean(importacao)} onClose={() => setImportacao(null)} title="Conferir importação" size="lg"
        footer={<div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => void baixarModelo()} className={BOTAO_SECUNDARIO}>Baixar modelo</button>
          <button type="button" onClick={() => setImportacao(null)} className={BOTAO_SECUNDARIO}>Cancelar</button>
          <button type="button" onClick={confirmarImportacao} disabled={!importacao?.aceitas.length} className={BOTAO_PRIMARIO}>
            Importar {importacao?.aceitas.length ?? 0} linha(s)
          </button>
        </div>}>
        {importacao && (
          <div className="grid gap-3 text-sm">
            <p className="text-slate-700"><strong className="text-[#176b4d]">{importacao.aceitas.length}</strong> linha(s) prontas para virar solicitação. <strong className="text-rose-700">{importacao.rejeitadas.length}</strong> recusada(s).</p>
            {importacao.rejeitadas.length > 0 && (
              <ul className="grid max-h-72 gap-1 overflow-y-auto rounded-xl border border-rose-200 bg-rose-50 p-3">
                {importacao.rejeitadas.map(item => <li key={item.linha} className="text-rose-800"><strong>Linha {item.linha}:</strong> {item.motivo}</li>)}
              </ul>
            )}
            <p className="text-slate-600">Colunas esperadas: Solicitante, Tipo (Material/Serviço), Ramo/Local, Descrição, Quantidade, Unidade, Prazo Desejado e Permite Parcial (S/N).</p>
          </div>
        )}
      </Modal>
    </TelaCheia>
  );
}
