import { getBrowser, ensureLoggedIn, saveSession } from '../browser.js';

/**
 * Lista todos os arquivos (docs e fileRefs) de um projeto Overleaf.
 * Extrai a estrutura de pastas e arquivos via meta tags injetadas pelo Overleaf.
 */
export async function listFiles({ projectId }) {
  if (!projectId) throw new Error('projectId é obrigatório');

  const { page, context } = await getBrowser();
  await ensureLoggedIn(page, context);

  let fileTree = null;

  // Interceptar chamada de inicialização do editor que contém rootFolder
  const responsePromise = page.waitForResponse(
    (r) => (r.url().includes(`/project/${projectId}`) && r.request().method() === 'GET'),
    { timeout: 20000 }
  ).catch(() => null);

  await page.goto(`https://www.overleaf.com/project/${projectId}`, { waitUntil: 'networkidle' });

  // Extrair via meta tags (Overleaf injeta ol-rootFolder)
  fileTree = await page.evaluate(() => {
    const getMeta = (name) => {
      const el = document.querySelector(`meta[name="${name}"]`);
      if (!el) return null;
      try { return JSON.parse(el.getAttribute('content') || 'null'); } catch { return null; }
    };
    const rootFolder = getMeta('ol-rootFolder');
    if (rootFolder) return rootFolder;

    // Fallback: procurar em scripts
    const scripts = Array.from(document.querySelectorAll('script:not([src])'));
    for (const s of scripts) {
      const m = s.textContent.match(/"rootFolder"\s*:\s*(\[.+?\])/s);
      if (m) {
        try { return JSON.parse(m[1]); } catch {}
      }
    }
    return null;
  });

  await saveSession();

  if (!fileTree) return { error: 'Não foi possível extrair a estrutura de arquivos. Verifique se o projectId está correto.' };

  // Achatar a árvore em lista plana
  function flatten(folder, prefix = '') {
    const results = [];
    for (const doc of (folder.docs || [])) {
      results.push({ type: 'doc', id: doc._id, name: doc.name, path: prefix + doc.name });
    }
    for (const file of (folder.fileRefs || [])) {
      results.push({ type: 'file', id: file._id, name: file.name, path: prefix + file.name });
    }
    for (const sub of (folder.folders || [])) {
      results.push(...flatten(sub, prefix + sub.name + '/'));
    }
    return results;
  }

  const root = Array.isArray(fileTree) ? fileTree[0] : fileTree;
  return flatten(root);
}
