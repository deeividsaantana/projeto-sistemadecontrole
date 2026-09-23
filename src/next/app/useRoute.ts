import { useEffect, useState, useCallback } from 'react';

/**
 * Roteamento mínimo por History API. Sem dependência nova: as rotas desta
 * primeira entrega são poucas e sem parâmetros dinâmicos, então um roteador
 * completo (react-router) seria peso sem necessidade real ainda.
 */
export const useRoute = () => {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((nextPath: string) => {
    if (nextPath === window.location.pathname) return;
    window.history.pushState({}, '', nextPath);
    setPath(nextPath);
  }, []);

  return { path, navigate };
};
