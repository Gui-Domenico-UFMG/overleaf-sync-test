# Instalação e Uso — Overleaf MCP Server

## Pré-requisitos
- Node.js >= 18
- npm

## 1. Instalar dependências
```bash
npm install
npx playwright install chromium
```

## 2. Fazer login (UMA VEZ)
Este comando abre um navegador real para você fazer login no Overleaf.
A sessão é salva em `.playwright-session/state.json` e reutilizada automaticamente.
```bash
node src/login.js
```

## 3. Registrar no Antigravity
Adicione ao seu `antigravity.config.json` (ou equivalente):
```json
{
  "mcpServers": {
    "overleaf": {
      "command": "node",
      "args": ["/CAMINHO/ABSOLUTO/DO/PROJETO/src/index.js"],
      "env": {}
    }
  }
}
```

## 4. Iniciar manualmente (opcional, para teste)
```bash
node src/index.js
```

## Ferramentas disponíveis
| Ferramenta | Parâmetros | Descrição |
|---|---|---|
| `overleaf_list_projects` | — | Lista todos os projetos |
| `overleaf_project_info` | `projectId` | Info detalhada do projeto |
| `overleaf_list_files` | `projectId` | Lista arquivos do projeto |
| `overleaf_read_file` | `projectId`, `filePath` | Lê arquivo pelo caminho |
| `overleaf_read_file_by_id` | `projectId`, `docId` | Lê arquivo pelo ID |
| `overleaf_write_file` | `projectId`, `filePath`, `content` | Escreve/atualiza arquivo |
| `overleaf_compile` | `projectId` | Compila o projeto e retorna status |

## Observações
- A sessão expira periodicamente. Rode `node src/login.js` novamente se ocorrer erro de sessão.
- O servidor usa `headless: true` em produção. Mude para `false` para depuração visual.
- A pasta `.playwright-session/` está no `.gitignore` — nunca faça commit dela (contém cookies de sessão).
