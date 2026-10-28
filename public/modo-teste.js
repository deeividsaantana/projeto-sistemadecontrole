/**
 * MODO TESTE - Bypass de autenticação para desenvolvimento/testes
 * 
 * ATENÇÃO: Arquivo temporário apenas para validação do módulo Pessoas & Presença
 * REMOVER antes de produção!
 */

// Função para ativar modo teste
export const ativarModoTeste = () => {
  console.log('🧪 MODO TESTE ATIVADO');
  
  // Simular usuário logado
  localStorage.setItem('renea_isLoggedIn', 'true');
  localStorage.setItem('renea_currentUserRole', 'admin');
  localStorage.setItem('renea_activeUserName', 'Admin Teste');
  localStorage.setItem('renea_activeUserEmail', 'teste@renea.com.br');
  
  // Mock de sessão Supabase
  const mockSession = {
    access_token: 'mock-test-mode-token-' + Date.now(),
    refresh_token: 'mock-refresh-token',
    expires_at: Date.now() + 86400000, // 24h
    user: {
      id: 'test-user-' + Date.now(),
      email: 'teste@renea.com.br',
      user_metadata: {
        name: 'Admin Teste',
        role: 'admin'
      },
      app_metadata: {
        role: 'admin'
      }
    }
  };
  
  // Supabase auth token
  localStorage.setItem('sb-gifdrwhdsltnjmguyjnt-auth-token', JSON.stringify(mockSession));
  
  // Recarregar página
  window.location.reload();
};

// Adicionar botão de modo teste na tela de login
export const injetarBotaoModoTeste = () => {
  // Aguardar DOM carregar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injetarBotao);
  } else {
    injetarBotao();
  }
};

function injetarBotao() {
  // Verificar se já existe
  if (document.getElementById('modo-teste-btn')) return;
  
  // Procurar formulário de login
  const loginForm = document.querySelector('form');
  if (!loginForm) {
    setTimeout(injetarBotao, 500);
    return;
  }
  
  // Criar botão
  const btn = document.createElement('button');
  btn.id = 'modo-teste-btn';
  btn.type = 'button';
  btn.textContent = '🧪 Entrar em Modo Teste (Dev)';
  btn.style.cssText = `
    width: 100%;
    padding: 0.75rem;
    margin-top: 1rem;
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    color: white;
    border: none;
    border-radius: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 0.875rem;
  `;
  
  btn.onmouseover = () => {
    btn.style.transform = 'scale(1.02)';
    btn.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.4)';
  };
  
  btn.onmouseout = () => {
    btn.style.transform = 'scale(1)';
    btn.style.boxShadow = 'none';
  };
  
  btn.onclick = ativarModoTeste;
  
  // Inserir após o botão de login
  const submitBtn = loginForm.querySelector('button[type="submit"]');
  if (submitBtn && submitBtn.parentElement) {
    submitBtn.parentElement.appendChild(btn);
  } else {
    loginForm.appendChild(btn);
  }
  
  console.log('✅ Botão Modo Teste injetado');
}

// Auto-executar quando script for carregado
injetarBotaoModoTeste();

// Expor globalmente para console
window.__MODO_TESTE__ = {
  ativar: ativarModoTeste,
  injetarBotao: injetarBotaoModoTeste
};

console.log('🧪 Modo Teste carregado. Digite __MODO_TESTE__.ativar() no console para ativar.');
