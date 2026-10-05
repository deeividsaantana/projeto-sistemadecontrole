import { useState } from 'react';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Tabs } from '../../../components/ui/Tabs';
import { DataTable, type DataTableColumn } from '../../../components/ui/DataTable';
import { Badge } from '../../../components/ui/Badge';
import { LoadingState, ErrorState } from '../../../components/ui/States';
import { useCadastros } from '../hooks/useCadastros';
import type { Empresa, EtapaServico, Funcionario } from '../../../../types';

type SubAba = 'pessoas' | 'locacao-equipamentos' | 'materiais' | 'nao-classificado' | 'ramos';

const pessoasColunas: DataTableColumn<Funcionario>[] = [
  { key: 'nome', header: 'Nome', render: item => <span className="font-semibold">{item.nome}</span> },
  { key: 'cargo', header: 'Cargo', render: item => item.cargo || '—' },
  { key: 'matricula', header: 'Matrícula', render: item => item.matricula || '—' },
  {
    key: 'status',
    header: 'Status',
    render: item => <Badge tone={item.status === 'ATIVO' || !item.status ? 'success' : 'neutral'}>{item.status || 'ATIVO'}</Badge>,
  },
];

const empresaColunas: DataTableColumn<Empresa>[] = [
  { key: 'nome', header: 'Empresa', render: item => <span className="font-semibold">{item.nome}</span> },
  { key: 'cnpj', header: 'CNPJ', render: item => item.cnpj || '—' },
  { key: 'responsavel', header: 'Responsável', render: item => item.responsavel || '—' },
  { key: 'telefone', header: 'Telefone', render: item => item.telefone || '—' },
  {
    key: 'status',
    header: 'Status',
    render: item => <Badge tone={item.status === 'INATIVO' ? 'neutral' : 'success'}>{item.status || 'ATIVO'}</Badge>,
  },
];

const ramoColunas: DataTableColumn<EtapaServico>[] = [
  { key: 'nome', header: 'Ramo / Trecho', render: item => <span className="font-semibold">{item.nome}</span> },
];

export const AdministracaoPage = () => {
  const { data, isLoading, isError, refetch } = useCadastros();
  const [aba, setAba] = useState<SubAba>('pessoas');

  const fornecedores = (categoria: string) =>
    data?.fornecedoresPorCategoria.find(grupo => grupo.categoria === categoria)?.empresas ?? [];
  const naoClassificados = fornecedores('Não classificado');

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Administração" description="Cadastros mestres — pessoas, fornecedores e ramos, cada um na sua própria lista." />

      {isLoading && <LoadingState label="Carregando cadastros…" />}
      {isError && <ErrorState description="Não foi possível ler os cadastros locais." onRetry={() => refetch()} />}

      {data && (
        <>
          <Tabs
            activeId={aba}
            onChange={id => setAba(id as SubAba)}
            items={[
              { id: 'pessoas', label: 'Pessoas', count: data.pessoas.length },
              { id: 'locacao-equipamentos', label: 'Fornecedores · Locação de equipamentos', count: fornecedores('Locação de equipamentos').length },
              { id: 'materiais', label: 'Fornecedores · Materiais', count: fornecedores('Materiais').length },
              { id: 'nao-classificado', label: 'Fornecedores · Não classificados', count: naoClassificados.length },
              { id: 'ramos', label: 'Ramos / Trechos', count: data.ramos.length },
            ]}
          />

          {aba === 'pessoas' && (
            <DataTable columns={pessoasColunas} rows={data.pessoas} rowKey={item => item.id} emptyTitle="Nenhuma pessoa ativa cadastrada" />
          )}
          {aba === 'locacao-equipamentos' && (
            <DataTable
              columns={empresaColunas}
              rows={fornecedores('Locação de equipamentos')}
              rowKey={item => item.id}
              emptyTitle="Nenhum fornecedor de locação de equipamentos"
              emptyDescription="Classifique um fornecedor com essa categoria no cadastro de Empresas para ele aparecer aqui."
            />
          )}
          {aba === 'materiais' && (
            <DataTable
              columns={empresaColunas}
              rows={fornecedores('Materiais')}
              rowKey={item => item.id}
              emptyTitle="Nenhum fornecedor de materiais"
              emptyDescription="Classifique um fornecedor com essa categoria no cadastro de Empresas para ele aparecer aqui."
            />
          )}
          {aba === 'nao-classificado' && (
            <DataTable
              columns={empresaColunas}
              rows={naoClassificados}
              rowKey={item => item.id}
              emptyTitle="Todos os fornecedores estão classificados"
              emptyDescription="Fornecedores sem categoria definida aparecem aqui até serem revisados — nunca viram 'materiais' por padrão."
            />
          )}
          {aba === 'ramos' && (
            <DataTable columns={ramoColunas} rows={data.ramos} rowKey={item => item.id} emptyTitle="Nenhum ramo/trecho cadastrado" />
          )}
        </>
      )}
    </div>
  );
};
