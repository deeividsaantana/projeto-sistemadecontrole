import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import type {
  Empresa,
  Funcionario,
  FuncionarioDisponivel,
  GrupoEquipe,
  ObraLocal,
  PresencaApontamento,
  TicketJazida,
} from './types';
import {
  getPresenceTokenFromUrl,
  getTicketAccessTokenFromUrl,
  isTicketLinkUrl,
} from './app/routing/publicRoutes';
import { ScreenLoadingFallback } from './shared/components/feedback/ScreenLoadingFallback';
import {
  addPublicPresenceMember,
  removePublicPresenceMember,
  updatePublicPresenceDayNote,
  loadPublicPresenceConfig,
  reservePublicTicketNumberViaApi,
  savePublicTicketViaApi,
  searchPendingPublicTickets,
  submitPublicPresence,
  updatePublicPresenceRecord,
  validatePublicTicketAccess,
} from './publicApi';

const PresencaTempoRealPublica = lazy(() => import('./components/PresencaTempoRealPublica'));
const TicketLinkExterno = lazy(() => import('./components/TicketLinkExterno'));

const emptyTickets: TicketJazida[] = [];

export default function PublicLinksApp() {
  const presenceToken = getPresenceTokenFromUrl();
  const ticketAccessToken = getTicketAccessTokenFromUrl();
  const ticketLink = isTicketLinkUrl();

  const [gruposEquipe, setGruposEquipe] = useState<GrupoEquipe[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [funcionariosDisponiveis, setFuncionariosDisponiveis] = useState<FuncionarioDisponivel[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [obras, setObras] = useState<ObraLocal[]>([]);
  const [meuGrupo, setMeuGrupo] = useState<GrupoEquipe | null>(null);
  const [meusRegistros, setMeusRegistros] = useState<PresencaApontamento[]>([]);
  const [datasDisponiveis, setDatasDisponiveis] = useState<string[]>([]);
  const [dataSelecionada, setDataSelecionada] = useState('');
  const [dataAtual, setDataAtual] = useState('');
  const [observacaoDia, setObservacaoDia] = useState('');
  const [presenceHistory, setPresenceHistory] = useState<Record<string, PresencaApontamento[]>>({});
  const [presenceDayNotes, setPresenceDayNotes] = useState<Record<string, string>>({});
  const [presenceLoading, setPresenceLoading] = useState(Boolean(presenceToken));
  const [presenceError, setPresenceError] = useState('');

  const [ticketLoading, setTicketLoading] = useState(Boolean(ticketLink));
  const [ticketError, setTicketError] = useState('');

  const reloadPresence = useCallback(async (data = '') => {
    if (!presenceToken) return;
    setPresenceLoading(true);
    setPresenceError('');
    try {
      const config = await loadPublicPresenceConfig(presenceToken, data);
      setGruposEquipe(config.gruposEquipe);
      setFuncionarios(config.funcionarios);
      setFuncionariosDisponiveis(config.funcionariosDisponiveis || []);
      setEmpresas(config.empresas || []);
      setObras(config.obras);
      setMeuGrupo(config.meuGrupo || null);
      setMeusRegistros(config.meusRegistros || []);
      setDatasDisponiveis(config.datasDisponiveis || []);
      setDataSelecionada(config.dataSelecionada || '');
      setDataAtual(config.dataAtual || '');
      setObservacaoDia(config.observacaoDia || '');
      setPresenceHistory(config.historicoPorData || { [config.dataSelecionada || '']: config.meusRegistros || [] });
      setPresenceDayNotes(config.observacoesPorData || { [config.dataSelecionada || '']: config.observacaoDia || '' });
    } catch (error) {
      setPresenceError(error instanceof Error ? error.message : 'Não foi possível carregar as equipes.');
    } finally {
      setPresenceLoading(false);
    }
  }, [presenceToken]);

  const selectPresenceDate = useCallback((data: string) => {
    setPresenceHistory(currentHistory => {
      if (Object.prototype.hasOwnProperty.call(currentHistory, data)) {
        setDataSelecionada(data);
        setMeusRegistros(currentHistory[data] || []);
        setPresenceDayNotes(currentNotes => {
          setObservacaoDia(currentNotes[data] || '');
          return currentNotes;
        });
      } else {
        void reloadPresence(data);
      }
      return currentHistory;
    });
  }, [reloadPresence]);

  // Identidade estavel: entregues como props pro link publico, permitem que
  // o cartao memoizado de cada colaborador ignore re-renderizacoes desta
  // pagina que nao tem nada a ver com o toque que a pessoa acabou de dar.
  const handleRetryPresence = useCallback(() => { void reloadPresence(); }, [reloadPresence]);

  const handleSubmitPresenca = useCallback((grupo: GrupoEquipe, data: string, items: Array<{ funcionarioId: string; status: PresencaApontamento['status']; observacao: string }>, nota: string) =>
    submitPublicPresence(presenceToken, grupo.id, data, items, nota), [presenceToken]);

  const handleUpdateRecord = useCallback((grupoId: string, funcionarioId: string, status: PresencaApontamento['status'], observacao: string) =>
    updatePublicPresenceRecord(presenceToken, grupoId, funcionarioId, status, observacao), [presenceToken]);

  const handleAddMember = useCallback((grupoId: string, funcionarioId: string) =>
    addPublicPresenceMember(presenceToken, grupoId, funcionarioId), [presenceToken]);

  const handleRemoveMember = useCallback(async (grupoId: string, funcionarioId: string) => {
    const response = await removePublicPresenceMember(presenceToken, grupoId, funcionarioId);
    if (response.success) {
      setGruposEquipe(current => current.map(group => group.id === grupoId
        ? { ...group, funcionarioIds: (group.funcionarioIds || []).filter(id => id !== funcionarioId) }
        : group));
      setMeuGrupo(current => current?.id === grupoId
        ? { ...current, funcionarioIds: (current.funcionarioIds || []).filter(id => id !== funcionarioId) }
        : current);
    }
    return response;
  }, [presenceToken]);

  const handleSaveDayNote = useCallback(async (grupoId: string, nota: string) => {
    const resposta = await updatePublicPresenceDayNote(presenceToken, grupoId, nota);
    setObservacaoDia(resposta.observacaoDia);
    return resposta;
  }, [presenceToken]);

  useEffect(() => {
    void reloadPresence();
  }, [reloadPresence]);

  useEffect(() => {
    if (!ticketLink) return;
    let cancelled = false;
    setTicketLoading(true);
    setTicketError('');
    validatePublicTicketAccess(ticketAccessToken)
      .catch(error => {
        if (!cancelled) {
          setTicketError(
            error instanceof Error
              ? error.message
              : 'Este link de tickets é inválido, expirou ou foi substituído.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setTicketLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ticketAccessToken, ticketLink]);

  if (ticketLink) {
    return (
      <Suspense fallback={<ScreenLoadingFallback label="Abrindo tickets..." />}>
        <TicketLinkExterno
          tickets={emptyTickets}
          isLoadingCloud={ticketLoading}
          loadError={ticketError}
          onReserveNumber={() => reservePublicTicketNumberViaApi(ticketAccessToken)}
          onSaveTicket={ticket => savePublicTicketViaApi(ticket, ticketAccessToken)}
          onSearchPendingReceipts={query => searchPendingPublicTickets(query, ticketAccessToken)}
        />
      </Suspense>
    );
  }

  if (presenceToken) {
    return (
      <Suspense fallback={<ScreenLoadingFallback label="Abrindo presença..." />}>
        <PresencaTempoRealPublica
          token={presenceToken}
          gruposEquipe={gruposEquipe}
          funcionarios={funcionarios}
          funcionariosDisponiveis={funcionariosDisponiveis}
          empresas={empresas}
          obras={obras}
          meuGrupo={meuGrupo}
          meusRegistros={meusRegistros}
          datasDisponiveis={datasDisponiveis}
          dataSelecionada={dataSelecionada}
          dataAtual={dataAtual}
          observacaoDia={observacaoDia}
          onSelectDate={selectPresenceDate}
          isLoadingCloud={presenceLoading}
          loadError={presenceError}
          onRetry={handleRetryPresence}
          onSubmitPresenca={handleSubmitPresenca}
          onUpdateRecord={handleUpdateRecord}
          onAddMember={handleAddMember}
          onRemoveMember={handleRemoveMember}
          onSaveDayNote={handleSaveDayNote}
        />
      </Suspense>
    );
  }


  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 p-6 text-white">
      <section className="max-w-md text-center">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">RENEA</p>
        <h1 className="mt-3 text-2xl font-black">Link público não encontrado</h1>
        <p className="mt-3 text-sm text-slate-300">
          Confira se o endereço recebido está completo ou solicite um novo link ao administrativo.
        </p>
      </section>
    </main>
  );
}
