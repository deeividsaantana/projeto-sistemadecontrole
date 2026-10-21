import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClient } from './client';
import { resolveSupabaseClientConfig } from './config';

const EVENTO = 'nova-versao';

let canal: RealtimeChannel | undefined;
let conectado = false;
const ouvintes = new Set<(versao: string) => void>();
const aoReconectar = new Set<() => void>();

/**
 * Canal por organização onde cada aparelho avisa que publicou uma versão nova.
 * Só vai a versão (updated_at), nunca os dados: quem recebe baixa da nuvem
 * pelo caminho de sempre, com todas as travas do download.
 */
const abrirCanal = (): RealtimeChannel => {
  if (canal) return canal;
  const organizacao = resolveSupabaseClientConfig().organizationId;
  canal = getSupabaseClient()
    .channel(`erp-snapshot-${organizacao}`, { config: { broadcast: { self: false } } })
    .on('broadcast', { event: EVENTO }, mensagem => {
      const versao = String((mensagem.payload as { versao?: unknown } | undefined)?.versao ?? '');
      if (versao) ouvintes.forEach(ouvinte => ouvinte(versao));
    })
    .subscribe(status => {
      const estava = conectado;
      conectado = status === 'SUBSCRIBED';
      // Avisos enviados enquanto o canal estava caído se perderam: confere a nuvem.
      if (conectado && !estava) aoReconectar.forEach(funcao => funcao());
    });
  return canal;
};

export const ouvirNovasVersoes = (onVersao: (versao: string) => void, onReconectar: () => void) => {
  ouvintes.add(onVersao);
  aoReconectar.add(onReconectar);
  abrirCanal();
  return () => {
    ouvintes.delete(onVersao);
    aoReconectar.delete(onReconectar);
    if (ouvintes.size === 0 && canal) {
      void getSupabaseClient().removeChannel(canal);
      canal = undefined;
      conectado = false;
    }
  };
};

/** Avisa os outros aparelhos; se o canal estiver fora, a checagem periódica cobre. */
export const avisarNovaVersao = (versao: string) => {
  if (!versao) return;
  void abrirCanal().send({ type: 'broadcast', event: EVENTO, payload: { versao } }).catch(() => undefined);
};
