import { getOverleafCookies } from '../extractCookies.js';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Baixa o ZIP completo do projeto Overleaf e extrai localmente.
 * Rota /project/:id/download/zip confirmada funcionando (Status 200).
 */
export async function pullProject({ projectId, outputDir }) {
  if (!projectId) throw new Error('projectId é obrigatório');

  const destDir = outputDir
    ? path.resolve(outputDir)
    : path.resolve(__dirname, '..', '..', 'projects', projectId);

  const cookies = await getOverleafCookies();
  if (!cookies || cookies.length === 0) {
    throw new Error('Nenhum cookie do Overleaf encontrado no Firefox. Faça login no Overleaf pelo Firefox primeiro.');
  }

  const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
  const url = `https://www.overleaf.com/project/${projectId}/download/zip`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Cookie': cookieHeader,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0',
      'Accept': 'application/zip, application/octet-stream, */*',
      'Referer': `https://www.overleaf.com/project/${projectId}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Falha ao baixar ZIP: HTTP ${response.status} ${response.statusText}`);
  }

  const tempZip = path.join(os.tmpdir(), `overleaf_${projectId}_${Date.now()}.zip`);
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(tempZip, buffer);

  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

  // FIX: try/catch explícito para dynamic import do adm-zip
  try {
    let AdmZip;
    try {
      const mod = await import('adm-zip');
      AdmZip = mod.default;
    } catch {
      AdmZip = null;
    }

    if (AdmZip) {
      const zip = new AdmZip(tempZip);
      zip.extractAllTo(destDir, true);
    } else {
      // Fallback PowerShell (Windows) ou unzip (Linux/Mac)
      if (process.platform === 'win32') {
        execSync(`powershell -command "Expand-Archive -Path '${tempZip}' -DestinationPath '${destDir}' -Force"`);
      } else {
        execSync(`unzip -o "${tempZip}" -d "${destDir}"`);
      }
    }
  } finally {
    // Sempre remove o ZIP temporário mesmo se a extração falhar
    try { fs.unlinkSync(tempZip); } catch {}
  }

  const extracted = [];
  function walk(dir, base = '') {
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry);
      const rel = base ? `${base}/${entry}` : entry;
      if (fs.statSync(full).isDirectory()) walk(full, rel);
      else extracted.push(rel);
    }
  }
  walk(destDir);

  return {
    success: true,
    projectId,
    outputDir: destDir,
    filesExtracted: extracted.length,
    files: extracted,
  };
}
