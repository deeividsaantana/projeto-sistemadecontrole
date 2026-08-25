import React, { lazy, Suspense, useEffect, useState } from 'react';
import type {
  ApontamentoRamo,
  Empresa,
  Funcionario,
  GrupoEquipe,
  ObraLocal,
  TicketJazida,
} from './types';
import {
  getApontamentoTokenFromUrl,
  getPresenceTokenFromUrl,
  getTicketAccessTokenFromUrl,
  isTicketLinkUrl,
} from './app/routing/publicRoutes';
import { ScreenLoadingFallback } from './shared/components/feedback/ScreenLoadingFallback';
import {
  loadPublicApontamentoConfig,
  loadPublicPresenceConfig,
  reservePublicTicketNumberViaApi,
  savePublicTicketViaApi,
  searchPendingPublicTickets,
  submitPublicApontamento,
  submitPublicPresence,
  validatePublicTicketAccess,
  type PublicApontamentoPayload,
} from './publicApi';

const PresencaTempoRealPublica = lazy(() => import('./components/PresencaTempoRealPublica'));
const ApontamentoRamoLinkExterno = lazy(() => import('./components/ApontamentoRamoLinkExterno'));
const TicketLinkExterno = lazy(() => import('./components/TicketLinkExterno'));

const emptyTickets: TicketJazida[] = [];

export default function PublicLinksApp() {
  const presenceToken = getPresenceTokenFromUrl();
  const apontamentoToken = getApontamentoTokenFromUrl();
  const ticketAccessToken = getTicketAccessTokenFromUrl();
  const ticketLink = isTicketLinkUrl();

  const [gruposEquipe, setGruposEquipe] = useState<GrupoEquipe[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [obras, setObras] = useState<ObraLocal[]>([]);
  const [presenceLoading, setPresenceLoading] = useState(Boolean(presenceToken));
  const [presenceError, setPresenceError] = useState('');

  const [ramos, setRamos] = useState<ApontamentoRamo[]>([]);
  const [apontamentoLoading, setApontamentoLoading] = useState(Boolean(apontamentoToken));

  const [ticketLoading, setTicketLoading] = useState(Boolean(ticketLink));
  const [ticketError, setTicketError] = useState('');

  const reloadPresence = async () => {
    if (!presenceToken) return;
    setPresenceLoading(true);
    setPresenceError('');
    try {
      const config = await loadPublicPresenceConfig(presenceToken);
      setGruposEquipe(config.gruposEquipe);
      setFuncionarios(config.funcionarios);
      setEmpresas(config.empresas || []);
      setObras(config.obras);
    } catch (error) {
      setPresenceError(error instanceof Error ? error.message : 'Não foi possível carregar as equipes.');
    } finally {
      setPresenceLoading(false);
    }
  };

  useEffect(() => {
    void reloadPresence();
  }, [presenceToken]);

  useEffect(() => {
    if (!apontamentoToken) return;
    let cancelled = false;
    setApontamentoLoading(true);
    loadPublicApontamentoConfig(apontamentoToken)
      .then(config => {
        if (!cancelled) setRamos(config.ramos);
      })
      .catch(error => {
        console.error('Falha ao carregar link público de apontamento:', error);
        if (!cancelled) setRamos([]);
      })
      .finally(() => {
        if (!cancelled) setApontamentoLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apontamentoToken]);

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
          empresas={empresas}
          obras={obras}
          isLoadingCloud={presenceLoading}
          loadError={presenceError}
          onRetry={() => void reloadPresence()}
          onSubmitPresenca={(grupo, data, items) => submitPublicPresence(presenceToken, grupo.id, data, items)}
        />
      </Suspense>
    );
  }

  if (apontamentoToken) {
    return (
      <Suspense fallback={<ScreenLoadingFallback label="Abrindo apontamento..." />}>
        <ApontamentoRamoLinkExterno
          token={apontamentoToken}
          ramos={ramos}
          registros={[]}
          isLoadingCloud={apontamentoLoading}
          onSubmitApontamento={(ramo, payload: PublicApontamentoPayload) =>
            submitPublicApontamento(apontamentoToken, ramo.id, payload)}
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
