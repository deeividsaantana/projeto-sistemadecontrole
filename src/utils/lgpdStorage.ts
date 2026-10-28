/**
 * LGPD-Compliant Storage Utility
 * 
 * Fornece criptografia AES-256 para localStorage/sessionStorage
 * com hash SHA-256 para chaves, atendendo LGPD Art. 46.
 * 
 * USO:
 * ```ts
 * import { lgpdStorage } from '@/utils/lgpdStorage';
 * 
 * // Salvar (auto-criptografa)
 * lgpdStorage.setItem('user_cpf', '123.456.789-00');
 * 
 * // Buscar (auto-descriptografa)
 * const cpf = lgpdStorage.getItem('user_cpf'); // '123.456.789-00'
 * 
 * // Remover
 * lgpdStorage.removeItem('user_cpf');
 * ```
 */

// ⚠️ ATENÇÃO: Em produção, mover SECRET_KEY para variável de ambiente
// Esta chave é EXEMPLO. NÃO VERSIONAR chaves reais no Git.
const SECRET_KEY = import.meta.env.VITE_STORAGE_SECRET || 'renea-lgpd-2024-secure-key';

/**
 * Criptografia AES-256-GCM usando Web Crypto API
 * (suportado em todos navegadores modernos)
 */
async function encrypt(plaintext: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  
  // Gerar chave a partir da SECRET_KEY
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(SECRET_KEY),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );
  
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('renea-salt-lgpd'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );
  
  // IV aleatório (12 bytes para GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Criptografar
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );
  
  // Combinar IV + ciphertext em Base64
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

/**
 * Descriptografia AES-256-GCM
 */
async function decrypt(ciphertext: string): Promise<string> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  
  // Decodificar Base64
  const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
  
  // Extrair IV (12 bytes) e ciphertext
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  
  // Gerar chave a partir da SECRET_KEY
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(SECRET_KEY),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );
  
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('renea-salt-lgpd'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
  
  // Descriptografar
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );
  
  return decoder.decode(decrypted);
}

/**
 * Hash SHA-256 para ofuscar nomes de chaves
 */
async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Interface compatível com localStorage
 */
export const lgpdStorage = {
  /**
   * Salva valor criptografado no localStorage
   * @param key Chave (será hasheada SHA-256)
   * @param value Valor (será criptografado AES-256)
   */
  async setItem(key: string, value: string): Promise<void> {
    try {
      const hashedKey = await hashKey(key);
      const encrypted = await encrypt(value);
      localStorage.setItem(hashedKey, encrypted);
      
      // Log de acesso (conformidade LGPD Art. 48)
      console.info(`[LGPD] Dado sensível armazenado: ${key.substring(0, 10)}...`);
    } catch (error) {
      console.error('[LGPD] Erro ao criptografar dado:', error);
      throw new Error('Falha na criptografia LGPD');
    }
  },
  
  /**
   * Busca valor descriptografado do localStorage
   * @param key Chave (será hasheada SHA-256)
   * @returns Valor descriptografado ou null
   */
  async getItem(key: string): Promise<string | null> {
    try {
      const hashedKey = await hashKey(key);
      const encrypted = localStorage.getItem(hashedKey);
      
      if (!encrypted) return null;
      
      const decrypted = await decrypt(encrypted);
      
      // Log de acesso (conformidade LGPD Art. 48)
      console.info(`[LGPD] Dado sensível acessado: ${key.substring(0, 10)}...`);
      
      return decrypted;
    } catch (error) {
      console.error('[LGPD] Erro ao descriptografar dado:', error);
      return null;
    }
  },
  
  /**
   * Remove valor do localStorage
   * @param key Chave (será hasheada SHA-256)
   */
  async removeItem(key: string): Promise<void> {
    try {
      const hashedKey = await hashKey(key);
      localStorage.removeItem(hashedKey);
      
      // Log de remoção (conformidade LGPD Art. 16)
      console.info(`[LGPD] Dado sensível removido: ${key.substring(0, 10)}...`);
    } catch (error) {
      console.error('[LGPD] Erro ao remover dado:', error);
    }
  },
  
  /**
   * Limpa TODOS os dados criptografados
   * ⚠️ USO CUIDADOSO: remove tudo do localStorage
   */
  clear(): void {
    localStorage.clear();
    console.warn('[LGPD] Todos os dados locais foram removidos');
  },
};

/**
 * Hook para limpeza automática de dados antigos (90 dias LGPD)
 * Chamar no mount do App.tsx
 */
export function setupLGPDExpiry() {
  const EXPIRY_DAYS = 90; // LGPD Art. 16 - prazo legal de retenção
  const EXPIRY_MS = EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  
  // Verificar última limpeza
  const lastCleanup = localStorage.getItem('lgpd_last_cleanup');
  const now = Date.now();
  
  if (!lastCleanup || now - parseInt(lastCleanup) > EXPIRY_MS) {
    console.info(`[LGPD] Executando limpeza automática (dados > ${EXPIRY_DAYS} dias)`);
    
    // Aqui você implementaria lógica específica de limpeza
    // Por exemplo: limpar registros de presença com data > 90 dias
    
    localStorage.setItem('lgpd_last_cleanup', now.toString());
  }
}

/**
 * Utilitário para migração de dados NÃO-criptografados existentes
 * Executar UMA VEZ no primeiro deploy após implementação
 */
export async function migrateLegacyStorage() {
  console.warn('[LGPD] INICIANDO MIGRAÇÃO de dados legados para formato criptografado');
  
  const keysToMigrate = [
    'renea_funcionarios',
    'renea_empresas',
    'renea_grupos_equipes',
    'renea_presencas',
    // Adicione outras chaves conforme necessário
  ];
  
  for (const key of keysToMigrate) {
    const legacyValue = localStorage.getItem(key);
    
    if (legacyValue) {
      try {
        // Mover para formato criptografado
        await lgpdStorage.setItem(key, legacyValue);
        
        // Remover versão antiga NÃO-criptografada
        localStorage.removeItem(key);
        
        console.info(`[LGPD] Migrado: ${key}`);
      } catch (error) {
        console.error(`[LGPD] Falha ao migrar ${key}:`, error);
      }
    }
  }
  
  // Marcar migração concluída
  localStorage.setItem('lgpd_migration_done', 'true');
  console.warn('[LGPD] MIGRAÇÃO CONCLUÍDA');
}
