# Alterações v2.9 — Resiliência Offline

- manifesto PWA e cache do shell da aplicação;
- navegação com fallback para o shell quando a rede falha;
- fila de comandos em IndexedDB com fallback local;
- chaves de idempotência;
- reenvio do backup Firebase ao reconectar;
- indicador visual de modo offline e operações pendentes;
- endpoints Netlify e respostas de API não são armazenados pelo service worker.

Os lançamentos continuam sendo gravados primeiro na fonte local resiliente. A fila representa apenas a intenção de sincronização, evitando duplicar os dados operacionais.
