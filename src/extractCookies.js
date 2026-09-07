import sqlite3 from 'sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';

function getStoreFirefoxProfilePath() {
  const home = os.homedir();
  if (process.platform === 'win32') {
    const packagesPath = path.join(home, 'AppData', 'Local', 'Packages');
    if (fs.existsSync(packagesPath)) {
      const folders = fs.readdirSync(packagesPath).filter(f => f.startsWith('Mozilla.Firefox'));
      for (const folder of folders) {
        const profilesPath = path.join(packagesPath, folder, 'LocalCache', 'Roaming', 'Mozilla', 'Firefox', 'Profiles');
        if (fs.existsSync(profilesPath)) {
          const profiles = fs.readdirSync(profilesPath).filter(d => fs.statSync(path.join(profilesPath, d)).isDirectory());
          for (const profile of profiles) {
            const dbPath = path.join(profilesPath, profile, 'cookies.sqlite');
            if (fs.existsSync(dbPath)) {
              return dbPath;
            }
          }
        }
      }
    }
  }
  return null;
}

export async function getOverleafCookies() {
  const dbPath = getStoreFirefoxProfilePath();
  
  if (!dbPath) {
    console.warn(`[Aviso] Banco de cookies do Firefox (Store) não encontrado. Retornando vazio.`);
    return [];
  }

  return new Promise((resolve, reject) => {
    const tempDbPath = path.join(os.tmpdir(), `firefox_cookies_copy_${Date.now()}.sqlite`);
    fs.copyFileSync(dbPath, tempDbPath);

    const db = new sqlite3.Database(tempDbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) return reject(err);
    });

    const query = `
      SELECT name, value, host as domain, path, expiry as expires, isSecure as secure, isHttpOnly as httpOnly
      FROM moz_cookies 
      WHERE host LIKE '%overleaf.com%'
    `;

    db.all(query, [], (err, rows) => {
      db.close();
      fs.unlinkSync(tempDbPath);

      if (err) return reject(err);

      const cookies = rows.map(row => ({
        name: row.name,
        value: row.value,
        domain: row.domain.startsWith('.') ? row.domain : '.' + row.domain, // Playwright prefere domínios com ponto inicial se for pra subdomínios
        path: row.path,
        expires: row.expires,
        secure: row.secure === 1,
        httpOnly: row.httpOnly === 1,
        sameSite: 'Lax'
      }));

      resolve(cookies);
    });
  });
}
