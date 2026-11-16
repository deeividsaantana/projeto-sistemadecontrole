// Solicitação de Contratação no preview: as mesmas regras do servidor
// (api/_shared/contratacao-regras.js) sobre dados de exemplo em memória.
// ?papel=gerente_1|gerente_2|rh|auxiliar|admin|solicitante escolhe quem está "logado".
import { ETAPAS, CARGO_DA_ETAPA, emAberto, pedidoVisivel, podeDecidir, validarFormulario } from '../api/_shared/contratacao-regras.js';
import type { AssinaturaContratacao, AssinaturaEnviada, DadosContratacao, DadosDoLink, Etapa, FormularioContratacao, Leitor, PapelContratacao, PedidoContratacao, PessoaContratacao, Titulares } from '../src/services/contratacaoApi';
export type * from '../src/services/contratacaoApi';

const papel = new URLSearchParams(location.search).get('papel') || 'admin';
const PESSOAS: Record<string, Leitor> = {
  solicitante: { userId: 'u-giulia', nome: 'Giulia Yukari', admin: false, papeis: [] },
  gerente_1: { userId: 'u-bruno', nome: 'Bruno Luscher', admin: false, papeis: ['gerente_1'] },
  gerente_2: { userId: 'u-marcelo', nome: 'Marcelo Suegama', admin: false, papeis: ['gerente_2'] },
  rh: { userId: 'u-lucas', nome: 'Lucas Oliveira', admin: false, papeis: ['rh'] },
  auxiliar: { userId: 'u-paulo', nome: 'Paulo de Tarso', admin: false, papeis: ['auxiliar'] },
  admin: { userId: 'u-deivid', nome: 'Deivid Brandão', admin: true, papeis: [] },
};
const eu = PESSOAS[papel] ?? PESSOAS.admin;
const titulares: Titulares = { gerente_1: ['Bruno Luscher'], gerente_2: ['Marcelo Suegama'], rh: ['Lucas Oliveira'] };
const QUEM: Record<Etapa, Leitor> = { gerente_1: PESSOAS.gerente_1, gerente_2: PESSOAS.gerente_2, rh: PESSOAS.rh };

const traco = (texto: string) => {
  const canvas = document.createElement('canvas');
  canvas.width = 300; canvas.height = 90;
  const ctx = canvas.getContext('2d')!;
  ctx.font = 'italic 34px serif'; ctx.fillStyle = '#0f172a'; ctx.fillText(texto, 12, 58);
  return canvas.toDataURL('image/png');
};
const hashFalso = (semente: string) => Array.from({ length: 64 }, (_, i) => '0123456789abcdef'[(semente.charCodeAt(i % semente.length) * (i + 7)) % 16]).join('');
const assinatura = (stage: Etapa, quem: Leitor, quando: string, metodo: AssinaturaEnviada = { method: 'desenho', image_data: traco(quem.nome.split(' ')[0]) }): AssinaturaContratacao => ({
  id: `${stage}-${quando}`, stage, signer_user_id: quem.userId, signer_name: quem.nome, signer_cargo: CARGO_DA_ETAPA[stage],
  method: metodo.method, image_data: metodo.image_data ?? null, form_hash: 'a1b2c3d4e5f6a7b8', signed_at: quando, hash_validacao: hashFalso(`${stage}${quando}`),
});
const situacao = (feitas: number): PedidoContratacao['status'] => (feitas >= 3 ? 'concluido' : (`etapa_${feitas + 1}` as PedidoContratacao['status']));
const base = (n: number, candidato: string, posicao: string, area: string, feitas: number, dias: number, recusada = false): PedidoContratacao => {
  const criado = new Date(Date.now() - dias * 86_400_000).toISOString();
  const signatures = (ETAPAS as Etapa[]).slice(0, feitas).map((etapa, i) => assinatura(etapa, QUEM[etapa], new Date(Date.parse(criado) + (i + 1) * 7_200_000).toISOString()));
  const status = recusada ? 'recusada' : situacao(feitas);
  return {
    id: `p${n}`, request_number: `CONT-2026-${String(n).padStart(4, '0')}`, requester_user_id: PESSOAS.solicitante.userId, requester_name: PESSOAS.solicitante.nome,
    form: { data: criado.slice(0, 10), candidato, cpf: '52998224725', inicio: '2026-12-01', prioridade: 'Alta', motivo: n % 2 ? 'aumento' : 'substituicao', motivoOutro: '', tipo: 'efetivo', posicao, quantidade: 1, salario: 'R$ 3.200,00 + VR', requisitante: 'Giulia Yukari', area, itens: ['alojamento', 'celular'], obs: '', aprovados: '', comentarios: '' },
    form_hash: 'a1b2c3d4e5f6a7b8c9d0', status, etapa_atual: emAberto(status) ? (feitas + 1) as 1 | 2 | 3 : null,
    link_token: emAberto(status) ? hashFalso(`tok${n}`) : null, concluded_at: status === 'concluido' ? criado : null,
    rejected_stage: recusada ? ETAPAS[feitas] as Etapa : null, rejection_reason: recusada ? 'Vaga já preenchida por transferência.' : null,
    version: feitas + 1, created_at: criado, updated_at: criado, signatures,
    history: [{ actor_name: PESSOAS.solicitante.nome, action: 'abriu', from_status: null, to_status: 'etapa_1', details: {}, created_at: criado },
      ...signatures.map(item => ({ actor_name: item.signer_name, action: `assinou_${item.stage}`, from_status: null, to_status: null, details: {}, created_at: item.signed_at }))],
  };
};
let pedidos: PedidoContratacao[] = [
  base(6, 'João Pereira da Silva', 'Operador de escavadeira', 'Complexo Viário Alto Tietê', 0, 0),
  base(5, 'Carlos Henrique Souza', 'Encarregado de terraplenagem', 'Complexo Viário Alto Tietê', 1, 2),
  base(4, 'Ana Beatriz Lima', 'Auxiliar administrativo', 'Escritório central', 2, 3),
  base(3, 'Marcos Antônio Rocha', 'Motorista de caminhão', 'Obra 3 - Mogi', 3, 8),
  base(2, 'Fernanda Alves', 'Topógrafa', 'Obra 3 - Mogi', 0, 5, true),
];
let pessoas: PessoaContratacao[] = Object.values(PESSOAS).map(p => ({ user_id: p.userId, name: p.nome, email: `${p.nome.split(' ')[0].toLowerCase()}@renea.com.br`, roles: p.papeis }));

