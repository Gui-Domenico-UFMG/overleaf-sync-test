import { getBrowser, ensureLoggedIn, saveSession } from '../browser.js';

/**
 * Lista todos os projetos do usuário autenticado.
 * Navega para /project e extrai a lista via DOM.
 */
export async function listProjects() {
  const { page, context } = await getBrowser();
  await ensureLoggedIn(page, context);

  await page.goto('https://www.overleaf.com/project', { waitUntil: 'domcontentloaded' });

  const projects = await page.evaluate(() => {
    // Overleaf injeta os dados em window._ol_project_list ou em elementos data-
    // Tentativa 1: via React props / dados embutidos no HTML
    const scriptTags = Array.from(document.querySelectorAll('script[type="application/json"]'));
    for (const tag of scriptTags) {
      try {
        const data = JSON.parse(tag.textContent);
        if (data && data.projects) return data.projects;
        if (data && Array.isArray(data)) return data;
      } catch {}
    }

    // Tentativa 2: via elementos DOM
    const items = document.querySelectorAll('[data-project-id]');
    if (items.length > 0) {
      return Array.from(items).map(el => ({
        id: el.getAttribute('data-project-id'),
        name: el.querySelector('.project-list-card-title, h3, .title')?.textContent?.trim() || 'Sem nome',
      }));
    }

    // Tentativa 3: meta tag bootstrap data
    const meta = document.querySelector('meta[name="ol-projects"]');
    if (meta) {
      try { return JSON.parse(meta.getAttribute('content') || '[]'); } catch {}
    }

    return [];
  });

  // Tentativa via interceptação de resposta de rede (fallback)
  if (!projects || projects.length === 0) {
    // Recarrega e intercepta a chamada /api/v2/projects
    const responseData = await new Promise(async (resolve) => {
      page.once('response', async (response) => {
        if (response.url().includes('/api/v2/projects') || response.url().includes('/user/projects')) {
          try {
            const json = await response.json();
            resolve(json);
          } catch { resolve(null); }
        }
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
      setTimeout(() => resolve(null), 8000);
    });

    if (responseData) {
      await saveSession();
      return responseData.projects || responseData || [];
    }
  }

  await saveSession();
  return projects || [];
}
