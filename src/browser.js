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
  // Reutiliza instância existente se ainda conectada
  if (_browser && _browser.isConnected()) {
    return { browser: _browser, context: _context, page: _page };
  }

  if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });

  _browser = await chromium.launch({ headless: true });
  _context = await _browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0',
  });

  // Injetar cookies do Firefox no contexto do Playwright
  const cookies = await getOverleafCookies();
  if (cookies && cookies.length > 0) {
    await _context.addCookies(cookies);
    console.error(`[MCP] ${cookies.length} cookies injetados a partir do Firefox (Store).`);
  } else {
    console.error('[MCP] Nenhum cookie encontrado do Firefox. Faça login no Overleaf pelo Firefox.');
  }

  _page = await _context.newPage();
  return { browser: _browser, context: _context, page: _page };
}

export async function saveSession() {
  // Sessão via cookies do Firefox — não precisa persistir arquivo separado
}

export async function ensureLoggedIn(page, context) {
  const currentUrl = page.url();

  // FIX: só navega para /project se ainda não estiver em uma página do Overleaf
  // Evita reset de estado e navegações desnecessárias dentro do editor
  const jaEstaNoOverleaf = currentUrl.includes('overleaf.com') && !currentUrl.includes('/login');

  if (!jaEstaNoOverleaf) {
    await page.goto('https://www.overleaf.com/project', { waitUntil: 'networkidle' });
  }

  const urlFinal = page.url();
  if (urlFinal.includes('/login')) {
    throw new Error(
      'Sessão expirada ou cookies inválidos. Faça login no Overleaf pelo Firefox e reinicie o MCP.'
    );
  }
}