export const carregarContratacoes = async (): Promise<DadosContratacao> => ({
  me: eu, titulares, requests: pedidos.filter(p => pedidoVisivel(p, eu)), people: eu.admin ? pessoas : undefined,
});
/** No preview, ?link=<n> abre o pedido pN como se fosse pelo link individual. */
export const carregarPeloLink = async (token: string): Promise<DadosDoLink> => {
  const pedido = pedidos.find(p => p.id === `p${token}`);
  if (!pedido) throw new Error('Link inválido. Confira se copiou o link inteiro.');
  if (!emAberto(pedido.status)) return { me: eu, expirado: pedido.status === 'recusada' ? 'recusada' : 'concluido' };
  return { me: eu, titulares, request: pedido };
};
export const criarContratacao = async (form: FormularioContratacao) => {
  const { formulario, erros } = validarFormulario(form);
  if (Object.keys(erros).length) throw new Error(Object.values(erros)[0]);
  const novo: PedidoContratacao = { ...base(pedidos.length + 2, formulario.candidato, formulario.posicao, formulario.area, 0, 0), form: formulario as FormularioContratacao, requester_user_id: eu.userId, requester_name: eu.nome };
  pedidos = [novo, ...pedidos];
  return novo;
};
export const decidirContratacao = async (pedido: Pick<PedidoContratacao, 'id'>, decisao: 'aprovar' | 'recusar', signature?: AssinaturaEnviada, reason?: string) => {
  pedidos = pedidos.map(p => {
    if (p.id !== pedido.id) return p;
    if (!podeDecidir(p, p.signatures, eu)) throw new Error('Aguardando assinatura prioritária de outra pessoa.');
    const etapa = ETAPAS[(p.etapa_atual ?? 1) - 1] as Etapa;
    if (decisao === 'recusar') return { ...p, status: 'recusada', etapa_atual: null, link_token: null, rejected_stage: etapa, rejection_reason: reason ?? '' };
    const signatures = [...p.signatures, assinatura(etapa, eu, new Date().toISOString(), signature)];
    const status = situacao(signatures.length);
    return { ...p, status, etapa_atual: emAberto(status) ? (signatures.length + 1) as 1 | 2 | 3 : null, link_token: emAberto(status) ? p.link_token : null, version: p.version + 1, signatures };
  });
  return pedidos.find(p => p.id === pedido.id)!;
};
export const definirPapelContratacao = async (userId: string, role: PapelContratacao, active: boolean) => {
  pessoas = pessoas.map(p => (p.user_id === userId ? { ...p, roles: active ? [...p.roles, role] : p.roles.filter(r => r !== role) } : p));
};
export const linkDoPedido = (token: string) => `${window.location.origin}/contratacao-link/${token}`;
