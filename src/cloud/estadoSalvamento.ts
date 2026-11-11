// Estado do salvamento que a pessoa vê no topo: o dado sempre fica salvo neste
// aparelho primeiro; a nuvem vem depois e pode demorar ou falhar. Esta regra é
// pura para o texto ser o mesmo no computador e no celular e poder ser testada.
export type EstadoSalvamento = 'sincronizado' | 'enviando' | 'aguardando' | 'falhou' | 'sem-conexao';

export interface EntradaSalvamento {
  /** navigator.onLine */
  online: boolean;
  /** Último contato com a nuvem deu certo. */
  conectado: boolean;
  /** Há um envio em andamento agora. */
  enviando: boolean;
  /** Há lançamento salvo neste aparelho que ainda não chegou à nuvem. */
  pendente: boolean;
  /** Envios seguidos que falharam (0 quando o último deu certo). */
  falhasSeguidas: number;
  /** Comandos na fila offline aguardando envio. */
  pendenciasOffline?: number;
}

export interface DescricaoSalvamento {
  estado: EstadoSalvamento;
  /** Texto completo, para o topo no computador. */
  rotulo: string;
  /** Texto curto, para o celular. */
  curto: string;
  /** Frase que explica o que aconteceu com o dado e o que fazer. */
  detalhe: string;
  /** Mostra o botão "Tentar novamente". */
  tentarNovamente: boolean;
}

export function descreverSalvamento(entrada: EntradaSalvamento): DescricaoSalvamento {
  const semEnviar = entrada.pendente || (entrada.pendenciasOffline ?? 0) > 0;
  if (entrada.enviando) {
    return { estado: 'enviando', rotulo: 'Enviando para a nuvem…', curto: 'Enviando…', detalhe: 'Salvo neste aparelho. Enviando para a nuvem agora.', tentarNovamente: false };
  }
  if (!entrada.online) {
    return {
      estado: 'sem-conexao',
      rotulo: semEnviar ? 'Sem internet: salvo no aparelho' : 'Sem internet',
      curto: 'Sem rede',
      detalhe: semEnviar ? 'Sem internet. O que você lançou está salvo neste aparelho e vai para a nuvem quando a conexão voltar.' : 'Sem internet no momento.',
      tentarNovamente: false,
    };
  }
  if (entrada.pendente && entrada.falhasSeguidas > 0) {
    return { estado: 'falhou', rotulo: 'Não chegou à nuvem', curto: 'Falhou', detalhe: 'Salvo neste aparelho, mas ainda não chegou à nuvem. Toque em Tentar novamente.', tentarNovamente: true };
  }
  if (semEnviar) {
    return { estado: 'aguardando', rotulo: 'Salvo no aparelho, aguardando a nuvem', curto: 'No aparelho', detalhe: 'Salvo neste aparelho. Ainda não chegou à nuvem.', tentarNovamente: false };
  }
  if (!entrada.conectado) {
    return { estado: 'sem-conexao', rotulo: 'Sem conexão com a nuvem', curto: 'Sem nuvem', detalhe: 'Sem conexão com a nuvem no momento.', tentarNovamente: false };
  }
  return { estado: 'sincronizado', rotulo: 'Sincronizado', curto: 'Nuvem OK', detalhe: 'Tudo salvo na nuvem.', tentarNovamente: false };
}
