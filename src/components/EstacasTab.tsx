/**
 * Estacas prancha: quantas a obra precisa cravar, quantas já foram, quantas
 * faltam e a porcentagem, com a cortina desenhada por frente, os relatórios
 * e o recebimento pela nota fiscal.
 */
import { useMemo, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { CheckCircle2, Hammer, Target, X } from 'lucide-react';
import type { ControleEstacas, CravacaoEstaca, LoteEstaca, ObraLocal } from '../types';
import { estacasPorFrente, estaCravada, frenteDaEstaca, nomeDaEstaca, resumirEstacas } from '../modules/estacas/avancoEstacas';
import { reconcileStakeInvoice } from '../utils/stakeOperations';
import { inativar, somenteAtivos } from '../utils/inativacao';
import { PageHeader, isoDay } from '../shared/ui';
import { AbasDaTela, idDaAba } from '../shared/ui/AbasDaTela';
import { TelaCheia } from '../shared/ui/TelaCheia';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, FOCO } from './cadastros/estilos';
import { abasEstacas, type SecaoEstacas } from './estacas/abasEstacas';
import VisaoEstacas from './estacas/VisaoEstacas';
import FormCravacao, { type PedidoDeCravacao } from './estacas/FormCravacao';
import ListaEstacas from './estacas/ListaEstacas';
import RelatoriosEstacas from './estacas/RelatoriosEstacas';
import RecebimentosEstacas from './estacas/RecebimentosEstacas';
import PlanejarFrente from './estacas/PlanejarFrente';
import EstacasImportacoesPanel from './EstacasImportacoesPanel';
import './estacas/Estacas.css';

type Props = {
  controle: ControleEstacas;
  obras: ObraLocal[];
  onChange: (next: ControleEstacas, description: string) => void;
  /** Quem fica registrado no lançamento e na inativação. */
  responsavel?: string;
  /** Parte que abre primeiro; a aba Relatórios pede 'relatorios'. */
  secaoInicial?: SecaoEstacas;
};

