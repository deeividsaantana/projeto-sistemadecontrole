import { createContext, useContext, type ReactNode } from 'react';
import type { PessoaComAvatar } from '../../services/masterDataApi';

const PessoasContext = createContext<readonly PessoaComAvatar[]>([]);

/** Deixa a lista de pessoas (nome, cor e foto) à mão de qualquer tela. */
export function PessoasProvider({ pessoas, children }: { pessoas: readonly PessoaComAvatar[]; children: ReactNode }) {
  return <PessoasContext.Provider value={pessoas}>{children}</PessoasContext.Provider>;
}

export const usePessoas = () => useContext(PessoasContext);
