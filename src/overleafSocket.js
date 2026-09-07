/**
 * overleafSocket.js
 *
 * Obtém a árvore de arquivos de um projeto Overleaf via Socket.IO.
 *
 * O Overleaf usa o protocolo Socket.IO v2 (engine.io v3) com o evento
 * proprietário `joinProject` para retornar rootFolder com os docIds internos.
 * Esta é a única superfície que ainda expõe esses IDs no Free tier —
 * confirmado após o Overleaf remover a meta tag `ol-rootFolder` em 2025/2026.
 *
 * Referência: NiccoloSalvini/overleaf-mcp (MIT)
 *             https://github.com/NiccoloSalvini/overleaf-mcp
 */

// socket.io-client@2 exporta a função `io` como export default E como
// propriedade `.io` do módulo CJS. Com ESM + "type":"module" no package.json
// o import default funciona corretamente.
import io from 'socket.io-client';
import { getOverleafCookies } from './extractCookies.js';

const BASE_URL = 'https://www.overleaf.com';
const TIMEOUT_MS = 20000;

/**
 * Retorna a lista plana de arquivos (docs + fileRefs) de um projeto.
 * Cada item: { type, id, name, path }
 *
 * @param {string} projectId
 * @returns {Promise<Array<{type: string, id: string, name: string, path: string}>>}
 */
export async function getProjectFilesViaSocket(projectId) {
  const cookies = await getOverleafCookies();
  const cookieHeader = cookies
    .map(c => `${c.name}=${c.value}`)
    .join('; ');

  return new Promise((resolve, reject) => {
    // BUG CORRIGIDO: `socket` não pode ser referenciado no timer antes de ser
    // definido. O timer agora é criado DEPOIS da declaração do socket,
    // garantindo que a referência existe quando o timeout disparar.
    const socket = io(BASE_URL, {
      // Polling é obrigatório: o Overleaf usa engine.io v3 que não negocia
      // upgrade para websocket quando acessado fora do browser.
      transports: ['polling'],
      extraHeaders: { cookie: cookieHeader },
      reconnection: false,
      timeout: TIMEOUT_MS,
    });

    const timer = setTimeout(() => {
      socket.disconnect();
      reject(new Error(
        `Socket.IO joinProject timeout (${TIMEOUT_MS}ms) para projeto ${projectId}. ` +
        'Verifique se os cookies do Firefox estão frescos.'
      ));
    }, TIMEOUT_MS);

    socket.on('connect', () => {
      socket.emit('joinProject', { project_id: projectId }, (error, projectInfo) => {
        clearTimeout(timer);
        socket.disconnect();

        if (error) {
          return reject(new Error(
            `joinProject retornou erro para ${projectId}: ${JSON.stringify(error)}`
          ));
        }
        if (!projectInfo || !projectInfo.rootFolder) {
          return reject(new Error(
            `joinProject não retornou rootFolder para ${projectId}. ` +
            `Resposta: ${JSON.stringify(projectInfo)}`
          ));
        }

        const root = Array.isArray(projectInfo.rootFolder)
          ? projectInfo.rootFolder[0]
          : projectInfo.rootFolder;

        resolve(flattenFolder(root, ''));
      });
    });

    socket.on('connect_error', (err) => {
      clearTimeout(timer);
      socket.disconnect();
      reject(new Error(`Socket.IO connect_error: ${err.message}`));
    });
  });
}

/**
 * Achata a árvore de pastas em lista plana.
 * @param {object} folder
 * @param {string} prefix
 * @returns {Array}
 */
function flattenFolder(folder, prefix) {
  const results = [];
  for (const doc of (folder.docs || [])) {
    results.push({ type: 'doc', id: doc._id, name: doc.name, path: prefix + doc.name });
  }
  for (const file of (folder.fileRefs || [])) {
    results.push({ type: 'file', id: file._id, name: file.name, path: prefix + file.name });
  }
  for (const sub of (folder.folders || [])) {
    results.push(...flattenFolder(sub, prefix + sub.name + '/'));
  }
  return results;
}
