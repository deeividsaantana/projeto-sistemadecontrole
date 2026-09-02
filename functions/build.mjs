// Empacota as 7 funções que já vivem em netlify/functions/ num único arquivo
// para o Cloud Functions, sem duplicar a lógica de negócio à mão: o esbuild
// resolve os imports relativos (inclusive os módulos em _shared/) em tempo de
// build, então netlify/functions/*.js continua sendo a única fonte de
// verdade. As dependências reais de runtime (firebase-admin, firebase-functions,
// express) ficam de fora do pacote: firebase-admin tem binário nativo (gRPC) e
// não pode ser empacotado, e todas já vêm instaladas no ambiente do Cloud
// Functions a partir do package.json desta pasta.
import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.js'],
  outfile: 'lib/index.js',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  external: ['firebase-admin', 'firebase-functions', 'express'],
  logLevel: 'info',
});
