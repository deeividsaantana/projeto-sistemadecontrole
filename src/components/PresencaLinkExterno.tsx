import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock, Search, Send, ShieldCheck, UserCheck, Users } from 'lucide-react';
import { motion } from 'motion/react';
import { Funcionario, GrupoEquipe, ObraLocal, PresencaApontamento, PresencaStatus } from '../types';
import reneaLogo from '../assets/images/logo-renea-branco.svg';
import './publicLinks.css';

// O prefixo identifica o modo de seleção de equipe. A autorização continua
// dependendo do valor aleatório completo salvo no cadastro, nunca do prefixo.
export const isGeneralPresenceToken = (value: string) => value.startsWith('geral-');

const STATUS_OPTIONS: PresencaStatus[] = [
  'Presente',
  'Ausente',
  'Falta justificada',
  'Atestado',
  'Férias',
  'Afastado',
  'Outro'
];

interface PresencaLinkExternoProps {
  token: string;
  gruposEquipe: GrupoEquipe[];
  funcionarios: Funcionario[];
  obras: ObraLocal[];
  presencasLink: PresencaApontamento[];
  isLoadingCloud: boolean;
  onSubmitPresenca: (
    grupo: GrupoEquipe,
    data: string,
    items: Array<{ funcionarioId: string; status: PresencaStatus; observacao: string }>
  ) => Promise<{ success: boolean; message: string }>;
}

const todayInput = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().split('T')[0];
};

