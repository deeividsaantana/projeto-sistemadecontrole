/**
 * COMPONENTE: Termo de Consentimento LGPD
 * 
 * Exibe modal de consentimento na primeira vez que o usuário acessa o sistema.
 * Armazena consentimento criptografado conforme LGPD Art. 8º (base legal).
 * 
 * USO: Adicionar em App.tsx ou componente raiz
 */

import { useState, useEffect } from 'react';
import { X, Shield, FileText, Eye, Database } from 'lucide-react';
import { lgpdStorage } from '../../utils/lgpdStorage';

export default function LGPDConsentModal() {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function checkConsent() {
      const consent = await lgpdStorage.getItem('lgpd_consent');
      
      if (!consent) {
        setShowModal(true);
      }
      
      setLoading(false);
    }
    
    checkConsent();
  }, []);
  
  const handleAccept = async () => {
    const consentData = {
      accepted: true,
      timestamp: new Date().toISOString(),
      version: '1.0',
      ip: '(capturado pelo backend)', // Em produção, capturar IP real
    };
    
    await lgpdStorage.setItem('lgpd_consent', JSON.stringify(consentData));
    
    console.info('[LGPD] Consentimento registrado:', consentData.timestamp);
    
    setShowModal(false);
  };
  
  const handleReject = () => {
    alert(
      'Sem o seu consentimento, não podemos processar seus dados pessoais.\n\n' +
      'O acesso ao sistema será bloqueado.'
    );
    
    // Em produção: fazer logout e redirecionar para tela de login
    window.location.href = '/';
  };
  
  if (loading || !showModal) return null;
  
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-0 sm:p-4">
      <div className="w-full h-full sm:h-auto sm:max-w-2xl sm:max-h-[90vh] overflow-y-auto sm:rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 border-b border-slate-200 bg-white px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-emerald-100 p-2">
              <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-700" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Termo de Consentimento LGPD
              </h2>
              <p className="text-xs sm:text-sm text-slate-600">
                Lei Geral de Proteção de Dados (Lei nº 13.709/2018)
              </p>
            </div>
          </div>
        </div>
        
        {/* Corpo */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
          {/* Introdução */}
          <div>
            <p className="text-sm sm:text-base text-slate-700 leading-relaxed">
              Bem-vindo ao <strong>Sistema RENEA</strong>. Para garantir a proteção dos seus dados pessoais,
              precisamos do seu <strong>consentimento expresso</strong> para coletar, armazenar e processar
              suas informações conforme a LGPD.
            </p>
          </div>
          
          {/* Dados coletados */}
          <div>
            <h3 className="mb-2 flex items-center gap-2 text-sm sm:text-base font-bold text-slate-900">
              <Database className="h-4 w-4 text-emerald-700" />
              Dados Pessoais Coletados
            </h3>
            <ul className="space-y-1.5 text-xs sm:text-sm text-slate-700 ml-6">
              <li className="list-disc">
                <strong>Identificação:</strong> Nome completo, CPF, matrícula, foto
              </li>
              <li className="list-disc">
                <strong>Contato:</strong> E-mail, telefone
              </li>
              <li className="list-disc">
                <strong>Profissional:</strong> Cargo, empresa, equipe, encarregado
              </li>
              <li className="list-disc">
                <strong>Presença:</strong> Data, horário, localização (obra/frente)
              </li>
              <li className="list-disc">
                <strong>Operacional:</strong> Equipamentos operados, viagens de jazida
              </li>
            </ul>
          </div>
          
          {/* Finalidades */}
          <div>
            <h3 className="mb-2 flex items-center gap-2 text-sm sm:text-base font-bold text-slate-900">
              <FileText className="h-4 w-4 text-emerald-700" />
              Finalidade do Tratamento
            </h3>
            <ul className="space-y-1.5 text-xs sm:text-sm text-slate-700 ml-6">
              <li className="list-disc">
                <strong>Gestão de pessoal:</strong> Controle de presença, registro de jornada
              </li>
              <li className="list-disc">
                <strong>Administração:</strong> Folha de pagamento, relatórios gerenciais
              </li>
              <li className="list-disc">
                <strong>Segurança:</strong> Rastreabilidade de acessos, auditoria
              </li>
              <li className="list-disc">
                <strong>Compliance:</strong> Atendimento a obrigações legais (CLT, NR, eSocial)
              </li>
            </ul>
          </div>
          
          {/* Seus direitos */}
          <div>
            <h3 className="mb-2 flex items-center gap-2 text-sm sm:text-base font-bold text-slate-900">
              <Eye className="h-4 w-4 text-emerald-700" />
              Seus Direitos (LGPD Art. 18)
            </h3>
            <ul className="space-y-1.5 text-xs sm:text-sm text-slate-700 ml-6">
              <li className="list-disc">
                <strong>Acesso:</strong> Consultar seus dados armazenados
              </li>
              <li className="list-disc">
                <strong>Correção:</strong> Atualizar dados desatualizados
              </li>
              <li className="list-disc">
                <strong>Exclusão:</strong> Solicitar remoção (exceto obrigações legais)
              </li>
              <li className="list-disc">
                <strong>Revogação:</strong> Retirar consentimento a qualquer momento
              </li>
              <li className="list-disc">
                <strong>Portabilidade:</strong> Receber dados em formato estruturado
              </li>
            </ul>
          </div>
          
          {/* Segurança */}
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 sm:p-4">
            <h4 className="text-xs sm:text-sm font-bold text-emerald-900 mb-1.5">
              🔒 Medidas de Segurança Implementadas
            </h4>
            <ul className="space-y-1 text-xs sm:text-sm text-emerald-800 ml-4">
              <li className="list-disc">Criptografia AES-256 (dados armazenados localmente)</li>
              <li className="list-disc">HTTPS/TLS (dados em trânsito)</li>
              <li className="list-disc">Logs de acesso auditáveis</li>
              <li className="list-disc">Retenção limitada a 90 dias (dados temporários)</li>
            </ul>
          </div>
          
          {/* DPO */}
          <div className="text-xs sm:text-sm text-slate-600">
            <p>
              <strong>Encarregado de Dados (DPO):</strong> dpo@renea.com.br<br />
              <strong>Prazo de resposta:</strong> até 15 dias úteis<br />
              <strong>Versão do termo:</strong> 1.0 (vigente desde {new Date().toLocaleDateString('pt-BR')})
            </p>
          </div>
        </div>
        
        {/* Footer */}
        <div className="sticky bottom-0 border-t border-slate-200 bg-slate-50 px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <button
              onClick={handleAccept}
              className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 sm:py-3 text-sm sm:text-base font-bold text-white transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              ✅ Aceito os termos e autorizo o tratamento dos meus dados
            </button>
            
            <button
              onClick={handleReject}
              className="flex-1 rounded-lg border-2 border-slate-300 bg-white px-4 py-2.5 sm:py-3 text-sm sm:text-base font-bold text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400/50"
            >
              ❌ Não aceito
            </button>
          </div>
          
          <p className="mt-3 text-center text-xs text-slate-500">
            Ao clicar em "Aceito", você concorda com este termo de forma livre, informada e inequívoca.
          </p>
        </div>
      </div>
    </div>
  );
}
