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

  // [DEBUG HTTP] registrar a resposta interceptada
  const interceptedResponse = await responsePromise;
  if (interceptedResponse) {
    console.log('[DEBUG HTTP]');
    console.log('  status=', interceptedResponse.status());
    console.log('  url=', interceptedResponse.url());
    try {
      const body = await interceptedResponse.text();
      console.log('  body (primeiros 500 chars)=', body.slice(0, 500));
    } catch (e) {
      console.log('  body=ERRO AO LER:', e.message);
    }
  } else {
    console.log('[DEBUG HTTP] nenhuma resposta interceptada para /project/' + projectId);
  }

  // Extrair via meta tags (Overleaf injeta ol-rootFolder)
  const debugExtraction = await page.evaluate(() => {
    const getMeta = (name) => {
      const el = document.querySelector(`meta[name="${name}"]`);
      if (!el) return null;
      try { return JSON.parse(el.getAttribute('content') || 'null'); } catch { return null; }
    };

    // [DEBUG PROJECTDATA] verificar window.projectData e chaves relacionadas
    const projectDataExists = typeof window.projectData !== 'undefined';
    const projectKeys = Object.keys(window).filter(k => k.toLowerCase().includes('project'));
    console.log('[DEBUG PROJECTDATA]');
    console.log('  exists=', projectDataExists);
    console.log('  projectKeys=', JSON.stringify(projectKeys));
    if (projectDataExists) {
      console.log('  window.projectData=', JSON.stringify(window.projectData).slice(0, 500));
    }

    const rootFolder = getMeta('ol-rootFolder');
    const allMetas = Array.from(document.querySelectorAll('meta[name^="ol-"]')).map(m => ({
      name: m.getAttribute('name'),
      contentPreview: (m.getAttribute('content') || '').slice(0, 120),
    }));

    // Fallback: procurar em scripts
    let scriptFallback = null;
    const scripts = Array.from(document.querySelectorAll('script:not([src])'));
    for (const s of scripts) {
      const m = s.textContent.match(/"rootFolder"\s*:\s*(\[.+?\])/s);
      if (m) {
        try { scriptFallback = JSON.parse(m[1]); break; } catch {}
      }
    }

    return { rootFolder, allMetas, scriptFallback, projectDataExists, projectKeys };
  });

  // [DEBUG LISTFILES RAW] imprimir tudo que foi extraído do DOM
  console.log('[DEBUG LISTFILES RAW]');
  console.log('  ol-rootFolder encontrado=', debugExtraction.rootFolder !== null);
  console.log('  scriptFallback encontrado=', debugExtraction.scriptFallback !== null);
  console.log('  window.projectData exists=', debugExtraction.projectDataExists);
  console.log('  projectKeys=', JSON.stringify(debugExtraction.projectKeys));
  console.log('  todas as meta ol-* presentes=', JSON.stringify(debugExtraction.allMetas, null, 2));
  if (debugExtraction.rootFolder) {
    console.log('  ol-rootFolder (preview)=', JSON.stringify(debugExtraction.rootFolder).slice(0, 500));
  }
  if (debugExtraction.scriptFallback) {
    console.log('  scriptFallback (preview)=', JSON.stringify(debugExtraction.scriptFallback).slice(0, 500));
  }

  fileTree = debugExtraction.rootFolder || debugExtraction.scriptFallback;

  await saveSession();

  if (!fileTree) {
    console.log('[DEBUG LISTFILES RETURN] fileTree=null → retornando objeto de erro (NÃO é array!)');
    return { error: 'Não foi possível extrair a estrutura de arquivos. Verifique se o projectId está correto.' };
  }

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
  const flatList = flatten(root);

  // [DEBUG LISTFILES RETURN] valor exato retornado para pushProject
  console.log('[DEBUG LISTFILES RETURN]');
  console.log('  tipo=', typeof flatList);
  console.log('  isArray=', Array.isArray(flatList));
  console.log('  length=', flatList.length);
  console.log('  conteúdo=', JSON.stringify(flatList, null, 2));

  return flatList;
}
