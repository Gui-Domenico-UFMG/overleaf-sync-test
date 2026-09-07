import { getBrowser, ensureLoggedIn, saveSession } from '../browser.js';

/**
 * Lê o conteúdo de um documento pelo ID (obtido via listFiles).
 * Usa a rota interna /project/:id/doc/:docId que retorna o conteúdo do documento.
 */
export async function readFileById({ projectId, docId }) {
  if (!projectId) throw new Error('projectId é obrigatório');
  if (!docId) throw new Error('docId é obrigatório');

  const { page, context } = await getBrowser();
  await ensureLoggedIn(page, context);

  // Garantir que o editor esteja aberto para ter cookies/sessão válidos
  const currentUrl = page.url();
  if (!currentUrl.includes(`/project/${projectId}`)) {
    await page.goto(`https://www.overleaf.com/project/${projectId}`, { waitUntil: 'networkidle' });
  }

  // Fazer fetch autenticado usando o contexto do browser (cookies já injetados)
  const content = await page.evaluate(async ({ projectId, docId }) => {
    const endpoints = [
      `/api/v1/project/${projectId}/doc/${docId}`,
      `/project/${projectId}/doc/${docId}`,
    ];

    for (const url of endpoints) {
      try {
        const res = await fetch(url, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          // O Overleaf retorna { lines: [...] }
          if (data.lines) return data.lines.join('\n');
          if (data.content) return data.content;
          return JSON.stringify(data);
        }
      } catch {}
    }
    return null;
  }, { projectId, docId });

  await saveSession();

  if (content === null) {
    throw new Error(
      `Não foi possível ler o documento ${docId}. ` +
      `O endpoint pode ter mudado. Abra o Overleaf no navegador para verificar.`
    );
  }

  return { docId, projectId, content };
}
