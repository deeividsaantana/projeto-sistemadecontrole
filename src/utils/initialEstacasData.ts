import type { ControleEstacas } from '../types';

// Estacas começam vazias num navegador novo: os lotes e cravações vêm da nuvem
// no primeiro download.
export const INITIAL_CONTROLE_ESTACAS: ControleEstacas = { lotes: [], cravacoes: [] };
