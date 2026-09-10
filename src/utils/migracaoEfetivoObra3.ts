import type { FrenteServico, Funcionario, GrupoEquipe } from '../types';

/**
 * Aplica o efetivo do EFETIVO_OBRA_3 em quem já usa o sistema.
 *
 * A semente de `initialData` só roda no primeiro acesso de cada navegador, e
 * quem já tinha o RENEA aberto ficaria com as equipes antigas para sempre.
 * Esta migração roda uma vez por navegador, e é escrita para não destruir
 * nada:
 *
 * - Colaborador que não veio na planilha **não é apagado**, fica inativo: o
 *   histórico de presença e de produção aponta para ele.
 * - Equipe cujo encarregado já existia **mantém id e token**. O token é o link
 *   público de presença que o encarregado tem no celular; trocar o token
 *   quebraria o link em campo.
 * - Equipe cujo encarregado saiu vira inativa, com o token preservado, em vez
 *   de sumir junto com o histórico que aponta para ela.
 * - Frente de serviço existente nunca é sobrescrita: só entram as que faltam.
 */
export interface EfetivoMigrado {
  funcionarios: Funcionario[];
  grupos: GrupoEquipe[];
  frentes: FrenteServico[];
  resumo: {
    atualizados: number;
    incluidos: number;
    inativados: number;
    equipesReaproveitadas: number;
    equipesNovas: number;
    equipesInativadas: number;
    frentesIncluidas: number;
  };
}

const porMatricula = (lista: Funcionario[]) => new Map(
  lista.filter(item => item?.matricula).map(item => [String(item.matricula).trim(), item]),
);

export const migrarEfetivoObra3 = (
  funcionariosLocais: Funcionario[],
  gruposLocais: GrupoEquipe[],
  frentesLocais: FrenteServico[],
  funcionariosSemente: Funcionario[],
  gruposSemente: GrupoEquipe[],
  frentesSemente: FrenteServico[],
): EfetivoMigrado => {
  const locais = porMatricula(funcionariosLocais);
  const daPlanilha = new Set(funcionariosSemente.map(item => String(item.matricula).trim()));

  let atualizados = 0;
  let incluidos = 0;
  const funcionarios: Funcionario[] = funcionariosSemente.map(novo => {
    const antigo = locais.get(String(novo.matricula).trim());
    if (!antigo) { incluidos += 1; return novo; }
    atualizados += 1;
    // O RH manda nos campos de RH; o que era só do sistema (id antigo, vínculos
    // que a tela criou) continua no registro.
    return { ...antigo, ...novo, id: antigo.id };
  });

  let inativados = 0;
  for (const antigo of funcionariosLocais) {
    const matricula = String(antigo?.matricula || '').trim();
    if (!matricula || daPlanilha.has(matricula)) continue;
    if (antigo.ativo !== false) inativados += 1;
    funcionarios.push({ ...antigo, ativo: false });
  }

  const idPorMatricula = new Map(funcionarios.map(item => [String(item.matricula).trim(), item.id]));
  const grupoPorLider = new Map(
    gruposLocais.filter(item => item?.liderMatricula).map(item => [String(item.liderMatricula).trim(), item]),
  );
  const lideresDaPlanilha = new Set(gruposSemente.map(item => String(item.liderMatricula || '').trim()));

  let equipesReaproveitadas = 0;
  let equipesNovas = 0;
  const grupos: GrupoEquipe[] = gruposSemente.map(novo => {
    const matriculas = novo.funcionarioMatriculas || [];
    const funcionarioIds = matriculas.map(matricula => idPorMatricula.get(String(matricula).trim()))
      .filter((valor): valor is string => Boolean(valor));
    const antigo = grupoPorLider.get(String(novo.liderMatricula || '').trim());
    if (!antigo) { equipesNovas += 1; return { ...novo, funcionarioIds }; }
    equipesReaproveitadas += 1;
    return {
      ...novo,
      id: antigo.id,
      token: antigo.token,
      tokenGeral: antigo.tokenGeral,
      linkAtivo: antigo.linkAtivo,
      createdAt: antigo.createdAt || novo.createdAt,
      funcionarioIds,
    };
  });

  let equipesInativadas = 0;
  for (const antigo of gruposLocais) {
    const lider = String(antigo?.liderMatricula || '').trim();
    if (lider && lideresDaPlanilha.has(lider)) continue;
    if (antigo.status !== 'inativo') equipesInativadas += 1;
    grupos.push({ ...antigo, status: 'inativo' });
  }

  const nomesDeFrente = new Set(frentesLocais.map(item => String(item?.nome || '').trim().toLowerCase()));
  const frentesIncluidas = frentesSemente.filter(item => !nomesDeFrente.has(item.nome.trim().toLowerCase()));
  const frentes = [...frentesLocais, ...frentesIncluidas];

  return {
    funcionarios,
    grupos,
    frentes,
    resumo: {
      atualizados, incluidos, inativados,
      equipesReaproveitadas, equipesNovas, equipesInativadas,
      frentesIncluidas: frentesIncluidas.length,
    },
  };
};
