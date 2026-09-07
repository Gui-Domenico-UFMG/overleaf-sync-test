import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSION_DIR = path.resolve(__dirname, '..', '.playwright-session');

let _browser = null;
let _context = null;
let _page = null;

export async function getBrowser() {
  if (_browser && _browser.isConnected()) return { browser: _browser, context: _context, page: _page };

  if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });

  _browser = await chromium.launch({ headless: true });
  _context = await _browser.newContext({
    storageState: fs.existsSync(path.join(SESSION_DIR, 'state.json'))
      ? path.join(SESSION_DIR, 'state.json')
      : undefined,
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });
  _page = await _context.newPage();
  return { browser: _browser, context: _context, page: _page };
}

export async function saveSession() {
  if (!_context) return;
  await _context.storageState({ path: path.join(SESSION_DIR, 'state.json') });
}

export async function ensureLoggedIn(page, context) {
  await page.goto('https://www.overleaf.com/project', { waitUntil: 'networkidle' });
  const url = page.url();
  if (url.includes('/login')) {
    throw new Error(
      'Sessão expirada. Execute: node src/login.js  para fazer login interativo e salvar a sessão.'
    );
  }
}
