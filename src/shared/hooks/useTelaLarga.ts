import { useEffect, useState } from 'react';

const TELA_LARGA = '(min-width: 768px)';
const ehTelaLarga = () => typeof window === 'undefined' || typeof window.matchMedia !== 'function' || window.matchMedia(TELA_LARGA).matches;

/**
 * Computador (768 px ou mais) ou celular. Serve para desenhar só a tabela ou
 * só os cartões: as duas juntas, escondendo uma por CSS, dobravam o peso da
 * lista.
 */
export const useTelaLarga = () => {
  const [larga, setLarga] = useState(ehTelaLarga);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const consulta = window.matchMedia(TELA_LARGA);
    const mudar = () => setLarga(consulta.matches);
    consulta.addEventListener('change', mudar);
    return () => consulta.removeEventListener('change', mudar);
  }, []);
  return larga;
};
