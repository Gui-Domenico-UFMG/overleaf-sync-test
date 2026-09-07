/**
 * Servidor MCP para Overleaf via Playwright.
 * Compatível com Antigravity (stdio transport).
 *
 * Uso: node src/index.js
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { listProjects } from './tools/listProjects.js';
import { projectInfo } from './tools/projectInfo.js';
import { listFiles } from './tools/listFiles.js';
import { readFile } from './tools/readFile.js';
import { readFileById } from './tools/readFileById.js';
import { writeFile } from './tools/writeFile.js';
import { compile } from './tools/compile.js';
import { pullProject } from './tools/pullProject.js';
import { pushProject } from './tools/pushProject.js';

const TOOLS = [
  {
    name: 'overleaf_list_projects',
    description: 'Lista todos os projetos do Overleaf do usuário autenticado',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'overleaf_project_info',
    description: 'Mostra informações detalhadas de um projeto Overleaf (nome, dono, colaboradores, compilador)',
    inputSchema: {
      type: 'object',
      properties: { projectId: { type: 'string', description: 'ID do projeto Overleaf' } },
      required: ['projectId'],
    },
  },
  {
    name: 'overleaf_list_files',
    description: 'Lista todos os arquivos de um projeto Overleaf',
    inputSchema: {
      type: 'object',
      properties: { projectId: { type: 'string', description: 'ID do projeto Overleaf (da URL: /project/ESTE_ID)' } },
      required: ['projectId'],
    },
  },
  {
    name: 'overleaf_read_file',
    description: 'Lê o conteúdo de um documento LaTeX (.tex, .bib, .cls, etc.) pelo caminho',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'ID do projeto Overleaf' },
        filePath: { type: 'string', description: "Caminho do arquivo (ex: 'main.tex')" },
      },
      required: ['projectId', 'filePath'],
    },
  },
  {
    name: 'overleaf_read_file_by_id',
    description: 'Lê o conteúdo de um documento pelo ID (obtido via overleaf_list_files)',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'ID do projeto Overleaf' },
        docId: { type: 'string', description: 'ID do documento' },
      },
      required: ['projectId', 'docId'],
    },
  },
  {
    name: 'overleaf_write_file',
    description: 'Escreve/atualiza o conteúdo de um documento LaTeX no Overleaf pelo caminho',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'ID do projeto Overleaf' },
        filePath: { type: 'string', description: "Caminho do arquivo (ex: 'main.tex')" },
        content: { type: 'string', description: 'Novo conteúdo do arquivo' },
      },
      required: ['projectId', 'filePath', 'content'],
    },
  },
  {
    name: 'overleaf_compile',
    description: 'Compila (gera PDF) um projeto Overleaf e retorna o status',
    inputSchema: {
      type: 'object',
      properties: { projectId: { type: 'string', description: 'ID do projeto Overleaf' } },
      required: ['projectId'],
    },
  },
  {
    name: 'overleaf_pull_project',
    description: 'Baixa o ZIP completo de um projeto Overleaf e extrai os arquivos em uma pasta local. Rota /download/zip confirmada funcionando.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'ID do projeto Overleaf' },
        outputDir: { type: 'string', description: 'Pasta local de destino. Padrão: ./projects/<projectId>' },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'overleaf_push_project',
    description: 'Envia arquivos locais editados de volta para o Overleaf (versão gratuita). Faz upload arquivo por arquivo via Playwright.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'ID do projeto Overleaf' },
        localDir: { type: 'string', description: 'Pasta local com os arquivos editados. Padrão: ./projects/<projectId>' },
        files: {
          type: 'array',
          description: 'Arquivos específicos para enviar (ex: ["main.tex"]). Se omitido, envia todos.',
          items: { type: 'string' },
        },
      },
      required: ['projectId'],
    },
  },
];

const TOOL_HANDLERS = {
  overleaf_list_projects:  () => listProjects(),
  overleaf_project_info:   (args) => projectInfo(args),
  overleaf_list_files:     (args) => listFiles(args),
  overleaf_read_file:      (args) => readFile(args),
  overleaf_read_file_by_id:(args) => readFileById(args),
  overleaf_write_file:     (args) => writeFile(args),
  overleaf_compile:        (args) => compile(args),
  overleaf_pull_project:   (args) => pullProject(args),
  overleaf_push_project:   (args) => pushProject(args),
};

const server = new Server(
  { name: 'overleaf-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const handler = TOOL_HANDLERS[name];

  if (!handler) {
    return { content: [{ type: 'text', text: `Ferramenta desconhecida: ${name}` }], isError: true };
  }

  try {
    const result = await handler(args || {});
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    return { content: [{ type: 'text', text: `Erro: ${err.message}` }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
