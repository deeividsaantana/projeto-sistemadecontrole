import { getSupabaseClient } from './client';
import { regrasDasLinhas, type RegrasDeAcesso } from '../utils/regrasDeAcesso';

export interface MeuAcesso {
  ehDev: boolean;
  regras: RegrasDeAcesso;
}

const SEM_REGRAS: MeuAcesso = { ehDev: false, regras: {} };

/**
 * As próprias regras de aba e se a pessoa é dev. O RLS só devolve as linhas
 * do próprio login. Se as tabelas ainda não existem (SQL não rodado) ou a
 * leitura falha, vale o padrão do perfil e a aba Dev não aparece.
 */
export const carregarMeuAcesso = async (userId: string): Promise<MeuAcesso> => {
  try {
    const client = getSupabaseClient();
    const [dev, regras] = await Promise.all([
      client.from('erp_dev_owners').select('user_id').eq('user_id', userId).limit(1),
      client.from('erp_access_rules').select('tab, actions').eq('user_id', userId),
    ]);
    return {
      ehDev: !dev.error && (dev.data?.length ?? 0) > 0,
      regras: regras.error ? {} : regrasDasLinhas(regras.data),
    };
  } catch {
    return SEM_REGRAS;
  }
};
