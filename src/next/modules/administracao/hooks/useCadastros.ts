import { useQuery } from '@tanstack/react-query';
import { fetchCadastros } from '../services/administracaoService';

export const useCadastros = () =>
  useQuery({
    queryKey: ['administracao-cadastros'],
    queryFn: fetchCadastros,
  });
