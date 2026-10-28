/**
 * VISÃO: Colaboradores
 * 
 * Lista completa de colaboradores com ficha detalhada:
 * - Tabela com filtros e busca
 * - Clique na linha abre sidebar com ficha completa
 * - Ficha mostra: dados pessoais, presença, frota, viagens
 * - Ações: alterar situação, ver módulos relacionados
 */

import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFiltragemGlobal } from '../hooks/useFiltragemGlobal';
import { useFichaColaborador } from '../hooks/useFichaColaborador';
import { usePessoasPresencaStore } from '../store';
import { 
  ArrowLeft, 
  UserCog, 
  Users, 
  ClipboardCheck, 
  Truck, 
  X,
  Calendar,
  Briefcase,
  MapPin 
} from 'lucide-react';
import type { Funcionario } from '../../../types';

interface ColaboradoresViewProps {
  onAlterarSituacao?: (proximo: Funcionario, descricao: string) => void;
  onNavigate: (tab: string) => void;
}

export default function ColaboradoresView({
  onAlterarSituacao,
  onNavigate,
}: ColaboradoresViewProps) {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { funcionariosFiltrados } = useFiltragemGlobal();
  const { colaboradorSelecionado, setColaboradorSelecionado } = usePessoasPresencaStore();
  
  // ID vem da URL ou do estado
  const fichaId = id || colaboradorSelecionado;
  const {
    colaborador,
    equipe,
    empresa,
    presencas,
    estatisticasPresenca,
    equipamentosOperados,
    viagensJazida,
  } = useFichaColaborador(fichaId);
  
  // Handler de seleção
  const handleSelecionar = (func: Funcionario) => {
    setColaboradorSelecionado(func.id);
    navigate(`/pessoas/colaboradores/${func.id}`);
  };
  
  const handleFechar = () => {
    setColaboradorSelecionado(null);
    navigate('/pessoas/colaboradores');
  };
  
  return (
    <div className="flex flex-col md:flex-row gap-4 md:gap-6">
      {/* Tabela/Cards principal */}
      <div className={`transition-all ${fichaId ? 'md:max-w-2xl' : 'flex-1'}`}>
        <div className="mb-3 md:mb-4">
          <h2 className="text-lg md:text-xl font-bold text-slate-900">Colaboradores</h2>
          <p className="text-xs md:text-sm text-slate-600 mt-1">
            {funcionariosFiltrados.length} {funcionariosFiltrados.length === 1 ? 'colaborador' : 'colaboradores'}
          </p>
        </div>
        
        {funcionariosFiltrados.length === 0 ? (
          <div className="rounded-lg md:rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-8 md:p-12 text-center">
            <Users className="mx-auto h-10 w-10 md:h-12 md:w-12 text-slate-400" />
            <h3 className="mt-3 md:mt-4 text-sm md:text-base font-bold text-slate-900">Nenhum colaborador encontrado</h3>
            <p className="mt-1 text-xs md:text-sm text-slate-600">
              Ajuste os filtros para ver mais resultados
            </p>
          </div>
        ) : (
          <>
            {/* DESKTOP: Tabela */}
            <div className="hidden md:block overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full">
                <thead className="bg-slate-50 text-left">
                  <tr>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">Nome</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">Matrícula</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">Função</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {funcionariosFiltrados.slice(0, 100).map(func => {
                    const situacao = func.status || (func.ativo ? 'ATIVO' : 'INATIVO');
                    const selecionado = func.id === fichaId;
                    
                    return (
                      <tr
                        key={func.id}
                        onClick={() => handleSelecionar(func)}
                        className={`cursor-pointer transition-colors ${
                          selecionado 
                            ? 'bg-emerald-50' 
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="px-4 py-3 font-medium text-slate-900">{func.nome}</td>
                        <td className="px-4 py-3 font-mono text-sm text-slate-600">
                          {func.matricula || '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{func.cargo}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            situacao === 'ATIVO' 
                              ? 'bg-emerald-100 text-emerald-800'
                              : situacao === 'FÉRIAS'
                              ? 'bg-sky-100 text-sky-800'
                              : situacao === 'AFASTADO'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {situacao}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              
              {funcionariosFiltrados.length > 100 && (
                <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm text-slate-600">
                  Mostrando 100 de {funcionariosFiltrados.length} colaboradores.
                  Use os filtros para refinar a busca.
                </div>
              )}
            </div>
            
            {/* MOBILE: Cards */}
            <div className="md:hidden space-y-2">
              {funcionariosFiltrados.slice(0, 100).map(func => {
                const situacao = func.status || (func.ativo ? 'ATIVO' : 'INATIVO');
                const selecionado = func.id === fichaId;
                
                return (
                  <div
                    key={func.id}
                    onClick={() => handleSelecionar(func)}
                    className={`rounded-lg border p-3 cursor-pointer transition-all ${
                      selecionado
                        ? 'border-emerald-300 bg-emerald-50 ring-2 ring-emerald-200'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-slate-900 truncate">{func.nome}</h3>
                        <p className="text-xs text-slate-600 truncate">{func.cargo}</p>
                      </div>
                      <span className={`ml-2 shrink-0 inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${
                        situacao === 'ATIVO' 
                          ? 'bg-emerald-100 text-emerald-800'
                          : situacao === 'FÉRIAS'
                          ? 'bg-sky-100 text-sky-800'
                          : situacao === 'AFASTADO'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {situacao}
                      </span>
                    </div>
                    {func.matricula && (
                      <p className="text-xs font-mono text-slate-500">Mat. {func.matricula}</p>
                    )}
                  </div>
                );
              })}
              {funcionariosFiltrados.length > 100 && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center text-xs text-slate-600">
                  Mostrando 100 de {funcionariosFiltrados.length}. Use os filtros para refinar.
                </div>
              )}
            </div>
          </>
        )}
      </div>
      
      {/* Sidebar/Modal da ficha */}
      {fichaId && colaborador && (
        <>
          {/* DESKTOP: Sidebar fixa */}
          <div className="hidden md:block md:w-96 md:shrink-0">
            <div className="sticky top-6 rounded-xl border border-slate-200 bg-white shadow-lg">
              {/* Header da ficha */}
              <div className="border-b border-slate-200 p-5">
                <button
                  onClick={handleFechar}
                  className="mb-3 inline-flex items-center gap-2 text-sm font-bold text-slate-600 transition-colors hover:text-slate-900"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Voltar para colaboradores
                </button>
                
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-slate-900">{colaborador.nome}</h3>
                    <p className="mt-1 text-sm text-slate-600">
                      {colaborador.matricula && `Matrícula ${colaborador.matricula}`}
                      {colaborador.cargo && ` · ${colaborador.cargo}`}
                    </p>
                    {empresa && (
                      <p className="mt-0.5 text-sm text-slate-500">{empresa.nome}</p>
                    )}
                  </div>
                  
                  <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                    colaborador.ativo
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {colaborador.status || (colaborador.ativo ? 'ATIVO' : 'INATIVO')}
                  </span>
                </div>
              </div>
            
            {/* Corpo da ficha */}
            <div className="max-h-[calc(100vh-200px)] overflow-y-auto p-5 space-y-5">
              {/* Identificação */}
              <div>
                <h4 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-600">
                  <Briefcase className="h-4 w-4" />
                  Identificação
                </h4>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
                  <div>
                    <dt className="text-xs font-bold uppercase text-slate-500">Matrícula</dt>
                    <dd className="mt-0.5 font-medium text-slate-900">{colaborador.matricula || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold uppercase text-slate-500">Função</dt>
                    <dd className="mt-0.5 font-medium text-slate-900">{colaborador.cargo || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold uppercase text-slate-500">Encarregado</dt>
                    <dd className="mt-0.5 font-medium text-slate-900">{colaborador.liderNome || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold uppercase text-slate-500">Equipe</dt>
                    <dd className="mt-0.5 font-medium text-slate-900">{equipe?.nome || '—'}</dd>
                  </div>
                  {equipe?.frenteServico && (
                    <div className="col-span-2">
                      <dt className="text-xs font-bold uppercase text-slate-500">Frente</dt>
                      <dd className="mt-0.5 font-medium text-slate-900">{equipe.frenteServico}</dd>
                    </div>
                  )}
                </dl>
              </div>
              
              {/* Presença */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-600">
                    <ClipboardCheck className="h-4 w-4" />
                    Presença
                  </h4>
                  <button
                    onClick={() => onNavigate('presenca')}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-800"
                  >
                    Ver módulo →
                  </button>
                </div>
                
                <div className="mb-3 grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-emerald-50 p-3 text-center">
                    <p className="text-xs font-bold uppercase text-emerald-600">Presentes</p>
                    <strong className="mt-1 block text-xl font-black text-emerald-700">
                      {estatisticasPresenca.presentes}
                    </strong>
                  </div>
                  <div className="rounded-lg bg-rose-50 p-3 text-center">
                    <p className="text-xs font-bold uppercase text-rose-600">Ausentes</p>
                    <strong className="mt-1 block text-xl font-black text-rose-700">
                      {estatisticasPresenca.ausentes}
                    </strong>
                  </div>
                  <div className="rounded-lg bg-amber-50 p-3 text-center">
                    <p className="text-xs font-bold uppercase text-amber-600">Atrasos</p>
                    <strong className="mt-1 block text-xl font-black text-amber-700">
                      {estatisticasPresenca.atrasados}
                    </strong>
                  </div>
                </div>
                
                {presencas.length > 0 ? (
                  <ul className="space-y-2">
                    {presencas.slice(0, 5).map(p => (
                      <li key={p.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs">
                        <span className="text-slate-600">
                          {new Date(p.data + 'T12:00:00').toLocaleDateString('pt-BR')}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 font-bold ${
                          p.status === 'Presente'
                            ? 'bg-emerald-100 text-emerald-800'
                            : p.status === 'Ausente'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {p.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">Nenhum apontamento de presença</p>
                )}
              </div>
              
              {/* Frota operada */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-600">
                    <Truck className="h-4 w-4" />
                    Frota Operada
                  </h4>
                  <button
                    onClick={() => onNavigate('controle-equipamentos')}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-800"
                  >
                    Ver módulo →
                  </button>
                </div>
                
                {equipamentosOperados.length > 0 ? (
                  <ul className="space-y-2">
                    {equipamentosOperados.slice(0, 5).map(eq => (
                      <li key={eq.id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
                        <div className="flex items-center justify-between">
                          <strong className="font-medium text-slate-900">
                            {eq.equipamentoNome || eq.equipamentoId}
                          </strong>
                          <span className="text-slate-600">
                            {new Date(eq.data + 'T12:00:00').toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                        {eq.horasOperacao && (
                          <p className="mt-0.5 text-slate-600">{eq.horasOperacao}h operadas</p>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">Nenhum equipamento operado</p>
                )}
              </div>
              
              {/* Viagens de jazida */}
              {viagensJazida.length > 0 && (
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-600">
                      <MapPin className="h-4 w-4" />
                      Viagens de Jazida
                    </h4>
                  </div>
                  
                  <ul className="space-y-2">
                    {viagensJazida.slice(0, 5).map(v => (
                      <li key={v.id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
                        <div className="flex items-center justify-between">
                          <strong className="font-medium text-slate-900">
                            {v.ticketNumero || `Ticket ${v.id}`}
                          </strong>
                          <span className="text-slate-600">
                            {v.dataCarregamento && new Date(v.dataCarregamento).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            
            {/* Footer da ficha */}
            {onAlterarSituacao && (
              <div className="border-t border-slate-200 p-5">
                <button
                  onClick={() => {
                    // Aqui abriria modal de alteração
                    alert('Modal de alteração de situação aqui');
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-600 bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-700"
                >
                  <UserCog className="h-4 w-4" />
                  Alterar situação
                </button>
              </div>
            )}
          </div>
        </div>
        
        {/* MOBILE: Modal full-screen */}
        <div className="md:hidden fixed inset-0 z-50 bg-white flex flex-col">
          {/* Header sticky */}
          <div className="border-b border-slate-200 bg-white px-4 py-3 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={handleFechar}
                className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 active:text-slate-900"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </button>
                
              <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${
                colaborador.ativo
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-slate-100 text-slate-600'
              }`}>
                {colaborador.status || (colaborador.ativo ? 'ATIVO' : 'INATIVO')}
              </span>
            </div>
              
            <h3 className="text-lg font-bold text-slate-900">{colaborador.nome}</h3>
            <p className="text-xs text-slate-600">
              {colaborador.matricula && `Mat. ${colaborador.matricula}`}
              {colaborador.cargo && ` · ${colaborador.cargo}`}
            </p>
            {empresa && (
              <p className="text-xs text-slate-500 mt-0.5">{empresa.nome}</p>
            )}
          </div>
            
          {/* Corpo scrollable */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Identificação */}
            <div>
              <h4 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-600">
                <Briefcase className="h-3.5 w-3.5" />
                Identificação
              </h4>
              <dl className="grid grid-cols-2 gap-x-2 gap-y-2 text-sm">
                <div>
                  <dt className="text-xs font-bold uppercase text-slate-500">Matrícula</dt>
                  <dd className="mt-0.5 font-medium text-slate-900 text-xs">{colaborador.matricula || '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase text-slate-500">Função</dt>
                  <dd className="mt-0.5 font-medium text-slate-900 text-xs">{colaborador.cargo || '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase text-slate-500">Encarregado</dt>
                  <dd className="mt-0.5 font-medium text-slate-900 text-xs truncate">{colaborador.liderNome || '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase text-slate-500">Equipe</dt>
                  <dd className="mt-0.5 font-medium text-slate-900 text-xs truncate">{equipe?.nome || '—'}</dd>
                </div>
                {equipe?.frenteServico && (
                  <div className="col-span-2">
                    <dt className="text-xs font-bold uppercase text-slate-500">Frente</dt>
                    <dd className="mt-0.5 font-medium text-slate-900 text-xs">{equipe.frenteServico}</dd>
                  </div>
                )}
              </dl>
            </div>
              
            {/* Presença */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-600">
                  <ClipboardCheck className="h-3.5 w-3.5" />
                  Presença
                </h4>
                <button
                  onClick={() => onNavigate('presenca')}
                  className="text-xs font-bold text-emerald-700 active:text-emerald-800"
                >
                  Ver →
                </button>
              </div>
                
              <div className="mb-2 grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-emerald-50 p-2 text-center">
                  <p className="text-xs font-bold uppercase text-emerald-600">Presentes</p>
                  <strong className="mt-0.5 block text-lg font-black text-emerald-700">
                    {estatisticasPresenca.presentes}
                  </strong>
                </div>
                <div className="rounded-lg bg-rose-50 p-2 text-center">
                  <p className="text-xs font-bold uppercase text-rose-600">Ausentes</p>
                  <strong className="mt-0.5 block text-lg font-black text-rose-700">
                    {estatisticasPresenca.ausentes}
                  </strong>
                </div>
                <div className="rounded-lg bg-amber-50 p-2 text-center">
                  <p className="text-xs font-bold uppercase text-amber-600">Atrasos</p>
                  <strong className="mt-0.5 block text-lg font-black text-amber-700">
                    {estatisticasPresenca.atrasados}
                  </strong>
                </div>
              </div>
                
              {presencas.length > 0 ? (
                <ul className="space-y-1.5">
                  {presencas.slice(0, 5).map(p => (
                    <li key={p.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs">
                      <span className="text-slate-600">
                        {new Date(p.data + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 font-bold ${
                        p.status === 'Presente'
                          ? 'bg-emerald-100 text-emerald-800'
                          : p.status === 'Ausente'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {p.status}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500">Nenhum apontamento de presença</p>
              )}
            </div>
              
            {/* Frota operada */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-600">
                  <Truck className="h-3.5 w-3.5" />
                  Frota Operada
                </h4>
                <button
                  onClick={() => onNavigate('controle-equipamentos')}
                  className="text-xs font-bold text-emerald-700 active:text-emerald-800"
                >
                  Ver →
                </button>
              </div>
                
              {equipamentosOperados.length > 0 ? (
                <ul className="space-y-1.5">
                  {equipamentosOperados.slice(0, 5).map(eq => (
                    <li key={eq.id} className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <strong className="font-medium text-slate-900 truncate flex-1">
                          {eq.equipamentoNome || eq.equipamentoId}
                        </strong>
                        <span className="text-slate-600 ml-2 shrink-0 text-xs">
                          {new Date(eq.data + 'T12:00:00').toLocaleDateString('pt-BR', {month: '2-digit', day: '2-digit'})}
                        </span>
                      </div>
                      {eq.horasOperacao && (
                        <p className="mt-0.5 text-slate-600">{eq.horasOperacao}h</p>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500">Nenhum equipamento operado</p>
              )}
            </div>
              
            {/* Viagens de jazida */}
            {viagensJazida.length > 0 && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-600">
                    <MapPin className="h-3.5 w-3.5" />
                    Viagens de Jazida
                  </h4>
                </div>
                  
                <ul className="space-y-1.5">
                  {viagensJazida.slice(0, 5).map(v => (
                    <li key={v.id} className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <strong className="font-medium text-slate-900 truncate flex-1">
                          {v.ticketNumero || `Ticket ${v.id}`}
                        </strong>
                        <span className="text-slate-600 ml-2 shrink-0">
                          {v.dataCarregamento && new Date(v.dataCarregamento).toLocaleDateString('pt-BR', {month: '2-digit', day: '2-digit'})}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
            
          {/* Footer sticky */}
          {onAlterarSituacao && (
            <div className="border-t border-slate-200 p-3 shrink-0">
              <button
                onClick={() => {
                  alert('Modal de alteração de situação aqui');
                }}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white active:bg-emerald-700"
              >
                <UserCog className="h-4 w-4" />
                Alterar situação
              </button>
            </div>
          )}
        </div>
        </>
        )}
  );
}