export default function EstacasTab({ controle, obras, onChange, responsavel = 'Sistema', secaoInicial = 'visao' }: Props) {
  const hoje = isoDay(new Date());
  const [secao, setSecao] = useState<SecaoEstacas>(secaoInicial);
  const [pedido, setPedido] = useState<PedidoDeCravacao>({});
  const [frenteAtual, setFrenteAtual] = useState('');
  const [planejando, setPlanejando] = useState<{ frente?: string } | null>(null);
  const [aviso, setAviso] = useState('');
  const [erro, setErro] = useState('');

  // Estaca e lote inativados saem das contas, do desenho e das listas, mas
  // continuam no arquivo.
  const estacas = useMemo(() => somenteAtivos(controle.cravacoes), [controle.cravacoes]);
  const lotes = useMemo(() => somenteAtivos(controle.lotes), [controle.lotes]);
  const frentes = useMemo(() => estacasPorFrente(estacas), [estacas]);
  const total = useMemo(() => resumirEstacas(estacas), [estacas]);
  const notasPendentes = useMemo(
    () => Array.from(new Set(lotes.map(item => item.notaFiscal).filter(Boolean))).filter(nota => reconcileStakeInvoice(lotes, nota).status !== 'Conforme').length,
    [lotes],
  );

  const escolherSecao = (proxima: SecaoEstacas) => {
    setSecao(proxima);
    setErro('');
  };

  const abrirCravacao = (estaca?: CravacaoEstaca, frente?: string) => {
    setPedido({ estacaId: estaca?.id, frente: frente ?? (estaca ? frenteDaEstaca(estaca) : frenteAtual || frentes[0]?.frente) });
    escolherSecao('cravar');
  };

  const salvarCravacao = (estaca: CravacaoEstaca, anteriorId?: string) => {
    const anterior = anteriorId ? controle.cravacoes.find(item => item.id === anteriorId) : undefined;
    const cravacoes = anterior
      ? controle.cravacoes.map(item => (item.id === anterior.id ? estaca : item))
      : [estaca, ...controle.cravacoes];
    const acao = !anterior ? 'Registrou' : estaCravada(anterior) ? 'Corrigiu' : 'Cravou';
    onChange({ ...controle, cravacoes }, `${acao} ${nomeDaEstaca(estaca)} (${frenteDaEstaca(estaca)}).`);
    setFrenteAtual(frenteDaEstaca(estaca));
    setAviso(`${nomeDaEstaca(estaca)} ${anterior && estaCravada(anterior) ? 'corrigida' : 'cravada'}.`);
  };

  const inativarEstacas = (ids: string[]) => {
    onChange({ ...controle, cravacoes: inativar(controle.cravacoes, ids, responsavel) }, ids.length === 1 ? 'Inativou uma estaca.' : `Inativou ${ids.length} estacas.`);
    setAviso(ids.length === 1 ? 'Estaca tirada da lista. Ela continua guardada.' : `${ids.length} estacas tiradas da lista. Elas continuam guardadas.`);
  };

  const aplicarPlano = (novas: CravacaoEstaca[], sobrando: string[], frente: string, quantidade: number) => {
    const cravacoes = sobrando.length ? inativar(controle.cravacoes, sobrando, responsavel) : [...novas, ...controle.cravacoes];
    onChange({ ...controle, cravacoes }, `Definiu ${quantidade} estacas previstas na frente ${frente}.`);
    setPlanejando(null);
    setFrenteAtual(frente);
    setAviso(`${frente}: total previsto agora é ${quantidade.toLocaleString('pt-BR')} estacas.`);
    escolherSecao('visao');
  };

  const aplicarImportacao = (novosLotes: LoteEstaca[], novasCravacoes: CravacaoEstaca[]) => {
    if (!novosLotes.length && !novasCravacoes.length) return;
    onChange(
      { lotes: [...novosLotes, ...controle.lotes], cravacoes: [...novasCravacoes, ...controle.cravacoes] },
      `Importou ${novosLotes.length} lote(s) e ${novasCravacoes.length} cravação(ões) por planilha (com prévia e lote rastreável).`,
    );
    setAviso(`Importação aplicada: ${novosLotes.length} lote(s) e ${novasCravacoes.length} cravação(ões).`);
  };

  const abas = abasEstacas({ faltam: total.faltam, estacas: estacas.length, notasPendentes, lotes: lotes.length });

  const escopo = useRef<HTMLElement>(null);
  const jaEntrou = useRef(false);
  // Entrada do cabeçalho, das abas e dos blocos, no mesmo passo de Materiais.
  useGSAP(() => {
    const raiz = escopo.current;
    if (!raiz || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const primeira = !jaEntrou.current;
    jaEntrou.current = true;
    const blocos = primeira ? raiz.querySelectorAll('[data-estacas-reveal]') : raiz.querySelectorAll('#estacas-dados [data-estacas-reveal]');
    gsap.fromTo(blocos, { opacity: 0, y: primeira ? 14 : 10 }, { opacity: 1, y: 0, duration: primeira ? 0.5 : 0.35, stagger: primeira ? 0.05 : 0.04, ease: 'power3.out', clearProps: 'transform,opacity' });
  }, { scope: escopo, dependencies: [secao] });

  // A lista de estacas ocupa a área toda e rola por dentro (tabela com
  // rodapé); as outras subtelas são cartões e formulário empilhados.
  const longa = secao !== 'estacas';

  return (
    <TelaCheia
      ref={escopo}
      id="estacas-tab"
      testId="estacas-tab"
      rotulo="Controle de Estacas"
      longa={longa}
      idAbaAtiva={idDaAba('estacas', secao)}
      idDados="estacas-dados"
      chaveRolagem={secao}
      cabecalho={(
        <div data-estacas-reveal>
          <PageHeader
            className="estacas-header"
            eyebrow="Operação"
            title="Estacas prancha"
            abas={<AbasDaTela id="estacas" rotulo="Subtelas de estacas" abas={abas} ativa={secao} onTrocar={escolherSecao} idPainel="estacas-dados" testId="estacas-secao" />}
            actions={(
              <>
                <button type="button" onClick={() => setPlanejando({ frente: frenteAtual || undefined })} className={BOTAO_SECUNDARIO}>
                  <Target className="size-5" aria-hidden="true" /> Total previsto
                </button>
                <button type="button" onClick={() => abrirCravacao()} data-testid="estacas-acao-principal" className={`${BOTAO_PRIMARIO} max-sm:order-first px-5`}>
                  <Hammer className="size-5" aria-hidden="true" /> Lançar cravação
                </button>
              </>
            )}
          />
        </div>
      )}
      faixa={(aviso && secao !== 'cravar') || erro ? (
        <div className="space-y-2">
          {/* No lançamento a própria folha já diz o que foi salvo. */}
          {aviso && secao !== 'cravar' && (
            <div role="status" className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900">
              <span className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden="true" /> {aviso}</span>
              <button type="button" onClick={() => setAviso('')} className={`inline-flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-emerald-100 lg:size-9 ${FOCO}`} aria-label="Fechar aviso"><X className="size-5" aria-hidden="true" /></button>
            </div>
          )}
          {erro && (
            <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-800">
              <span>{erro}</span>
              <button type="button" onClick={() => setErro('')} className={`inline-flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-rose-100 lg:size-9 ${FOCO}`} aria-label="Fechar aviso"><X className="size-5" aria-hidden="true" /></button>
            </div>
          )}
        </div>
      ) : undefined}
    >
      {secao === 'visao' && (
        <VisaoEstacas
          hoje={hoje}
          estacas={estacas}
          frentes={frentes}
          frenteAtual={frenteAtual}
          onFrente={setFrenteAtual}
          onCravar={abrirCravacao}
          onEditar={estaca => abrirCravacao(estaca)}
          onPlanejar={frente => setPlanejando({ frente })}
        />
      )}

      {secao === 'cravar' && (
        <FormCravacao
          hoje={hoje}
          controle={{ lotes, cravacoes: estacas }}
          obras={obras}
          responsavel={responsavel}
          pedido={pedido}
          onSalvar={salvarCravacao}
          onCancelar={() => escolherSecao('visao')}
        />
      )}

      {secao === 'estacas' && (
        <ListaEstacas
          estacas={estacas}
          frentes={frentes.map(item => item.frente)}
          onCravar={estaca => abrirCravacao(estaca)}
          onEditar={estaca => abrirCravacao(estaca)}
          onInativar={inativarEstacas}
        />
      )}

      {secao === 'relatorios' && <RelatoriosEstacas hoje={hoje} estacas={estacas} />}

      {secao === 'recebimentos' && (
        <RecebimentosEstacas hoje={hoje} controle={controle} obras={obras} responsavel={responsavel} onChange={onChange} />
      )}

      {secao === 'importar' && (
        <div data-estacas-reveal>
          <EstacasImportacoesPanel controle={controle} responsavel={responsavel} onApply={aplicarImportacao} onError={setErro} />
        </div>
      )}

      <PlanejarFrente
        aberto={Boolean(planejando)}
        frenteInicial={planejando?.frente}
        hoje={hoje}
        responsavel={responsavel}
        estacas={estacas}
        onFechar={() => setPlanejando(null)}
        onAplicar={aplicarPlano}
      />
    </TelaCheia>
  );
}
