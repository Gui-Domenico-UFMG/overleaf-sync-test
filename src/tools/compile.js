import { getBrowser, ensureLoggedIn, saveSession } from '../browser.js';

/**
 * Compila um projeto Overleaf e retorna o status.
 * Dispara a compilação via endpoint interno e aguarda o resultado.
 */
export async function compile({ projectId }) {
  if (!projectId) throw new Error('projectId é obrigatório');

  const { page, context } = await getBrowser();
  await ensureLoggedIn(page, context);

  if (!page.url().includes(`/project/${projectId}`)) {
    await page.goto(`https://www.overleaf.com/project/${projectId}`, { waitUntil: 'networkidle' });
  }

  const result = await page.evaluate(async ({ projectId }) => {
    const csrfMeta = document.querySelector('meta[name="ol-csrfToken"]');
    const csrf = csrfMeta ? csrfMeta.getAttribute('content') : null;

    const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
    if (csrf) headers['X-CSRF-Token'] = csrf;

    const endpoints = [
      `/api/v1/project/${projectId}/compile`,
      `/project/${projectId}/compile`,
    ];

    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          credentials: 'include',
          headers,
          body: JSON.stringify({ check: 'silent', draft: false, stopOnFirstError: false }),
        });
        if (res.ok) {
          const data = await res.json();
          return {
            success: true,
            status: data.status,
            pdfUrl: data.outputFiles?.find(f => f.type === 'pdf')?.url || null,
            errors: data.outputFiles?.filter(f => f.type === 'log') || [],
            raw: data,
          };
        }
      } catch {}
    }
    return { success: false, error: 'Não foi possível disparar a compilação.' };
  }, { projectId });

  await saveSession();
  return result;
}
