import React from 'react';
import { createRoot } from 'react-dom/client';
import './preview.css';
import UsuariosTab from '../src/components/UsuariosTab';
import PresencaTempoRealPublica from '../src/components/PresencaTempoRealPublica';
import * as fx from './fixtures';

const noop = () => {};
const screens: Record<string, React.ReactNode> = {
  usuarios: <UsuariosTab />,
  presenca: (
    <PresencaTempoRealPublica
      token="presenca-exemplo"
      gruposEquipe={[fx.grupo]}
      funcionarios={fx.equipeFuncionarios}
      empresas={fx.empresas}
      obras={fx.obras}
      meuGrupo={fx.grupo}
      meusRegistros={[]}
      dataSelecionada="2026-09-03"
      dataAtual="2026-09-03"
      isLoadingCloud={false}
      loadError=""
      onRetry={noop}
      onSubmitPresenca={async () => ({ success: true, message: 'Enviado.' })}
      onUpdateRecord={async () => ({ success: true, message: 'Atualizado.' })}
    />
  ),
  'presenca-enviada': (
    <PresencaTempoRealPublica
      token="presenca-exemplo"
      gruposEquipe={[fx.grupo]}
      funcionarios={fx.equipeFuncionarios}
      empresas={fx.empresas}
      obras={fx.obras}
      meuGrupo={fx.grupo}
      meusRegistros={fx.registrosEnviados}
      dataSelecionada="2026-09-03"
      dataAtual="2026-09-03"
      isLoadingCloud={false}
      loadError=""
      onRetry={noop}
      onSubmitPresenca={async () => ({ success: true, message: 'Enviado.' })}
      onUpdateRecord={async () => ({ success: true, message: 'Atualizado.' })}
    />
  ),
};

const key = new URLSearchParams(location.search).get('screen') || 'usuarios';

createRoot(document.getElementById('app-root')!).render(
  <div id="main-tab-viewport" style={{ padding: 28, background: '#fff', minHeight: '100vh' }}>
    {screens[key] ?? <p>Tela desconhecida: {key}</p>}
  </div>,
);
