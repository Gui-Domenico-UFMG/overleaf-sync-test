# Relatório de Diagnóstico — `TypeError: remoteFiles is not iterable`

> Executado em: 2026-09-07  
> Método: instrumentação de observabilidade em `listFiles.js` e `pushProject.js`  
> Resultado: **causa-raiz confirmada**

---

## Resumo Executivo

O erro `TypeError: remoteFiles is not iterable` em `pushProject.js` ocorre porque
`listFiles()` retorna um **objeto de erro** `{ error: "..." }` em vez de um array,
devido à remoção pelo Overleaf da meta tag `ol-rootFolder` que era a fonte dos docIds.

---

## Evidências dos Logs (task-411)

### [DEBUG HTTP] — `listFiles.js`

```
status=  200
url=     https://www.overleaf.com/project/6a9727b994caf5ff0245727d
```

✅ A sessão está autenticada. Não há redirecionamento para `/login`.  
✅ O problema **não é** autenticação nem cookies.

---

### [DEBUG PROJECTDATA] — `page.evaluate` em `listFiles.js`

```
exists=      false
projectKeys= []   ← vazio
```

❌ `window.projectData` **não existe mais** no Overleaf.  
❌ Nenhuma variável global com a palavra "project" é exposta no `window`.  
→ O Overleaf encapsulou a store de dados dentro de um closure React/Redux fechado.

---

### [DEBUG LISTFILES RAW] — `listFiles.js`

```
ol-rootFolder encontrado=   false
scriptFallback encontrado=  false
```

❌ A meta tag `<meta name="ol-rootFolder">` **foi removida** pelo Overleaf.  
❌ O fallback de regex em `<script>` também não encontra `"rootFolder": [...]`.  
✅ O Overleaf ainda injeta dezenas de outras metas `ol-*`, mas **nenhuma contém a árvore de arquivos**.
   Exemplos do que ainda existe: `ol-user_id`, `ol-projectName`, `ol-ExposedSettings`,
   `ol-compileSettings`, `ol-defaultLatexCompiler`.

---

### [DEBUG LISTFILES RETURN] — `listFiles.js`

```
tipo=    object
isArray= false
conteúdo= { "error": "Não foi possível extrair a estrutura de arquivos..." }
```

❌ `listFiles()` retorna um **objeto**, não um array.  
→ Este é o valor exato que chega em `pushProject` como `remoteFiles`.

---

### [DEBUG PUSH] + [DIAGNÓSTICO] — `pushProject.js`

```
projectId=        6a9727b994caf5ff0245727d
remoteFilesType=  object
isArray=          false
remoteFiles=      { "error": "Não foi possível extrair a estrutura de arquivos..." }
```

→ O `throw` diagnóstico foi acionado:

```
Error: [DIAGNÓSTICO] listFiles() não retornou um array.
Tipo recebido: object.
Conteúdo: {"error":"Não foi possível extrair a estrutura de arquivos..."}
```

→ O código **nunca chega** ao loop `for (const f of remoteFiles)`.  
→ O `[DEBUG HTTP]` do `pushProject.js` (para o fetch de push) **nunca é impresso**.

---

## Diagrama da Falha

```
pushProject()
  └─► listFiles()
        ├─► GET /project/{id}  ✅ status 200
        ├─► page.evaluate()
        │     ├─► meta[ol-rootFolder]     ❌ não existe
        │     ├─► window.projectData      ❌ não existe
        │     ├─► regex em <script>       ❌ não encontra
        │     └─► retorna null
        └─► return { error: "..." }       ← OBJETO, não array
  └─► for (const f of remoteFiles)        💥 TypeError: not iterable
```

---

## Conclusão

| Pergunta | Resposta |
|---|---|
| `remoteFiles` vem como `undefined`? | Não — vem como **objeto de erro** `{ error: "..." }` |
| `listFiles` está falhando? | **Sim** — retorna objeto em vez de array |
| `window.projectData` desapareceu? | **Sim** — removido pelo Overleaf |
| `ol-rootFolder` ainda existe? | **Não** — meta tag foi removida pelo Overleaf |
| Socket.IO retorna `folder_id`? | Não testado — o código atual não usa Socket.IO |
| Qual é o primeiro ponto da quebra? | `fileTree = null` dentro de `listFiles()` quando `getMeta('ol-rootFolder')` retorna `null` |

---

## Impacto

O mecanismo passivo de leitura do DOM **não é mais viável** para obter `docIds`.
O Overleaf internalizou toda a árvore de arquivos dentro do bundle React/Redux,
sem expor nenhuma superfície pública (meta tag, variável global, endpoint REST visível).

---

## Próximos Passos (para correção futura)

Duas opções viáveis, em ordem de preferência:

### Opção A — Socket.IO `joinProject` (sem Playwright visual)
Usar `socket.io-client@2` diretamente em Node.js para emitir `joinProject` e
receber o `rootFolder` com `_id`s — mesma abordagem do
[`NiccoloSalvini/overleaf-mcp`](https://github.com/NiccoloSalvini/overleaf-mcp).
Não depende do DOM. Mais robusto. Requer a lib `socket.io-client@2` e os cookies.

### Opção B — Playwright visual (CodeMirror)
Playwright clica no arquivo na árvore esquerda → abre no editor → seleciona todo
o texto (`Ctrl+A`) → digita o novo conteúdo. Não precisa de `docId`.
Mais frágil (quebra se o Overleaf mudar o layout), mas funciona sem Socket.IO.

---

*Diagnóstico encerrado. Causa-raiz confirmada. Sem alterações de lógica neste commit.*
