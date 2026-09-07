/**
 * Script de login interativo.
 * Execute UMA VEZ para salvar a sessão do Overleaf:
 *   node src/login.js
 */
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import readline from 'readline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSION_DIR = path.resolve(__dirname, '..', '.playwright-session');

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (ans) => { rl.close(); resolve(ans); }));
}

(async () => {
  if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: false, slowMo: 50 });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('Abrindo Overleaf...');
  await page.goto('https://www.overleaf.com/login');

  const email = await ask('Digite seu e-mail Overleaf: ');
  const password = await ask('Digite sua senha: ');

  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');

  try {
    await page.waitForURL('**/project**', { timeout: 15000 });
    console.log('Login realizado com sucesso!');
  } catch {
    console.log('Aguardando redirecionamento manual (pode haver CAPTCHA ou 2FA)...');
    console.log('Pressione ENTER aqui depois de completar o login no navegador.');
    await ask('');
  }

  await context.storageState({ path: path.join(SESSION_DIR, 'state.json') });
  console.log('Sessão salva em .playwright-session/state.json');
  await browser.close();
  process.exit(0);
})()
