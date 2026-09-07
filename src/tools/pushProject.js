import { getBrowser, ensureLoggedIn, saveSession } from '../browser.js';
import { listFiles } from './listFiles.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Envia arquivos locais editados de volta para o Overleaf (versão gratuita).
 *
 * Docs de texto (.tex, .bib, .cls, .sty):
 *   POST /project/:id/doc/:docId  com CSRF token via Playwright
 *
 * Arquivos binários (imagens, PDFs):
 *   POST /project/:id/upload  via FormData multipart com Playwright
 */
export async function pushProject({ projectId, localDir, files }) {
  if (!projectId) throw new Error('projectId é obrigatório');

  const srcDir = localDir
    ? path.resolve(localDir)
    : path.resolve(__dirname, '..', '..', 'projects', projectId);

  if (!fs.existsSync(srcDir)) {
    throw new Error(`Pasta local não encontrada: ${srcDir}. Faça um overleaf_pull_project primeiro.`);
  }

  const targetFiles = (files && files.length > 0) ? files : walkDir(srcDir);

  // FIX: obter browser UMA vez fora do loop
  const { page, context } = await getBrowser();
  await ensureLoggedIn(page, context);

  // FIX: navegar para o projeto UMA vez e aguardar carregamento completo
  if (!page.url().includes(`/project/${projectId}`)) {
    await page.goto(`https://www.overleaf.com/project/${projectId}`, { waitUntil: 'networkidle' });
  }

  // Obter lista de docs remotos para mapear caminho -> docId
  const remoteFiles = await listFiles({ projectId });
  const docMap = {};
  for (const f of remoteFiles) {
    docMap[f.path] = f;
    docMap[f.name] = f;
  }

  const results = [];

  for (const relPath of targetFiles) {
    const fullPath = path.join(srcDir, relPath);
    if (!fs.existsSync(fullPath)) {
      results.push({ file: relPath, status: 'skipped', reason: 'arquivo não encontrado localmente' });
      continue;
    }

    const ext = path.extname(relPath).toLowerCase();
    const isTextDoc = ['.tex', '.bib', '.cls', '.sty', '.txt', '.md'].includes(ext);

    if (isTextDoc) {
      const remote = docMap[relPath] || docMap[path.basename(relPath)];
      if (!remote || !remote.id) {
        results.push({
          file: relPath,
          status: 'erro',
          reason: 'docId não encontrado no projeto remoto. Arquivo novo não suportado ainda.',
        });
        continue;
      }

      const content = fs.readFileSync(fullPath, 'utf-8');
      const lines = content.split('\n');

      const pushResult = await page.evaluate(async ({ projectId, docId, lines }) => {
        const csrf = document.querySelector('meta[name="ol-csrfToken"]')?.getAttribute('content');
        const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
        if (csrf) headers['X-CSRF-Token'] = csrf;

        for (const url of [
          `/api/v1/project/${projectId}/doc/${docId}`,
          `/project/${projectId}/doc/${docId}`,
        ]) {
          try {
            const res = await fetch(url, {
              method: 'POST',
              credentials: 'include',
              headers,
              body: JSON.stringify({ lines }),
            });
            if (res.ok) return { ok: true, status: res.status, url };
          } catch {}
        }
        return { ok: false };
      }, { projectId, docId: remote.id, lines });

      results.push({
        file: relPath,
        status: pushResult.ok ? 'enviado' : 'erro',
        docId: remote.id,
        endpoint: pushResult.url || null,
      });

    } else {
      // Arquivo binário: upload via FormData
      const fileBuffer = fs.readFileSync(fullPath);
      const base64 = fileBuffer.toString('base64');
      const mimeType = guessMime(ext);
      const fileName = path.basename(relPath);

      const uploadResult = await page.evaluate(async ({ projectId, fileName, base64, mimeType }) => {
        const csrf = document.querySelector('meta[name="ol-csrfToken"]')?.getAttribute('content');

        const byteChars = atob(base64);
        const byteArr = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
        const blob = new Blob([byteArr], { type: mimeType });
        const file = new File([blob], fileName, { type: mimeType });

        const formData = new FormData();
        formData.append('qqfile', file);
        if (csrf) formData.append('_csrf', csrf);

        for (const url of [
          `/project/${projectId}/upload?folder_id=`,
          `/api/v1/project/${projectId}/upload`,
        ]) {
          try {
            const res = await fetch(url, {
              method: 'POST',
              credentials: 'include',
              body: formData,
            });
            if (res.ok) {
              const data = await res.json().catch(() => ({}));
              return { ok: true, status: res.status, url, data };
            }
          } catch {}
        }
        return { ok: false };
      }, { projectId, fileName, base64, mimeType });

      results.push({
        file: relPath,
        status: uploadResult.ok ? 'enviado' : 'erro (binário)',
        endpoint: uploadResult.url || null,
      });
    }
  }

  await saveSession();

  const enviados = results.filter(r => r.status === 'enviado').length;
  const erros = results.filter(r => r.status.startsWith('erro')).length;

  return {
    success: erros === 0,
    summary: `${enviados} arquivo(s) enviado(s), ${erros} erro(s)`,
    details: results,
  };
}

function walkDir(dir, base = '') {
  const entries = [];
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const rel = base ? `${base}/${entry}` : entry;
    if (fs.statSync(full).isDirectory()) entries.push(...walkDir(full, rel));
    else entries.push(rel);
  }
  return entries;
}

function guessMime(ext) {
  const map = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.pdf': 'application/pdf',
    '.svg': 'image/svg+xml',
    '.eps': 'application/postscript',
  };
  return map[ext] || 'application/octet-stream';
}
