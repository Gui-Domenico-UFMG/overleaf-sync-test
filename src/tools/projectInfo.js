import { getBrowser, ensureLoggedIn, saveSession } from '../browser.js';

/**
 * Retorna informações detalhadas de um projeto:
 * nome, dono, colaboradores, compilador.
 */
export async function projectInfo({ projectId }) {
  if (!projectId) throw new Error('projectId é obrigatório');

  const { page, context } = await getBrowser();
  await ensureLoggedIn(page, context);

  // Interceptar a resposta do join do projeto que contém metadados completos
  let projectData = null;

  const responsePromise = page.waitForResponse(
    (r) => r.url().includes(`/project/${projectId}/`) && r.status() === 200,
    { timeout: 15000 }
  ).catch(() => null);

  await page.goto(`https://www.overleaf.com/project/${projectId}`, { waitUntil: 'domcontentloaded' });

  const response = await responsePromise;
  if (response) {
    try { projectData = await response.json(); } catch {}
  }

  // Fallback: extrair do DOM
  if (!projectData) {
    projectData = await page.evaluate(() => {
      const getMeta = (name) => {
        const el = document.querySelector(`meta[name="${name}"]`);
        return el ? el.getAttribute('content') : null;
      };
      return {
        name: getMeta('ol-projectName') || document.title,
        owner: getMeta('ol-userEmail'),
        compiler: getMeta('ol-compiler') || 'pdflatex',
        rootDocId: getMeta('ol-rootDocId'),
      };
    });
  }

  await saveSession();
  return projectData;
}
