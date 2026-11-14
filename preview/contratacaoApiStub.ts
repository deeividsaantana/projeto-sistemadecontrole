// Solicitação de Contratação no preview: o mesmo filtro do servidor
// (api/_shared/contratacao-regras.js) sobre dados de exemplo em memória.
// ?papel=rh|gerente|auxiliar|admin|solicitante escolhe quem está "logado".
import { assinaturasVisiveis, pedidoVisivel, validarFormulario } from '../api/_shared/contratacao-regras.js';
import type { AssinaturaEnviada, DadosContratacao, FormularioContratacao, Leitor, PapelContratacao, PedidoContratacao, PessoaContratacao } from '../src/services/contratacaoApi';
export type * from '../src/services/contratacaoApi';

const papel = new URLSearchParams(location.search).get('papel') || 'admin';
const PESSOAS: Record<string, Leitor> = {
  solicitante: { userId: 'u-thiago', nome: 'Thiago Mendes', admin: false, papeis: [] },
  rh: { userId: 'u-ana', nome: 'Ana Paula (RH)', admin: false, papeis: ['rh'] },
  gerente: { userId: 'u-bruno', nome: 'Bruno Luscher', admin: false, papeis: ['gerente'] },
  auxiliar: { userId: 'u-giulia', nome: 'Giulia Yukari', admin: false, papeis: ['auxiliar'] },
  admin: { userId: 'u-deivid', nome: 'Deivid Brandão', admin: true, papeis: [] },
};
const eu = PESSOAS[papel] ?? PESSOAS.admin;

const traco = (texto: string) => {
  const canvas = document.createElement('canvas');
  canvas.width = 300; canvas.height = 90;
  const ctx = canvas.getContext('2d')!;
  ctx.font = 'italic 34px serif'; ctx.fillStyle = '#0f172a'; ctx.fillText(texto, 12, 58);
  return canvas.toDataURL('image/png');
};
const assinatura = (stage: 'solicitante' | 'rh' | 'gerente', quem: Leitor, quando: string) => ({
  id: `${stage}-${quando}`, stage, signer_user_id: quem.userId, signer_name: quem.nome, method: 'desenho' as const,
  image_data: traco(quem.nome.split(' ')[0]), form_hash: 'a1b2c3d4e5f6a7b8', signed_at: quando,
});
const base = (n: number, posicao: string, area: string, prioridade: string, status: PedidoContratacao['status'], dias: number): PedidoContratacao => {
  const criado = new Date(Date.now() - dias * 86_400_000).toISOString();
  const assinaturas = [assinatura('solicitante', PESSOAS.solicitante, criado)];
  if (status !== 'aguardando_rh' && !(status === 'recusada' && n === 4)) assinaturas.push(assinatura('rh', PESSOAS.rh, new Date(Date.parse(criado) + 7_200_000).toISOString()));
  if (status === 'aprovada') assinaturas.push(assinatura('gerente', PESSOAS.gerente, new Date(Date.parse(criado) + 86_400_000).toISOString()));
  return {
    id: `p${n}`, request_number: `CONT-2026-${String(n).padStart(4, '0')}`, requester_user_id: PESSOAS.solicitante.userId, requester_name: PESSOAS.solicitante.nome,
    form: { data: criado.slice(0, 10), prioridade, motivo: n % 2 ? 'aumento' : 'substituicao', motivoOutro: '', tipo: 'efetivo', posicao, quantidade: n % 3 + 1, salario: 'R$ 3.200,00', requisitante: 'Thiago Mendes', area, itens: ['alojamento', 'celular'], obs: '', aprovados: '', comentarios: '' },
    form_hash: 'a1b2c3d4e5f6a7b8c9d0', status, rejected_stage: status === 'recusada' ? 'rh' : null, rejection_reason: status === 'recusada' ? 'Vaga já preenchida por transferência.' : null,
    version: assinaturas.length, created_at: criado, updated_at: criado, signatures: assinaturas,
    history: assinaturas.map(item => ({ actor_name: item.signer_name, action: item.stage === 'solicitante' ? 'criou_e_assinou' : `assinou_${item.stage}`, from_status: null, to_status: item.stage === 'solicitante' ? 'aguardando_rh' : item.stage === 'rh' ? 'aguardando_gerente' : 'aprovada', details: {}, created_at: item.signed_at })),
  };
};
let pedidos: PedidoContratacao[] = [
  base(6, 'Operador de escavadeira', 'Complexo Viário Alto Tietê', 'Alta', 'aguardando_rh', 0),
  base(5, 'Encarregado de terraplenagem', 'Complexo Viário Alto Tietê', 'Média', 'aguardando_gerente', 3),
  base(4, 'Auxiliar administrativo', 'Escritório central', 'Baixa', 'recusada', 5),
  base(3, 'Motorista de caminhão', 'Obra 3 - Mogi', 'Alta', 'aprovada', 8),
  base(2, 'Topógrafo', 'Obra 3 - Mogi', 'Média', 'aguardando_rh', 4),
];
let pessoas: PessoaContratacao[] = Object.values(PESSOAS).map(p => ({ user_id: p.userId, name: p.nome, email: `${p.nome.split(' ')[0].toLowerCase()}@renea.com.br`, roles: p.papeis }));

const vista = (): DadosContratacao => ({
  me: eu,
  requests: pedidos.filter(p => pedidoVisivel(p, eu)).map(p => ({ ...p, signatures: assinaturasVisiveis(p, p.signatures, eu) })),
  people: eu.admin ? pessoas : undefined,
});

export const carregarContratacoes = async () => vista();
export const criarContratacao = async (form: FormularioContratacao, signature: AssinaturaEnviada) => {
  const { formulario, erros } = validarFormulario(form);
  if (Object.keys(erros).length) throw new Error(Object.values(erros)[0]);
  const n = pedidos.length + 2;
  const agora = new Date().toISOString();
  const novo: PedidoContratacao = { ...base(n, formulario.posicao, formulario.area, formulario.prioridade, 'aguardando_rh', 0), form: formulario as FormularioContratacao, requester_user_id: eu.userId, requester_name: eu.nome,
    signatures: [{ ...assinatura('solicitante', eu, agora), method: signature.method, image_data: signature.image_data ?? null }] };
  pedidos = [novo, ...pedidos];
  return novo;
};
export const decidirContratacao = async (pedido: Pick<PedidoContratacao, 'id'>, decisao: 'aprovar' | 'recusar', signature?: AssinaturaEnviada, reason?: string) => {
  pedidos = pedidos.map(p => {
    if (p.id !== pedido.id) return p;
    const etapa = p.status === 'aguardando_rh' ? 'rh' : 'gerente';
    if (decisao === 'recusar') return { ...p, status: 'recusada', rejected_stage: etapa, rejection_reason: reason ?? '' };
    return { ...p, status: etapa === 'rh' ? 'aguardando_gerente' : 'aprovada', version: p.version + 1,
      signatures: [...p.signatures, { ...assinatura(etapa, eu, new Date().toISOString()), method: signature!.method, image_data: signature!.image_data ?? null }] };
  });
  return pedidos.find(p => p.id === pedido.id)!;
};
export const definirPapelContratacao = async (userId: string, role: PapelContratacao, active: boolean) => {
  pessoas = pessoas.map(p => (p.user_id === userId ? { ...p, roles: active ? [...p.roles, role] : p.roles.filter(r => r !== role) } : p));
};
