/**
 * Parte Apontadores de Materiais: cada envio do link do campo com os materiais
 * e as fotos, e o resumo por apontador. Só lê os movimentos: o envio já virou
 * saída de consumo quando o ERP incorporou a fila.
 */
import type { MovimentoMaterial } from '../../types';
import { normalizeComparable } from '../../utils/canonicalIdentity';

export const SEM_NOME = 'Sem nome';

export interface ItemEnvio {
  movimentoId: string;
  material: string;
  quantidade: number;
  unidade: string;
}

export interface EnvioCampo {
  id: string;
  data: string;
  enviadoEm: string;
  ramo: string;
  apontador: string;
  itens: ItemEnvio[];
  fotos: string[];
  observacao: string;
  /** Todos os movimentos do envio, inclusive os já desfeitos (para não desfazer duas vezes). */
  movimentos: MovimentoMaterial[];
}

export interface FiltroEnvios {
  de: string;
  ate: string;
  apontador: string;
  ramo: string;
}

/** Nome do apontador como a pessoa escreveu, sem espaço sobrando; vazio vira "Sem nome". */
export const nomeDoApontador = (item: MovimentoMaterial) => (item.apontadoPor || '').trim().replace(/\s+/g, ' ') || SEM_NOME;

const ramoDo = (item: MovimentoMaterial) => item.etapaServicoNome || item.destino || 'Ramo sem nome';

/**
 * Envios do link, do mais novo para o mais antigo. Envio com todos os itens
 * desfeitos some; envio com parte desfeita mostra só o que vale.
 */
export const enviosDoCampo = (movimentos: readonly MovimentoMaterial[], filtro?: Partial<FiltroEnvios>): EnvioCampo[] => {
  const envios = new Map<string, EnvioCampo>();
  for (const item of movimentos) {
    const id = item.origemApontamentoId;
    if (!id) continue;
    let envio = envios.get(id);
    if (!envio) {
      envio = { id, data: item.data, enviadoEm: item.criadoEm || '', ramo: ramoDo(item), apontador: nomeDoApontador(item), itens: [], fotos: [], observacao: item.observacao?.trim() || '', movimentos: [] };
      envios.set(id, envio);
    }
    envio.movimentos.push(item);
    if (item.canceladoEm) continue;
    envio.itens.push({ movimentoId: item.id, material: item.materialDescricao.trim() || 'Sem material', quantidade: Math.abs(Number(item.quantidade) || 0), unidade: item.unidade.trim() });
    for (const foto of item.fotos || []) if (!envio.fotos.includes(foto)) envio.fotos.push(foto);
  }
  const apontador = normalizeComparable(filtro?.apontador || '');
  const ramo = normalizeComparable(filtro?.ramo || '');
  return [...envios.values()]
    .filter(envio => envio.itens.length > 0
      && (!filtro?.de || envio.data >= filtro.de)
      && (!filtro?.ate || envio.data <= filtro.ate)
      && (!apontador || normalizeComparable(envio.apontador) === apontador)
      && (!ramo || normalizeComparable(envio.ramo) === ramo))
    .sort((a, b) => b.data.localeCompare(a.data) || b.enviadoEm.localeCompare(a.enviadoEm));
};

export interface ResumoApontador {
  chave: string;
  nome: string;
  envios: number;
  dias: number;
  itens: number;
  fotos: number;
  /** Envios que mandaram pelo menos uma foto. */
  comFoto: number;
  ramos: string[];
  ultimo: string;
  ultimoEnviadoEm: string;
}

/** Um por apontador (mesmo nome escrito com maiúscula diferente conta junto), quem mais mandou primeiro. */
export const resumoPorApontador = (envios: readonly EnvioCampo[]): ResumoApontador[] => {
  const pessoas = new Map<string, ResumoApontador & { diasVistos: Set<string> }>();
  for (const envio of envios) {
    const chave = normalizeComparable(envio.apontador);
    const pessoa = pessoas.get(chave) ?? { chave, nome: envio.apontador, envios: 0, dias: 0, itens: 0, fotos: 0, comFoto: 0, ramos: [], ultimo: '', ultimoEnviadoEm: '', diasVistos: new Set<string>() };
    pessoa.envios += 1;
    pessoa.itens += envio.itens.length;
    pessoa.fotos += envio.fotos.length;
    if (envio.fotos.length) pessoa.comFoto += 1;
    pessoa.diasVistos.add(envio.data);
    if (!pessoa.ramos.includes(envio.ramo)) pessoa.ramos.push(envio.ramo);
    if (envio.data > pessoa.ultimo || (envio.data === pessoa.ultimo && envio.enviadoEm > pessoa.ultimoEnviadoEm)) {
      pessoa.ultimo = envio.data;
      pessoa.ultimoEnviadoEm = envio.enviadoEm;
    }
    pessoas.set(chave, pessoa);
  }
  return [...pessoas.values()]
    .map(({ diasVistos, ...pessoa }) => ({ ...pessoa, dias: diasVistos.size, ramos: [...pessoa.ramos].sort((a, b) => a.localeCompare(b, 'pt-BR')) }))
    .sort((a, b) => b.envios - a.envios || b.ultimo.localeCompare(a.ultimo) || a.nome.localeCompare(b.nome, 'pt-BR'));
};

/** Quem já apareceu em algum envio e ainda não mandou nada no dia. */
export const semEnvioNoDia = (todos: readonly EnvioCampo[], dia: string) => {
  const mandaram = new Set(todos.filter(envio => envio.data === dia).map(envio => normalizeComparable(envio.apontador)));
  return resumoPorApontador(todos)
    .filter(pessoa => pessoa.nome !== SEM_NOME && !mandaram.has(pessoa.chave))
    .map(pessoa => pessoa.nome);
};

/** Mensagem pronta para mandar o link pelo WhatsApp. */
export const mensagemDoLink = (url: string) => [
  'Link para apontar o uso de material na obra (RENEA):',
  url,
  '',
  '1. Escreva seu nome.',
  '2. Escolha o ramo onde o material foi aplicado.',
  '3. Diga quanto usou de cada material e tire a foto.',
  '4. Toque em Salvar uso.',
].join('\n');
