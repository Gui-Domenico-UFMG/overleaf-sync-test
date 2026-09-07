import { getBrowser, ensureLoggedIn, saveSession } from '../browser.js';
import { listFiles } from './listFiles.js';

/**
 * Escreve/atualiza o conteúdo de um documento LaTeX no Overleaf pelo caminho.
 * Usa fetch autenticado com CSRF token extraído da página.
 */
export async function writeFile({ projectId, filePath, content }) {
  if (!projectId) throw new Error('projectId é obrigatório');
  if (!filePath) throw new Error('filePath é obrigatório');
  if (content === undefined) throw new Error('content é obrigatório');

  // Resolver o docId
  const files = await listFiles({ projectId });
  const found = files.find((f) => f.path === filePath || f.name === filePath);
  if (!found) throw new Error(`Arquivo '${filePath}' não encontrado no projeto.`);

  const { page, context } = await getBrowser();
  await ensureLoggedIn(page, context);

  if (!page.url().includes(`/project/${projectId}`)) {
    await page.goto(`https://www.overleaf.com/project/${projectId}`, { waitUntil: 'networkidle' });
  }

  const result = await page.evaluate(async ({ projectId, docId, content }) => {
    // Pegar CSRF token
    const csrfMeta = document.querySelector('meta[name="ol-csrfToken"]');
    const csrf = csrfMeta ? csrfMeta.getAttribute('content') : null;

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (csrf) headers['X-CSRF-Token'] = csrf;

    const endpoints = [
      { url: `/api/v1/project/${projectId}/doc/${docId}`, method: 'POST' },
      { url: `/project/${projectId}/doc/${docId}`, method: 'POST' },
    ];

    for (const ep of endpoints) {
      try {
        const res = await fetch(ep.url, {
          method: ep.method,
          credentials: 'include',
          headers,
          body: JSON.stringify({ lines: content.split('\n') }),
        });
        if (res.ok) return { success: true, status: res.status, endpoint: ep.url };
      } catch {}
    }
    return { success: false, error: 'Nenhum endpoint de escrita funcionou.' };
  }, { projectId, docId: found.id, content });

  await saveSession();
  return result;
}
