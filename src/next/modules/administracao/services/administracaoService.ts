import { getFornecedoresPorCategoria, getPessoas, getRamos } from '../../../services/repositories/administracaoRepository';

// Síncrono hoje (cache local); assinatura async já pronta pro Supabase.
export const fetchCadastros = async () => ({
  pessoas: getPessoas(),
  fornecedoresPorCategoria: getFornecedoresPorCategoria(),
  ramos: getRamos(),
});
