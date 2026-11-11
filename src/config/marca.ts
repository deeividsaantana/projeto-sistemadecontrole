/**
 * Quem é quem na tela. O sistema é um produto próprio (Cintravyse), um ERP
 * de obras que atende empresas; a RENEA é a empresa cliente que usa o
 * sistema, não a dona dele (pedido do usuário em 10/11/2026). O nome de cada
 * um mora aqui, para trocar num lugar só.
 */
export const PRODUTO = {
  nome: 'Cintravyse',
  descricao: 'ERP para obras de infraestrutura',
} as const;

/** Empresa cliente deste ambiente. Aparece como "ambiente" e nos relatórios que ela recebe. */
export const CLIENTE = {
  nome: 'RENEA Infraestrutura',
  nomeCurto: 'RENEA',
} as const;
