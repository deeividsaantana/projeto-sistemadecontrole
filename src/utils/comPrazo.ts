/**
 * Espera uma promessa por no máximo `ms`. Passou do prazo, rejeita com
 * `mensagem`, para a tela sair do "carregando" e dizer o que fazer.
 */
export const comPrazo = <T>(promessa: Promise<T>, ms: number, mensagem: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const prazo = new Promise<never>((_, rejeitar) => {
    timer = setTimeout(() => rejeitar(new Error(mensagem)), ms);
  });
  return Promise.race([promessa, prazo]).finally(() => clearTimeout(timer));
};

/** Quanto o login espera o Supabase antes de devolver a pessoa à tela de entrar. */
export const PRAZO_VALIDACAO_ACESSO_MS = 20_000;
