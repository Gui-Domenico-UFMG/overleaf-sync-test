import { getBrowser, ensureLoggedIn, saveSession } from '../browser.js';
import { listFiles } from './listFiles.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Extensões de texto enviadas automaticamente via MCP
const TEXT_EXTS = ['.tex', '.bib', '.cls', '.sty', '.txt', '.md'];

// Extensões binárias que precisam de upload manual no Overleaf
const BINARY_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.pdf', '.svg', '.eps', '.tiff', '.tif'];

/**
 * Envia arquivos de texto (.tex, .bib, etc.) de volta para o Overleaf (versão gratuita).
 * Arquivos binários (imagens, PDFs) são PULADOS e listados para upload manual pelo usuário.
 *
 * Como fazer upload manual de binários:
 *   Overleaf → botão "+" ou menu Insert → Upload → arraste os arquivos
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

  // Separar arquivos de texto (automático) de binários (manual)
  const textFiles   = targetFiles.filter(f => TEXT_EXTS.includes(path.extname(f).toLowerCase()));
  const binaryFiles = targetFiles.filter(f => BINARY_EXTS.includes(path.extname(f).toLowerCase()));
  const unknownFiles = targetFiles.filter(f => {
    const ext = path.extname(f).toLowerCase();
    return !TEXT_EXTS.includes(ext) && !BINARY_EXTS.includes(ext);
  });

  // Se não há nada de texto para enviar, retornar logo com instruções
  if (textFiles.length === 0) {
    return buildResult([], binaryFiles, unknownFiles, projectId);
  }

  // Abrir Playwright UMA vez para todos os arquivos de texto
  const { page, context } = await getBrowser();
  await ensureLoggedIn(page, context);

  if (!page.url().includes(`/project/${projectId}`)) {
    await page.goto(`https://www.overleaf.com/project/${projectId}`, { waitUntil: 'networkidle' });
  }

  // Mapa caminho/nome → docId
  const remoteFiles = await listFiles({ projectId });
  const docMap = {};
  for (const f of remoteFiles) {
    docMap[f.path] = f;
    docMap[f.name] = f;
  }

  const results = [];

  for (const relPath of textFiles) {
    const fullPath = path.join(srcDir, relPath);
    if (!fs.existsSync(fullPath)) {
      results.push({ file: relPath, status: 'skipped', reason: 'arquivo não encontrado localmente' });
      continue;
    }

    const remote = docMap[relPath] || docMap[path.basename(relPath)];
    if (!remote || !remote.id) {
      results.push({
        file: relPath,
        status: 'erro',
        reason: 'docId não encontrado no projeto remoto. Arquivo novo? Crie-o no Overleaf primeiro.',
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
      status: pushResult.ok ? '✅ enviado' : '❌ erro',
      docId: remote.id,
      endpoint: pushResult.url || null,
    });
  }

  await saveSession();

  return buildResult(results, binaryFiles, unknownFiles, projectId);
}

function buildResult(textResults, binaryFiles, unknownFiles, projectId) {
  const enviados = textResults.filter(r => r.status.startsWith('✅')).length;
  const erros    = textResults.filter(r => r.status.startsWith('❌')).length;

  const manualInstructions = binaryFiles.length > 0
    ? [
        '',
        '📎 UPLOAD MANUAL NECESSÁRIO para arquivos binários:',
        ...binaryFiles.map(f => `   • ${f}`),
        '',
        'Como fazer:',
        '  1. Abra o projeto no Overleaf: https://www.overleaf.com/project/' + projectId,
        '  2. Clique no botão "+" (Add files) no painel esquerdo',
        '  3. Escolha "Upload" e arraste os arquivos acima',
      ]
    : [];

  return {
    success: erros === 0,
    summary: `${enviados} arquivo(s) de texto enviado(s) automaticamente, ${erros} erro(s)`,
    textFiles: textResults,
    manualUploadRequired: binaryFiles.length > 0,
    binaryFiles: binaryFiles.length > 0 ? {
      message: '⚠️ Estes arquivos precisam de upload manual no Overleaf (Add files → Upload):',
      files: binaryFiles,
      url: `https://www.overleaf.com/project/${projectId}`,
    } : null,
    unknownFiles: unknownFiles.length > 0 ? {
      message: 'Arquivos com extensão desconhecida (ignorados):',
      files: unknownFiles,
    } : null,
    instructions: manualInstructions.join('\n') || null,
  };
}

function walkDir(dir, base = '') {
  const entries = [];
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const rel  = base ? `${base}/${entry}` : entry;
    if (fs.statSync(full).isDirectory()) entries.push(...walkDir(full, rel));
    else entries.push(rel);
  }
  return entries;
}
