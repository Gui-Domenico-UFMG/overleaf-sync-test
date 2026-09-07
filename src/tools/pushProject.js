import { getBrowser, ensureLoggedIn, saveSession } from '../browser.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEXT_EXTS = ['.tex', '.bib', '.cls', '.sty', '.txt', '.md'];
const BINARY_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.pdf', '.svg', '.eps', '.tiff', '.tif'];

export async function pushProject({ projectId, localDir, files }) {
  if (!projectId) throw new Error('projectId eh obrigatorio');

  const srcDir = localDir ? path.resolve(localDir) : path.resolve(__dirname, '..', '..', 'projects', projectId);
  if (!fs.existsSync(srcDir)) throw new Error('Pasta local nao encontrada.');

  const targetFiles = (files && files.length > 0) ? files : walkDir(srcDir);
  const textFiles = targetFiles.filter(f => TEXT_EXTS.includes(path.extname(f).toLowerCase()));
  const binaryFiles = targetFiles.filter(f => BINARY_EXTS.includes(path.extname(f).toLowerCase()));
  const unknownFiles = targetFiles.filter(f => !TEXT_EXTS.includes(path.extname(f).toLowerCase()) && !BINARY_EXTS.includes(path.extname(f).toLowerCase()));

  if (textFiles.length === 0) return buildResult([], binaryFiles, unknownFiles, projectId);

  const { page, context } = await getBrowser();
  await ensureLoggedIn(page, context);

  await page.goto('https://www.overleaf.com/project/' + projectId, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  const results = [];

  for (const relPath of textFiles) {
    const fullPath = path.join(srcDir, relPath);
    if (!fs.existsSync(fullPath)) {
      results.push({ file: relPath, status: 'skipped', reason: 'nao encontrado local' });
      continue;
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    const filename = path.basename(relPath);

    const clicked = await page.evaluate((fname) => {
      const items = Array.from(document.querySelectorAll('.file-tree-entity-details'));
      const target = items.find(el => el.textContent.includes(fname));
      if (target) {
        target.click();
        return true;
      }
      return false;
    }, filename);

    if (!clicked) {
      results.push({ file: relPath, status: 'erro', reason: 'Arquivo nao encontrado na arvore.' });
      continue;
    }

    await page.waitForTimeout(2000);

    const updated = await page.evaluate((newContent) => {
      const cm = document.querySelector('.cm-content');
      if (cm && cm.cmView && cm.cmView.view) {
        const view = cm.cmView.view;
        view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: newContent } });
        return true;
      }
      return false;
    }, content);

    if (updated) {
      results.push({ file: relPath, status: 'OK enviado visual', endpoint: 'Visual' });
    } else {
      results.push({ file: relPath, status: 'erro', reason: 'Editor nao localizado' });
    }
  }

  await saveSession();
  return buildResult(results, binaryFiles, unknownFiles, projectId);
}

function buildResult(textResults, binaryFiles, unknownFiles, projectId) {
  const enviados = textResults.filter(r => r.status.startsWith('OK')).length;
  const erros = textResults.filter(r => r.status.startsWith('erro')).length;
  return { success: erros === 0, summary: enviados + ' arquivo(s) enviado(s), ' + erros + ' erro(s)', textFiles: textResults, binaryFiles: binaryFiles.length > 0 ? binaryFiles : null, unknownFiles: unknownFiles.length > 0 ? unknownFiles : null };
}

function walkDir(dir, base = '') {
  const entries = [];
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const rel = base ? base + '/' + entry : entry;
    if (fs.statSync(full).isDirectory()) entries.push(...walkDir(full, rel));
    else entries.push(rel);
  }
  return entries;
}
