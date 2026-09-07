import sqlite3 from 'sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';

function getStoreFirefoxProfilePath() {
  const home = os.homedir();
  if (process.platform !== 'win32') return null;

  const packagesPath = path.join(home, 'AppData', 'Local', 'Packages');
  if (!fs.existsSync(packagesPath)) return null;

  const folders = fs.readdirSync(packagesPath).filter(f => f.startsWith('Mozilla.Firefox'));
  for (const folder of folders) {
    const profilesPath = path.join(
      packagesPath, folder, 'LocalCache', 'Roaming', 'Mozilla', 'Firefox', 'Profiles'
    );
    if (!fs.existsSync(profilesPath)) continue;

    const profiles = fs.readdirSync(profilesPath)
      .filter(d => fs.statSync(path.join(profilesPath, d)).isDirectory());

    for (const profile of profiles) {
      const dbPath = path.join(profilesPath, profile, 'cookies.sqlite');
      if (fs.existsSync(dbPath)) return dbPath;
    }
  }
  return null;
}

export async function getOverleafCookies() {
  const dbPath = getStoreFirefoxProfilePath();

  if (!dbPath) {
    console.warn('[Aviso] Banco de cookies do Firefox (Store) não encontrado. Retornando vazio.');
    return [];
  }

  // Copia o arquivo para evitar lock do Firefox no arquivo original
  const tempDbPath = path.join(os.tmpdir(), `firefox_cookies_copy_${Date.now()}.sqlite`);
  fs.copyFileSync(dbPath, tempDbPath);

  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(tempDbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        try { fs.unlinkSync(tempDbPath); } catch {}
        return reject(err);
      }
    });

    const query = `
      SELECT name, value, host AS domain, path, expiry AS expires,
             isSecure AS secure, isHttpOnly AS httpOnly
      FROM moz_cookies
      WHERE host LIKE '%overleaf.com%'
    `;

    db.all(query, [], (err, rows) => {
      // FIX: fechar o banco dentro do callback e só depois deletar o arquivo
      // No Windows o SQLite mantém lock no arquivo até o close() completar
      db.close((closeErr) => {
        try { fs.unlinkSync(tempDbPath); } catch {}

        if (err) return reject(err);
        if (closeErr) console.warn('[Aviso] Erro ao fechar SQLite:', closeErr.message);

        const cookies = rows.map(row => ({
        name: row.name,
        value: row.value,
        domain: row.domain.startsWith('.') ? row.domain : '.' + row.domain, // Playwright prefere domínios com ponto inicial se for pra subdomínios
        path: row.path,
        expires: -1, // Definido como sessão (-1) para evitar erro no Playwright com timestamps gigantes
        secure: row.secure === 1,
        httpOnly: row.httpOnly === 1,
        sameSite: 'Lax'
      }));

        resolve(cookies);
      });
    });
  });
}
