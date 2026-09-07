# Overleaf Firefox Cookie MCP (Work in Progress)

Este repositório documenta a construção de um servidor MCP (Model Context Protocol) para integração com o Overleaf. 

## 1. O Trabalho Realizado Até Aqui
- O ambiente do servidor MCP foi configurado.
- Os schemas (estruturas) das ferramentas de interação com o Overleaf foram mapeados (ex: `overleaf_list_projects`, arquivos de leitura e escrita).
- A primeira tentativa de conexão utilizava as rotas internas da API do Overleaf.
- Arquivos base e testes iniciais (como o `main.tex`) já foram criados e configurados no repositório.

## 2. Onde o Desenvolvimento Parou
O projeto foi interrompido (bloqueado) porque os testes retornaram erros **404 (Página não encontrada)**. Descobriu-se que o Overleaf alterou ou removeu os endpoints internos de sua API na versão web. Como o Overleaf não possui uma API REST pública oficial, o modelo antigo de requisição simplesmente parou de funcionar.

A conclusão técnica deste ponto foi: a melhor alternativa para contornar essa restrição de autenticação/acesso será extrair e utilizar os cookies da sessão ativa do navegador Firefox.

## 3. O Que Ainda Precisa Ser Feito (Próximos Passos)
Para dar sequência a este projeto, a próxima IA (ou desenvolvedor) deverá realizar as seguintes tarefas:
1. **Extração de Cookies:** Criar um script/módulo que leia programaticamente os cookies de sessão do Overleaf salvos no perfil local do Mozilla Firefox.
2. **Injeção de Sessão:** Atualizar o cliente HTTP do servidor MCP para injetar esses cookies do Firefox em todas as requisições enviadas ao Overleaf.
3. **Mapeamento de Rotas:** Inspecionar a rede (via browser) e descobrir quais são as novas rotas/endpoints que o Overleaf usa internamente hoje para acessar projetos e compilar arquivos.
4. **Atualizar Ferramentas:** Refatorar as chamadas das ferramentas do MCP (`list_projects`, `read_file`, etc.) para usarem as novas rotas descobertas com a sessão do Firefox.

---
*Nota para a próxima IA: Todo o código e arquivos gerados até este ponto foram mantidos. Utilize o contexto acima para continuar o desenvolvimento focado na integração via cookies do Firefox.*


## 4. Atualização Importante sobre Erros 404 (Análise)
Ao testar a extração de cookies do Firefox, verificamos que os cookies funcionam e evitam o redirecionamento de login. No entanto, o Overleaf **removeu completamente os endpoints REST /api/project e /api/project/:id**. 

Além disso, o HTML inicial carregado em /project/:id não contém mais a árvore de arquivos (ileTree ou ootFolder) em tags <script>. O Overleaf agora carrega a estrutura do projeto e os documentos exclusivamente via **Socket.io (ShareJS)** após o carregamento da página.

**Conclusão para a próxima IA:**
A abordagem via fetch() (cliente HTTP simples) não é mais viável sem implementar um cliente complexo de WebSockets/Socket.io. A melhor alternativa é **retomar o uso do Playwright** (como planejado inicialmente neste repositório) para: 
1. Injetar os cookies do Firefox extraídos;
2. Abrir a página do projeto;
3. Extrair os dados da árvore de arquivos inspecionando o DOM do editor (ex: .file-tree) ou executando scripts page.evaluate() no contexto da página para ler o estado do frontend.