export default function PresencaLinkExterno({
  token,
  gruposEquipe,
  funcionarios,
  obras,
  isLoadingCloud,
  onSubmitPresenca
}: PresencaLinkExternoProps) {
  const [data, setData] = useState(todayInput());
  const [items, setItems] = useState<Record<string, { status: PresencaStatus; observacao: string }>>({});
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modo "link único": a pessoa escolhe a aba do grupo dela em vez de
  // depender de um link individual por equipe.
  const isGeneralLink = isGeneralPresenceToken(token);
  const [selectedGrupoId, setSelectedGrupoId] = useState<string>('');
  const [grupoSearch, setGrupoSearch] = useState('');

  const activeGroups = useMemo(
    () => gruposEquipe.filter(item => item.status === 'ativo' && item.linkAtivo),
    [gruposEquipe]
  );

  const filteredActiveGroups = useMemo(() => {
    const term = grupoSearch.trim().toLowerCase();
    if (!term) return activeGroups;
    return activeGroups.filter(
      item =>
        item.nome.toLowerCase().includes(term) ||
        item.responsavel.toLowerCase().includes(term) ||
        item.frenteServico.toLowerCase().includes(term)
    );
  }, [activeGroups, grupoSearch]);

  const grupo = useMemo(() => {
    if (isGeneralLink) {
      return activeGroups.find(item => item.id === selectedGrupoId);
    }
    return gruposEquipe.find(item => item.token === token && item.status === 'ativo' && item.linkAtivo);
  }, [activeGroups, gruposEquipe, isGeneralLink, selectedGrupoId, token]);

  const groupEmployees = useMemo(() => {
    if (!grupo) return [];
    return grupo.funcionarioIds
      .map(id => funcionarios.find(func => func.id === id))
      .filter(Boolean) as Funcionario[];
  }, [funcionarios, grupo]);

  const obraNome = useMemo(() => {
    if (!grupo?.obraId) return grupo?.frenteServico || '';
    return obras.find(obra => obra.id === grupo.obraId)?.nome || grupo.frenteServico;
  }, [grupo, obras]);

  useEffect(() => {
    if (!grupo) return;
    const initial: Record<string, { status: PresencaStatus; observacao: string }> = {};
    grupo.funcionarioIds.forEach(id => {
      initial[id] = { status: 'Presente', observacao: '' };
    });
    setItems(initial);
  }, [grupo]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!grupo || isSubmitting) return;
    setIsSubmitting(true);
    setFeedback(null);
    const result = await onSubmitPresenca(
      grupo,
      data,
      groupEmployees.map(func => ({
        funcionarioId: func.id,
        status: items[func.id]?.status || 'Presente',
        observacao: items[func.id]?.observacao || ''
      }))
    );
    setFeedback({ type: result.success ? 'success' : 'error', message: result.message });
    setIsSubmitting(false);
  };

  if (isLoadingCloud && gruposEquipe.length === 0) {
    return (
      <div className="public-link-light flex min-h-screen items-center justify-center p-4">
        <div className="text-center">
          <Clock className="w-8 h-8 text-emerald-400 mx-auto animate-spin" />
          <p className="text-sm text-slate-400 mt-3">Carregando dados do Sistema Renea...</p>
        </div>
      </div>
    );
  }

  if (!grupo) {
    if (isGeneralLink) {
      return (
        <div id="presenca-publica" className="public-link-light antialiased">
          <header className="public-link-topbar px-4 py-4 shadow-lg">
            <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
              <img src={reneaLogo} alt="RENEA" className="h-8 w-auto object-contain" />
              <div className="text-right">
                <p className="text-xs font-black uppercase text-emerald-400">Presença digital</p>
                <p className="text-[11px] text-slate-400">Link geral de equipes</p>
              </div>
            </div>
          </header>
          <motion.main
            className="mx-auto max-w-2xl px-4 py-6 sm:py-8"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          >
            <section className="mb-5">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase text-emerald-700">
                <ShieldCheck className="h-4 w-4" /> Link seguro
              </div>
              <h1 className="mt-1 text-2xl font-black text-slate-950">Escolha sua equipe</h1>
              <p className="mt-1 text-sm text-slate-500">Selecione o grupo responsável para iniciar a presença.</p>
            </section>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  value={grupoSearch}
                  onChange={e => setGrupoSearch(e.target.value)}
                  placeholder="Buscar por grupo, responsável ou frente de serviço"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
                />
              </div>

              {filteredActiveGroups.length === 0 ? (
                <div className="text-center py-8">
                  <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
                  <p className="text-sm text-slate-400 mt-3">Nenhum grupo ativo encontrado.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredActiveGroups.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedGrupoId(item.id)}
                      className="w-full text-left bg-slate-950 border border-slate-800 hover:border-emerald-500 rounded-2xl p-4 transition-colors flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-black text-white truncate">{item.nome}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                          {item.responsavel} • {item.frenteServico}
                        </p>
                      </div>
                      <span className="text-[10px] font-black text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-1 shrink-0">
                        {item.funcionarioIds.length} pessoa(s)
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.main>
        </div>
      );
    }

    return (
      <div className="public-link-light flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
          <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
          <h1 className="text-xl font-black text-white mt-4">Link indisponível</h1>
          <p className="text-sm text-slate-400 mt-2">
            O link de presença não foi encontrado, está inativo ou foi recriado pelo administrador.
          </p>
        </div>
      </div>
    );
  }

  const presentCount = (Object.values(items) as Array<{ status: PresencaStatus; observacao: string }>)
    .filter(item => item.status === 'Presente').length;

  return (
    <div id="presenca-publica" className="public-link-light antialiased">
      <header className="public-link-topbar px-4 py-4 shadow-lg">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <img src={reneaLogo} alt="RENEA" className="h-8 w-auto object-contain" />
          <div className="min-w-0 text-right">
            <p className="text-xs font-black uppercase text-emerald-400">Presença digital</p>
            <p className="truncate text-[11px] text-slate-400">{grupo.nome}</p>
          </div>
        </div>
      </header>
      <motion.main
        className="mx-auto max-w-3xl px-4 py-6 sm:py-8"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        <section className="mb-5 flex items-start justify-between gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase text-emerald-700">
                <ShieldCheck className="w-4 h-4" />
                Link seguro
              </div>
              <h1 className="mt-1 text-2xl font-black text-slate-950">Presença da equipe</h1>
              <p className="mt-1 text-sm text-slate-500">Confira o grupo e registre a situação de cada funcionário.</p>
            </div>
            {isGeneralLink && (
              <button
                type="button"
                onClick={() => setSelectedGrupoId('')}
                className="shrink-0 p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200"
                title="Trocar grupo"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
          </div>
        </section>

        <form onSubmit={handleSubmit} className="space-y-4">
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-slate-500 font-black">Nome da obra</p>
                <p className="text-sm font-bold text-white mt-1">{obraNome}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-slate-500 font-black">Grupo</p>
                <p className="text-sm font-bold text-white mt-1">{grupo.nome}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-slate-500 font-black">Responsável</p>
                <p className="text-sm font-bold text-white mt-1">{grupo.responsavel}</p>
              </div>
              <label>
                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-black">Data do apontamento</span>
                <input
                  type="date"
                  value={data}
                  onChange={e => setData(e.target.value)}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
                />
              </label>
            </div>
          </section>

          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-black text-white">Funcionários do grupo</h2>
              </div>
              <span className="text-[10px] font-black text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-1">
                {presentCount}/{groupEmployees.length} presentes
              </span>
            </div>

            <div className="space-y-3">
              {groupEmployees.map(func => (
                <div key={func.id} className="bg-slate-950 border border-slate-800 rounded-2xl p-3 space-y-3">
                  <div>
                    <p className="text-sm font-black text-white">{func.nome}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {func.matricula ? `MAT. ${func.matricula} • ` : ''}{func.cargo}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {STATUS_OPTIONS.map(status => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setItems(prev => ({ ...prev, [func.id]: { ...prev[func.id], status } }))}
                        className={`min-h-10 rounded-xl border px-2 text-[11px] font-black transition-colors ${
                          items[func.id]?.status === status
                            ? 'bg-emerald-600 border-emerald-500 text-white'
                            : 'bg-slate-900 border-slate-800 text-slate-300'
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>

                  <textarea
                    value={items[func.id]?.observacao || ''}
                    onChange={e => setItems(prev => ({ ...prev, [func.id]: { ...prev[func.id], observacao: e.target.value } }))}
                    placeholder="Observação opcional"
                    rows={2}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500 resize-none"
                  />
                </div>
              ))}
            </div>
          </section>

          {feedback && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 420, damping: 28 }}
              className={`flex items-start gap-3 rounded-lg border p-4 text-sm ${feedback.type === 'success' ? 'public-link-success' : 'public-link-error'}`}
            >
              {feedback.type === 'success' ? (
                <motion.span initial={{ scale: 0, rotate: -35 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 520, damping: 22 }}>
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                </motion.span>
              ) : <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />}
              <span>{feedback.message}</span>
            </motion.div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full min-h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-black text-sm flex items-center justify-center gap-2 transition-colors"
          >
            {isSubmitting ? <Clock className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            Enviar presença
          </button>
        </form>
      </motion.main>
    </div>
  );
}
