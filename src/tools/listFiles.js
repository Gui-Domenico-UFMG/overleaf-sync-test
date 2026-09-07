import { getProjectFilesViaSocket } from '../overleafSocket.js';

/**
 * Lista todos os arquivos (docs e fileRefs) de um projeto Overleaf.
 *
 * Usa Socket.IO joinProject para obter rootFolder com docIds internos.
 * Esta abordagem substitui a leitura de `ol-rootFolder` (meta tag removida
 * pelo Overleaf em 2025/2026 — ver DIAGNOSTICO.md).
 */
export async function listFiles({ projectId }) {
  if (!projectId) throw new Error('projectId é obrigatório');
  return getProjectFilesViaSocket(projectId);
}
