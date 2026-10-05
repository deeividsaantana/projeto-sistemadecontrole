import type { AppNotification } from '../types';
import type { Alerta } from './alertas';

export interface PreferenciasNotificacao {
  /** Categorias de alerta que o usuário não quer ver no sino. */
  categoriasSilenciadas: string[];
  /** Mostrar avisos do próprio sistema (sincronização, importação). */
  mostrarSistema: boolean;
}

export const PREFERENCIAS_PADRAO: PreferenciasNotificacao = {
  categoriasSilenciadas: [],
  mostrarSistema: true,
};

/**
 * Preferência é do dispositivo, não da conta: fica no navegador e não vai para a
 * nuvem. Silenciar uma categoria no celular do encarregado não pode silenciar o
 * alerta na tela do gestor.
 */
export const CHAVE_PREFERENCIAS = 'renea_notificacoes_preferencias';

export const carregarPreferencias = (storage: Pick<Storage, 'getItem'>): PreferenciasNotificacao => {
  try {
    const bruto = storage.getItem(CHAVE_PREFERENCIAS);
    if (!bruto) return PREFERENCIAS_PADRAO;
    const dados = JSON.parse(bruto) as Partial<PreferenciasNotificacao>;
    return {
      categoriasSilenciadas: Array.isArray(dados.categoriasSilenciadas)
        ? dados.categoriasSilenciadas.filter(item => typeof item === 'string')
        : [],
      mostrarSistema: dados.mostrarSistema !== false,
    };
  } catch {
    return PREFERENCIAS_PADRAO;
  }
};

export const salvarPreferencias = (
  storage: Pick<Storage, 'setItem'>,
  preferencias: PreferenciasNotificacao,
) => {
  storage.setItem(CHAVE_PREFERENCIAS, JSON.stringify(preferencias));
};

/** Alertas que sobram depois das preferências do dispositivo. */
export const alertasVisiveis = (alertas: Alerta[], preferencias: PreferenciasNotificacao) =>
  alertas.filter(alerta => !preferencias.categoriasSilenciadas.includes(alerta.titulo));

export const notificacoesVisiveis = (
  notificacoes: AppNotification[],
  preferencias: PreferenciasNotificacao,
) => preferencias.mostrarSistema ? notificacoes : notificacoes.filter(item => item.source !== 'Sistema Local');

/** Agrupa por dia quando a notificação tem data; o resto entra em "Hoje". */
export const agruparNotificacoes = (notificacoes: AppNotification[], hoje: string) => {
  const mapa = new Map<string, AppNotification[]>();
  notificacoes.forEach(item => {
    const dia = /^\d{4}-\d{2}-\d{2}/.test(item.timestamp) ? item.timestamp.slice(0, 10) : hoje;
    mapa.set(dia, [...(mapa.get(dia) || []), item]);
  });
  return [...mapa.entries()].sort((a, b) => b[0].localeCompare(a[0]));
};

export const contarNaoLidas = (notificacoes: AppNotification[]) =>
  notificacoes.filter(item => !item.read).length;
