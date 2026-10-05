/**
 * Identidade da obra em um lugar só. Antes o nome estava escrito à mão em oito
 * arquivos — painel, controle diário, ticket da jazida, relatório de frota,
 * PDF diário, PDF semanal, Excel semanal e Excel operacional — e cada troca de
 * nome exigia caçar string por string, com o risco de sobrar a antiga num
 * relatório que o cliente recebe.
 */
export const OBRA = {
  /** Nome oficial, usado em tela, PDF, Excel e relatórios. */
  nome: 'Rodoanel Complexo do Alto Tietê · Alça',
  /** Versão curta para espaços estreitos, como o celular. */
  nomeCurto: 'Rodoanel Alto Tietê',
} as const;
