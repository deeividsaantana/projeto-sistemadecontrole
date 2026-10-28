/**
 * Wrapper: PessoasPresenca com MemoryRouter interno
 * 
 * Permite usar React Router DENTRO do módulo sem depender de BrowserRouter global.
 * Compatible com o sistema de abas do App.tsx atual.
 */

import { MemoryRouter } from 'react-router-dom';
import PessoasPresenca from './index';
import type { ComponentProps } from 'react';

type PessoasPresencaProps = ComponentProps<typeof PessoasPresenca>;

export default function PessoasPresencaWrapper(props: PessoasPresencaProps) {
  return (
    <MemoryRouter initialEntries={['/pessoas/painel']} initialIndex={0}>
      <PessoasPresenca {...props} />
    </MemoryRouter>
  );
}
