import { useEffect, useState } from 'react';

/**
 * Primeiro acesso pela tela de entrada (18/11/2026): ao digitar o e-mail, o
 * servidor diz se o login ainda não tem senha da pessoa. Se não tem, a tela
 * troca o campo de senha por "Crie sua senha". Ver api/primeiro-acesso.js.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const chamar = async <T,>(corpo: Record<string, unknown>): Promise<T> => {
  const resposta = await fetch('/api/primeiro-acesso', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(corpo),
    cache: 'no-store',
  }).catch(() => { throw new Error('Sem conexão com o servidor. Confira a internet e tente de novo.'); });
  const json = await resposta.json().catch(() => ({})) as { success?: boolean; data?: T; message?: string };
  if (!resposta.ok || json.success !== true) throw new Error(json.message || 'Não foi possível concluir. Tente de novo.');
  return json.data as T;
};

export const criarMinhaSenha = (email: string, senha: string, repetida: string) =>
  chamar<{ email: string }>({ action: 'criar', email: email.trim().toLowerCase(), senha, repetida });

/** true quando o e-mail digitado é de um login que ainda espera a senha da pessoa. */
export const usePrecisaCriarSenha = (email: string, esperaMs = 450) => {
  const [precisa, setPrecisa] = useState(false);
  const normalizado = email.trim().toLowerCase();
  useEffect(() => {
    if (!EMAIL.test(normalizado)) { setPrecisa(false); return; }
    let vivo = true;
    const espera = window.setTimeout(() => {
      chamar<{ criarSenha: boolean }>({ action: 'verificar', email: normalizado })
        .then(resposta => { if (vivo) setPrecisa(resposta.criarSenha === true); })
        .catch(() => { if (vivo) setPrecisa(false); });
    }, esperaMs);
    return () => { vivo = false; window.clearTimeout(espera); };
  }, [normalizado, esperaMs]);
  return precisa;
};
