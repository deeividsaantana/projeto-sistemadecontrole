export type RegistryFieldType = 'text' | 'number' | 'date' | 'select' | 'checkbox';

export interface RegistryField<T> {
  readonly key: keyof T & string;
  readonly label: string;
  readonly type: RegistryFieldType;
  readonly required?: boolean;
  /** Só para type: 'select'. */
  readonly options?: readonly string[];
  /** Entra na busca textual da tela. */
  readonly searchable?: boolean;
  /** Editável direto na linha da tabela, sem abrir o formulário completo. */
  readonly quickEdit?: boolean;
  readonly placeholder?: string;
}

export type DuplicateMode = 'bloqueia' | 'avisa';

export interface RegistryConfig<T extends { id: string }> {
  readonly key: string;
  readonly label: string;
  readonly idPrefix: string;
  readonly fields: readonly RegistryField<T>[];
  /** Chave que identifica "isto é o mesmo registro do mundo real".
   *  Retorna undefined quando a chave está incompleta — nunca inventa. */
  readonly operationalKey: (item: T) => string | undefined;
  readonly duplicateMode: DuplicateMode;
  /** Para categorias que compartilham o mesmo cadastro (Empresa/Equipamento)
   *  filtradas por tipo, em vez de terem tabela própria. */
  readonly subFilter?: (item: T) => boolean;
  /** Validação extra além dos `required` dos fields (ex.: guard de nome de
   *  pessoa em Equipamentos). Retorna a mensagem de erro, ou undefined. */
  readonly extraValidation?: (item: T) => string | undefined;
  readonly emptyItem: () => Omit<T, 'id'>;
}

export const buildEmptyDraft = <T extends { id: string }>(config: RegistryConfig<T>): Omit<T, 'id'> =>
  config.emptyItem();
