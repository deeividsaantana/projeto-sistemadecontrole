/**
 * Administração: saúde do armazenamento, registro das coleções e o acesso das
 * pessoas. A checagem de registro é a mesma que roda nos testes — uma coleção
 * nova que ficar fora do backup ou da sincronização aparece aqui em vez de
 * sumir silenciosamente.
 *
 * A gestão de usuários mora aqui porque esta é a única aba de administração no
 * menu. A tela existia solta, sem rota e sem item de menu: ninguém conseguia
 * criar um acesso pelo sistema. Quem decide se a criação vale é o servidor
 * (assertAdministrator); esta tela é só o caminho até lá.
 */
import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardCopy, Database, Link2, MessageCircle, Plus, RotateCcw, ShieldCheck } from 'lucide-react';
import UsuariosTab from './UsuariosTab';
import { INTERMEDIATE_TABLE_IDS } from '../firebaseCloudSync';
import {
  divergenciasDeRegistro,
  formatarBytes,
  resumoArmazenamento,
  volumePorColecao,
} from '../utils/diagnostico';
import { APP_VERSION_LABEL } from '../app/version';
import { PageHeader, TableBody, TableHead, TableShell } from '../shared/ui';
import { generateSecurePublicToken } from '../utils/publicLinkSecurity';
import type { GrupoEquipe } from '../types';

interface AdministracaoTabProps {
  ultimaSincronizacao: string;
  nuvemConectada: boolean;
  totalUsuarios?: number;
  gruposEquipe?: GrupoEquipe[];
  onSaveGrupoEquipe?: (grupo: GrupoEquipe, isNew: boolean) => void;
  onNavigate: (tab: string) => void;
}

export default function AdministracaoTab({
  ultimaSincronizacao,
  nuvemConectada,
  totalUsuarios,
  gruposEquipe = [],
  onSaveGrupoEquipe,
  onNavigate,
}: AdministracaoTabProps) {
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

  return (
    <div id="administracao-tab" className="min-h-full w-full bg-[#f7f8f6] px-4 pb-12 pt-6 sm:px-7 lg:px-9">
      <PageHeader
        title="Administração"
        description="Saúde do armazenamento, registro das coleções e estado da sincronização."
      />

      <section className="mt-4 rounded-lg border border-slate-200 bg-white p-4 sm:p-5" aria-labelledby="presence-public-link-title">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-50 text-emerald-700"><Link2 className="h-5 w-5" /></span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-800">Presença em campo</p>
              <h2 id="presence-public-link-title" className="text-base font-black text-slate-900">Link oficial de registro</h2>
            </div>
          </div>
          {generalToken && <button type="button" onClick={renewGeneralLink} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:border-emerald-500 hover:text-emerald-700"><RotateCcw className="h-3.5 w-3.5" />Renovar link</button>}
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-500">Endereço administrativo para compartilhar o lançamento de presença com os responsáveis de campo.</p>
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

      <div className={`mt-4 rounded-lg border px-4 py-3 ${divergencias.length === 0 ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
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
            <ul className="mt-1 space-y-0.5 text-[11px] text-rose-800">
              {divergencias.map(item => (
                <li key={`${item.colecao}-${item.problema}`}>{item.colecao}: {item.problema}</li>
              ))}
            </ul>
          </>
        )}
      </div>

      <section className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {[
          { label: 'Coleções', valor: String(resumo.colecoes) },
          { label: 'Registros', valor: resumo.registros.toLocaleString('pt-BR') },
          { label: 'Uso local', valor: formatarBytes(resumo.bytes) },
          { label: 'Coleções vazias', valor: String(resumo.vazias) },
        ].map(item => (
          <div key={item.label} className="min-w-0 rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-[10px] font-bold uppercase leading-tight tracking-wide text-slate-500">{item.label}</p>
            <strong className="mt-1.5 block truncate text-xl font-black tabular-nums text-slate-900">{item.valor}</strong>
          </div>
        ))}
      </section>

      <section className="mt-4 grid gap-2.5 sm:grid-cols-3">
        {[
          { label: 'Versão', valor: APP_VERSION_LABEL },
          { label: 'Nuvem', valor: nuvemConectada ? 'Conectada' : 'Sem conexão' },
          { label: 'Última sincronização', valor: ultimaSincronizacao || 'Ainda não sincronizou nesta sessão' },
        ].map(item => (
          <div key={item.label} className="min-w-0 rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{item.label}</p>
            <strong className="mt-1 block truncate text-sm font-bold text-slate-800">{item.valor}</strong>
          </div>
        ))}
      </section>

      <div className="mt-4 flex flex-wrap gap-2">
        {[
          ['configuracoes', 'Backup, importação e usuários'],
          ['auditoria', 'Histórico de ações'],
          ['permissoes', 'Matriz de permissões'],
          ['cadastros', 'Cadastros auxiliares'],
        ].map(([tab, rotulo]) => (
          <button
            key={tab}
            type="button"
            onClick={() => onNavigate(tab)}
            className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition-colors hover:border-emerald-500 hover:text-emerald-700"
          >
            {rotulo}
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <TableShell minWidth={620}>
          <TableHead>
            <tr>
              <th className="p-3">Coleção</th>
              <th className="p-3">Chave</th>
              <th className="p-3">Registros</th>
              <th className="p-3">Tamanho</th>
            </tr>
          </TableHead>
          <TableBody>
            {volumes.map(item => (
              <tr key={item.chave} className="transition-colors hover:bg-slate-50">
                <td className="p-3 font-bold text-slate-800">{item.colecao}</td>
                <td className="p-3 font-mono text-[11px] text-slate-500">{item.chave}</td>
                <td className="p-3 font-mono text-slate-700">{item.registros.toLocaleString('pt-BR')}</td>
                <td className="p-3 font-mono text-slate-700">{formatarBytes(item.bytes)}</td>
              </tr>
            ))}
          </TableBody>
        </TableShell>
      </div>

      <section className="mt-6">
        <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-slate-700">
          <ShieldCheck className="h-4 w-4 text-emerald-700" /> Acessos ao sistema
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Criar um acesso, trocar o perfil de alguém ou inativar quem saiu da obra.
        </p>
        <div className="mt-3">
          <UsuariosTab embutido />
        </div>
      </section>

      {totalUsuarios !== undefined && (
        <p className="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
          <Database className="h-3.5 w-3.5" /> {totalUsuarios} usuário(s) cadastrado(s) no acesso corporativo.
        </p>
      )}
    </div>
  );
}
