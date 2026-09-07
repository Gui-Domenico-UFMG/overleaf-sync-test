import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { getOverleafCookies } from './extractCookies.js';

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
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0',
  });
  
  // Injetar cookies do Firefox
  const cookies = await getOverleafCookies();
  if (cookies && cookies.length > 0) {
    await _context.addCookies(cookies);
    console.log(`[MCP] ${cookies.length} cookies injetados a partir do Firefox (Store).`);
  } else {
    console.log('[MCP] Nenhum cookie encontrado do Firefox. Pode ser necessário login.');
  }

  _page = await _context.newPage();
  return { browser: _browser, context: _context, page: _page };
}

export async function saveSession() {
  // Não precisamos salvar sessão no arquivo, pois lemos do Firefox a cada inicialização
}

export async function ensureLoggedIn(page, context) {
  await page.goto('https://www.overleaf.com/project', { waitUntil: 'networkidle' });
  const url = page.url();
  if (url.includes('/login')) {
    throw new Error(
      'Sessão expirada ou cookies inválidos. Por favor, faça login no seu Firefox.'
    );
  }
}
