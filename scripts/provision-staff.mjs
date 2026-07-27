import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const email = String(process.argv[2] || '').trim().toLowerCase();
if (!email) {
  console.error('Uso: npm run provision:staff -- usuario@empresa.com.br');
  process.exit(1);
}

const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64
  ? Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf8')
  : process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    || (process.env.FIREBASE_SERVICE_ACCOUNT_FILE
      ? fs.readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_FILE, 'utf8')
      : '');
if (!rawServiceAccount) {
  console.error('Informe FIREBASE_SERVICE_ACCOUNT_KEY, FIREBASE_SERVICE_ACCOUNT_KEY_BASE64 ou FIREBASE_SERVICE_ACCOUNT_FILE.');
  process.exit(1);
}

let serviceAccount;
try {
  serviceAccount = JSON.parse(rawServiceAccount);
} catch (error) {
  console.error(`FIREBASE_SERVICE_ACCOUNT_KEY inválida: ${error.message}`);
  process.exit(1);
}

const adminCredential = cert(serviceAccount);
if (getApps().length === 0) initializeApp({ credential: adminCredential });

if (process.env.FIREBASE_ADMIN_ENABLE_EMAIL_AUTH === 'true') {
  try {
    const accessToken = await adminCredential.getAccessToken();
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/admin/v2/projects/${serviceAccount.project_id}/config?updateMask=signIn.email.enabled,signIn.email.passwordRequired`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ signIn: { email: { enabled: true, passwordRequired: true } } }),
      },
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    console.log('Login por e-mail e senha habilitado no Firebase.');
  } catch (error) {
    console.warn(`Não foi possível confirmar automaticamente o provedor de e-mail/senha: ${error.message}`);
  }
}

try {
  const auth = getAuth();
  let user;
  let createdPassword = '';
  try {
    user = await auth.getUserByEmail(email);
  } catch (error) {
    if (error.code !== 'auth/user-not-found' || process.env.FIREBASE_ADMIN_CREATE_MISSING !== 'true') throw error;
    createdPassword = process.env.FIREBASE_ADMIN_INITIAL_PASSWORD || `Renea!${crypto.randomBytes(12).toString('base64url')}`;
    user = await auth.createUser({ email, password: createdPassword, emailVerified: true, disabled: false });
  }
  await auth.setCustomUserClaims(user.uid, { ...user.customClaims, staff: true });
  await auth.revokeRefreshTokens(user.uid);
  console.log(`Acesso administrativo concedido a ${email}. O usuário deve entrar novamente.`);
  if (createdPassword) {
    const passwordOutputPath = process.env.FIREBASE_ADMIN_PASSWORD_OUTPUT_PATH;
    if (passwordOutputPath) {
      fs.mkdirSync(path.dirname(passwordOutputPath), { recursive: true });
      fs.writeFileSync(passwordOutputPath, `${createdPassword}\n`, { encoding: 'utf8', mode: 0o600 });
      console.log(`Usuário criado automaticamente. A senha inicial foi salva somente neste computador em: ${passwordOutputPath}`);
    } else if (process.env.FIREBASE_ADMIN_REVEAL_PASSWORD === 'true') {
      console.log(`Usuário criado automaticamente. Senha inicial: ${createdPassword}`);
    } else {
      console.log('Usuário criado automaticamente. A senha inicial não foi exibida por segurança.');
    }
  }
} catch (error) {
  console.error(`Não foi possível autorizar ${email}: ${error.message}`);
  process.exit(1);
}
