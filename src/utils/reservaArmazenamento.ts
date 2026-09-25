import { isStorageQuotaExceededError } from './resilientStorage';

type ArmazenamentoBasico = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/**
 * Quando a memória do navegador enche, gravar no armazenamento local falha.
 * O app seguia com a tela certa, mas o envio para a nuvem lê o armazenamento
 * local: publicava a cópia antiga por cima e apagava da nuvem o que tinha
 * acabado de ser lançado ou recuperado (presença voltando de 46 para 18,
 * abastecimentos e materiais sumindo).
 *
 * Aqui o valor que não coube fica guardado em memória e toda leitura passa a
 * devolvê-lo, então o envio publica o que está na tela. Ao recarregar a
 * página, o app baixa da nuvem o que foi publicado.
 */
export const instalarReservaEmMemoria = (
  armazenamento: ArmazenamentoBasico,
  aoEncher: (chave: string) => void = () => undefined,
): Map<string, string | null> => {
  const reserva = new Map<string, string | null>();
  const gravar = armazenamento.setItem.bind(armazenamento);
  const ler = armazenamento.getItem.bind(armazenamento);
  const remover = armazenamento.removeItem.bind(armazenamento);

  const substituir = <K extends keyof ArmazenamentoBasico>(nome: K, funcao: ArmazenamentoBasico[K]) => {
    Object.defineProperty(armazenamento, nome, { value: funcao, configurable: true, writable: true });
  };

  substituir('setItem', (chave: string, valor: string) => {
    try {
      gravar(chave, valor);
      reserva.delete(chave);
    } catch (erro) {
      if (!isStorageQuotaExceededError(erro)) throw erro;
      reserva.set(chave, String(valor));
      aoEncher(chave);
    }
  });
  substituir('getItem', (chave: string) => (reserva.has(chave) ? reserva.get(chave) ?? null : ler(chave)));
  substituir('removeItem', (chave: string) => {
    reserva.delete(chave);
    remover(chave);
  });
  return reserva;
};
