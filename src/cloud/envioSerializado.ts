// Lançamento rápido: cada salvamento regrava o bloco inteiro da obra no banco.
// Vários envios ao mesmo tempo formavam fila e derrubavam a API. Aqui só um
// envio roda por vez; o que for pedido no meio dele vira UM envio a mais, logo
// depois, com tudo o que foi lançado nesse tempo.
export const PAUSA_ENTRE_ENVIOS_MS = 1_000;

export type ResultadoEnvio = { success: boolean; message: string };

export function criarEnvioSerializado(
  enviar: () => Promise<ResultadoEnvio>,
  { pausaMs = PAUSA_ENTRE_ENVIOS_MS, segurar = () => {}, soltar = () => {} }: {
    pausaMs?: number;
    segurar?: () => void;
    soltar?: () => void;
  } = {},
) {
  let rodando = false;
  let pedidoNoMeio = false;

  return async function pedirEnvio(): Promise<ResultadoEnvio> {
    if (rodando) {
      pedidoNoMeio = true;
      return { success: true, message: 'Vai subir junto com o envio que está em andamento.' };
    }
    rodando = true;
    try {
      let resultado = await enviar();
      while (pedidoNoMeio) {
        pedidoNoMeio = false;
        // A pausa deixa juntar mais lançamentos e o sinal de envio em andamento
        // continua ligado, para a sincronização automática não baixar nada antigo.
        segurar();
        try {
          await new Promise(resolver => setTimeout(resolver, pausaMs));
        } finally {
          soltar();
        }
        resultado = await enviar();
      }
      return resultado;
    } finally {
      rodando = false;
    }
  };
}
