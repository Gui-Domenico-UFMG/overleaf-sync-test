# Overleaf MCP Server — Firefox Cookie + ZIP Architecture

Servidor MCP para integração com o Overleaf via cookies do Firefox (Microsoft Store) e download de ZIP.

---

## ✅ Status Atual

| Item | Status |
|---|---|
| Extração de cookies do Firefox (Store) | ✅ Funcionando |
| Injeção de cookies no Playwright | ✅ Funcionando |
| Rota `/project/ID/download/zip` | ✅ **Confirmada (Status 200)** |
| Servidor MCP com 7 ferramentas | ✅ Implementado |
| Ferramenta `overleaf_pull_project` (ZIP) | 🔜 Próximo passo |

---

## 🏗️ Arquitetura: ZIP-Pull + Push

### Por que ZIP?
A rota `/project/:id/download/zip` foi **testada e confirmada funcionando** com os cookies do Firefox.
Ela retorna o projeto inteiro estruturado (`.tex`, `.bib`, imagens, subpastas) em um único request,
sem depender de endpoints internos que foram removidos pelo Overleaf (erro 404).

### Fluxo completo

```
┌─────────────────────────────────────────────┐
│              ANTIGRAVITY (IA)               │
└────────────────────┬────────────────────────┘
                     │ chama MCP tool
┌────────────────────▼────────────────────────┐
│           SERVIDOR MCP (Node.js)            │
│  cookies Firefox Store → autenticação HTTP  │
└──────┬──────────────────────────────┬───────┘
       │ GET /project/ID/download/zip │ POST endpoints
┌──────▼──────────┐         ┌────────▼────────┐
│  Overleaf.com   │         │  Playwright      │
│  (ZIP download) │         │  (compile/write) │
└──────┬──────────┘         └─────────────────┘
       │ extrai ZIP
┌──────▼──────────────────┐
│  Pasta local do projeto  │
│  (leitura/edição rápida) │
└─────────────────────────┘
```

### Pull (Download)
`overleaf_pull_project` → baixa ZIP → extrai em pasta local → IA lê/edita localmente (rápido, sem web scraping por arquivo).

### Push (Upload de volta)
- **Overleaf Premium**: `git push` nativo via sincronização Git do Overleaf.
- **Overleaf Gratuito**: Playwright detecta arquivos modificados e substitui via upload de arquivos soltos.

---

## 📁 Estrutura do Projeto

```
overleaf-sync-test/
├── package.json
├── .gitignore
├── README.md
├── INSTALL.md
├── main.tex
├── schemas/                        ← schemas MCP das 7 ferramentas originais
│   ├── overleaf_compile.json
│   ├── overleaf_list_files.json
│   ├── overleaf_list_projects.json
│   ├── overleaf_project_info.json
│   ├── overleaf_read_file.json
│   ├── overleaf_read_file_by_id.json
│   ├── overleaf_write_file.json
│   └── overleaf_pull_project.json  ← NOVO
└── src/
    ├── index.js                    ← servidor MCP principal
    ├── browser.js                  ← Playwright + injeção de cookies
    ├── extractCookies.js           ← lê cookies.sqlite do Firefox Store
    ├── login.js                    ← login interativo (fallback)
    └── tools/
        ├── listProjects.js
        ├── projectInfo.js
        ├── listFiles.js
        ├── readFile.js
        ├── readFileById.js
        ├── writeFile.js
        ├── compile.js
        └── pullProject.js          ← PRÓXIMO A IMPLEMENTAR
```

---

## 🔧 Ferramentas MCP Disponíveis

| Ferramenta | Parâmetros | Descrição |
|---|---|---|
| `overleaf_list_projects` | — | Lista todos os projetos |
| `overleaf_project_info` | `projectId` | Info detalhada do projeto |
| `overleaf_list_files` | `projectId` | Lista arquivos do projeto |
| `overleaf_read_file` | `projectId`, `filePath` | Lê arquivo pelo caminho |
| `overleaf_read_file_by_id` | `projectId`, `docId` | Lê arquivo pelo ID |
| `overleaf_write_file` | `projectId`, `filePath`, `content` | Escreve/atualiza arquivo |
| `overleaf_compile` | `projectId` | Compila e retorna status |
| `overleaf_pull_project` | `projectId`, `outputDir?` | **NOVO** — baixa ZIP e extrai localmente |

---

## 🚀 Instalação Rápida

```bash
npm install
npx playwright install chromium
node src/index.js
```

> A autenticação é automática via cookies do Firefox (Microsoft Store).
> Certifique-se de estar logado no Overleaf pelo Firefox antes de iniciar.

---

*Nota para a próxima IA: A rota `/project/:id/download/zip` está confirmada funcionando com cookies do Firefox Store. Implemente `pullProject.js` usando `node-fetch` + `adm-zip` para download e extração. O push para Overleaf Free deve usar Playwright para upload de arquivos individuais.*
