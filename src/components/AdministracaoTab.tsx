/**
 * Administração: saúde do armazenamento, registro das coleções e o acesso das
 * pessoas. A checagem de registro é a mesma que roda nos testes — uma coleção
 * nova que ficar fora do backup ou da sincronização aparece aqui em vez de
 * sumir silenciosamente.
 *
 * Histórico de ações e Permissões eram telas próprias que nenhum perfil
 * conseguia abrir (os botões daqui caíam no Painel). Viraram seções desta aba.
 *
 * A gestão de usuários mora aqui porque esta é a única aba de administração no
 * menu. A tela existia solta, sem rota e sem item de menu: ninguém conseguia
 * criar um acesso pelo sistema. Quem decide se a criação vale é o servidor
 * (assertAdministrator); esta tela é só o caminho até lá.
 */
import { useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { AlertTriangle, CheckCircle2, ClipboardCopy, Database, HardDrive, History, KeyRound, LayoutDashboard, Link2, MessageCircle, Plus, RotateCcw, ShieldCheck } from 'lucide-react';
import UsuariosTab from './UsuariosTab';
import HistoricoAcoes from './administracao/HistoricoAcoes';
import MatrizPermissoes from './administracao/MatrizPermissoes';
import { INTERMEDIATE_TABLE_IDS } from '../cloud/types';
import {
  divergenciasDeRegistro,
  formatarBytes,
  resumoArmazenamento,
  volumePorColecao,
  type VolumeColecao,
} from '../utils/diagnostico';
import { APP_VERSION_LABEL } from '../app/version';
import { PageHeader, TabelaPadrao, type ColunaTabela } from '../shared/ui';
import { AbasDaTela, idDaAba } from '../shared/ui/AbasDaTela';
import { TelaCheia } from '../shared/ui/TelaCheia';
import { generateSecurePublicToken } from '../utils/publicLinkSecurity';
import type { GrupoEquipe, HistoryLog } from '../types';

type Secao = 'geral' | 'acessos' | 'dados' | 'historico' | 'permissoes';

// Cada assunto numa aba do topo: antes Acessos e a tabela de dados ficavam
// empilhados na Visão geral, numa página de quase 3.000 px.
const SECOES: Array<{ id: Secao; rotulo: string; curto?: string; icone: typeof History }> = [
  { id: 'geral', rotulo: 'Visão geral', curto: 'Geral', icone: LayoutDashboard },
  { id: 'acessos', rotulo: 'Acessos', icone: ShieldCheck },
  { id: 'dados', rotulo: 'Dados do aparelho', curto: 'Dados', icone: HardDrive },
  { id: 'historico', rotulo: 'Histórico', icone: History },
  { id: 'permissoes', rotulo: 'Permissões', icone: KeyRound },
];

interface AdministracaoTabProps {
  ultimaSincronizacao: string;
  nuvemConectada: boolean;
  totalUsuarios?: number;
  gruposEquipe?: GrupoEquipe[];
  onSaveGrupoEquipe?: (grupo: GrupoEquipe, isNew: boolean) => void;
  logs?: HistoryLog[];
}

const COLUNAS_VOLUME: ColunaTabela<VolumeColecao>[] = [
  { chave: 'colecao', titulo: 'Coleção', larguraMinima: 180, valorOrdenacao: item => item.colecao, render: item => <strong className="text-slate-900">{item.colecao}</strong>, dica: item => item.colecao },
  { chave: 'chave', titulo: 'Chave', valorOrdenacao: item => item.chave, render: item => <span className="font-mono text-xs text-slate-600">{item.chave}</span>, dica: item => item.chave, noCartao: false },
  { chave: 'registros', titulo: 'Registros', alinhamento: 'direita', valorOrdenacao: item => item.registros, render: item => item.registros.toLocaleString('pt-BR') },
  { chave: 'tamanho', titulo: 'Tamanho', alinhamento: 'direita', valorOrdenacao: item => item.bytes, render: item => formatarBytes(item.bytes) },
];

export default function AdministracaoTab({
  ultimaSincronizacao,
  nuvemConectada,
  totalUsuarios,
  gruposEquipe = [],
  onSaveGrupoEquipe,
  logs = [],
}: AdministracaoTabProps) {
  const escopo = useRef<HTMLElement>(null);
  const [secao, setSecao] = useState<Secao>('geral');
  const [linkFeedback, setLinkFeedback] = useState('');
  const volumes = useMemo(
    () => typeof localStorage === 'undefined' ? [] : volumePorColecao(localStorage),
    [],
  );
  const resumo = resumoArmazenamento(volumes);
  const divergencias = useMemo(() => divergenciasDeRegistro(INTERMEDIATE_TABLE_IDS), []);
  const activeGroups = useMemo(
    () => gruposEquipe.filter(group => group.status === 'ativo' && group.linkAtivo !== false),
    [gruposEquipe],
  );
  const linkHost = activeGroups.find(group => group.tokenGeral) || activeGroups[0];
  const generalToken = activeGroups.find(group => group.tokenGeral)?.tokenGeral || '';
  const generalLink = generalToken ? `${window.location.origin}/presenca-link/${encodeURIComponent(generalToken)}` : '';

  const copyGeneralLink = async () => {
    if (!generalLink) return;
    try {
      await navigator.clipboard.writeText(generalLink);
      setLinkFeedback('Link copiado.');
    } catch {
      setLinkFeedback(generalLink);
    }
  };

  const renewGeneralLink = () => {
    if (!linkHost || !onSaveGrupoEquipe) {
      setLinkFeedback('Crie uma equipe ativa antes de gerar o link geral.');
      return;
    }
    if (generalToken && !window.confirm('Renovar o link geral? O endereço atual deixará de funcionar.')) return;
    onSaveGrupoEquipe({
      ...linkHost,
      tokenGeral: `geral-${generateSecurePublicToken('presenca')}`,
      updatedAt: new Date().toISOString(),
    }, false);
    setLinkFeedback(generalToken ? 'Link geral renovado.' : 'Link geral criado.');
  };

  useGSAP(() => {
    const raiz = escopo.current;
    if (!raiz || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(raiz.querySelectorAll('[data-admin-reveal]'), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.06, ease: 'power3.out', clearProps: 'transform,opacity' });
  }, { scope: escopo, dependencies: [secao] });

  return (
    <TelaCheia ref={escopo} id="administracao-tab" rotulo="Administração"
      longa={secao !== 'dados'} idAbaAtiva={idDaAba('administracao', secao)} idDados="administracao-dados" chaveRolagem={secao}
      cabecalho={<div data-admin-reveal>
        <PageHeader
          eyebrow="Só administrador"
          title="Administração"
          abas={<AbasDaTela<Secao> id="administracao" rotulo="Seções da administração" abas={SECOES} ativa={secao} onTrocar={setSecao} idPainel="administracao-dados" testId="administracao-aba" />}
        />
      </div>}
    >
      {secao === 'historico' && <HistoricoAcoes logs={logs} />}

      {secao === 'permissoes' && <MatrizPermissoes />}

      {secao === 'dados' && (
        <TabelaPadrao
          titulo="Dados guardados neste aparelho, por coleção"
          linhas={volumes}
          colunas={COLUNAS_VOLUME}
          idDaLinha={item => item.chave}
          nomeDoItem={{ um: 'coleção', varios: 'coleções' }}
          vazio="Nenhum dado guardado neste aparelho."
        />
      )}

      {secao === 'acessos' && (
        <section data-admin-reveal aria-labelledby="administracao-acessos-titulo" className="space-y-3">
          <div>
            <h2 id="administracao-acessos-titulo" className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-slate-700">
              <ShieldCheck className="h-4 w-4 text-emerald-700" aria-hidden="true" /> Acessos ao sistema
            </h2>
            <p className="mt-1 text-xs text-slate-600">Criar um acesso, trocar o perfil de alguém ou inativar quem saiu da obra.</p>
            {totalUsuarios !== undefined && (
              <p className="mt-1 flex items-center gap-2 text-xs text-slate-600">
                <Database className="h-3.5 w-3.5" aria-hidden="true" /> {totalUsuarios} usuário(s) cadastrado(s) no acesso corporativo.
              </p>
            )}
          </div>
          <UsuariosTab embutido />
        </section>
      )}

      {secao === 'geral' && (<>

      <section data-admin-reveal className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5" aria-labelledby="presence-public-link-title">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-50 text-emerald-700"><Link2 className="h-5 w-5" /></span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-emerald-800">Presença em campo</p>
              <h2 id="presence-public-link-title" className="text-base font-black text-slate-900">Link oficial de registro</h2>
            </div>
          </div>
          {generalToken && <button type="button" onClick={renewGeneralLink} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:border-emerald-500 hover:text-emerald-700"><RotateCcw className="h-3.5 w-3.5" />Renovar link</button>}
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-600">Endereço administrativo para compartilhar o lançamento de presença com os responsáveis de campo.</p>
        {generalLink ? (
          <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
            <input readOnly value={generalLink} className="min-h-11 min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 font-mono text-xs text-slate-700" />
            <button type="button" onClick={() => void copyGeneralLink()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-bold text-slate-700 hover:border-emerald-500"><ClipboardCopy className="h-4 w-4" />Copiar</button>
            <button type="button" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Registre a presença da sua equipe: ${generalLink}`)}`, '_blank', 'noopener,noreferrer')} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800"><MessageCircle className="h-4 w-4" />WhatsApp</button>
          </div>
        ) : (
          <button type="button" onClick={renewGeneralLink} className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800"><Plus className="h-4 w-4" />Criar link geral</button>
        )}
        {linkFeedback && <p role="status" className="mt-2 text-xs font-semibold text-emerald-800">{linkFeedback}</p>}
      </section>

      <div data-admin-reveal className={`rounded-lg border px-4 py-3 ${divergencias.length === 0 ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
        {divergencias.length === 0 ? (
          <p className="flex items-center gap-2 text-xs font-bold text-emerald-900">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            Todas as coleções de dados estão no backup e na sincronização com a nuvem.
          </p>
        ) : (
          <>
            <p className="flex items-center gap-2 text-xs font-bold text-rose-900">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
              {divergencias.length} coleção(ões) mal registrada(s) — dado gravado aqui pode não chegar à nuvem
            </p>
            <ul className="mt-1 space-y-0.5 text-xs text-rose-800">
              {divergencias.map(item => (
                <li key={`${item.colecao}-${item.problema}`}>{item.colecao}: {item.problema}</li>
              ))}
            </ul>
          </>
        )}
      </div>

      <section data-admin-reveal aria-label="Armazenamento neste aparelho" className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {[
          { label: 'Coleções', valor: String(resumo.colecoes) },
          { label: 'Registros', valor: resumo.registros.toLocaleString('pt-BR') },
          { label: 'Uso local', valor: formatarBytes(resumo.bytes) },
          { label: 'Coleções vazias', valor: String(resumo.vazias) },
        ].map(item => (
          <div key={item.label} className="min-w-0 rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-xs font-bold uppercase leading-tight tracking-wide text-slate-500">{item.label}</p>
            <strong className="mt-1.5 block truncate text-xl font-black tabular-nums text-slate-900">{item.valor}</strong>
          </div>
        ))}
      </section>

      <section data-admin-reveal aria-label="Versão e sincronização" className="grid gap-2.5 sm:grid-cols-3">
        {[
          { label: 'Versão', valor: APP_VERSION_LABEL },
          { label: 'Nuvem', valor: nuvemConectada ? 'Conectada' : 'Sem conexão' },
          { label: 'Última sincronização', valor: ultimaSincronizacao || 'Ainda não sincronizou nesta sessão' },
        ].map(item => (
          <div key={item.label} className="min-w-0 rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{item.label}</p>
            <strong className="mt-1 block truncate text-sm font-bold text-slate-800">{item.valor}</strong>
          </div>
        ))}
      </section>

      <button type="button" onClick={() => setSecao('dados')} className="inline-flex min-h-10 w-fit items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 hover:border-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--renea-focus)">
        <HardDrive className="h-4 w-4" aria-hidden="true" /> Ver os dados por coleção
      </button>
      </>)}
    </TelaCheia>
  );
}
