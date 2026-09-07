import { getBrowser, ensureLoggedIn, saveSession } from '../browser.js';
import { listFiles } from './listFiles.js';

/**
 * Lê o conteúdo de um arquivo .tex / .bib / .cls pelo caminho (ex: 'main.tex').
 */
export async function readFile({ projectId, filePath }) {
  if (!projectId) throw new Error('projectId é obrigatório');
  if (!filePath) throw new Error('filePath é obrigatório');

  // Encontrar o docId pelo caminho
  const files = await listFiles({ projectId });
  const found = files.find(
    (f) => f.path === filePath || f.name === filePath
  );

  if (!found) throw new Error(`Arquivo '${filePath}' não encontrado no projeto.`);

  return readFileById({ projectId, docId: found.id });
}

import { readFileById } from './readFileById.js';
