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

const TOOLS = [
  {
    name: 'overleaf_list_projects',
    description: 'Lista todos os projetos do Overleaf do usuário autenticado',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'overleaf_project_info',
    description: 'Mostra informações detalhadas de um projeto Overleaf (nome, dono, colaboradores, compilador)',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'ID do projeto Overleaf' },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'overleaf_list_files',
    description: 'Lista todos os arquivos de um projeto Overleaf',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'ID do projeto Overleaf (da URL: /project/ESTE_ID)' },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'overleaf_read_file',
    description: 'Lê o conteúdo de um documento LaTeX (.tex, .bib, .cls, etc.) pelo caminho do arquivo',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'ID do projeto Overleaf' },
        filePath: { type: 'string', description: "Caminho do arquivo (ex: 'main.tex', 'sections/intro.tex')" },
      },
      required: ['projectId', 'filePath'],
    },
  },
  {
    name: 'overleaf_read_file_by_id',
    description: 'Lê o conteúdo de um documento pelo ID do documento (obtido via overleaf_list_files)',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
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
      $schema: 'http://json-schema.org/draft-07/schema#',
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
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'ID do projeto Overleaf' },
      },
      required: ['projectId'],
    },
  },
];

const TOOL_HANDLERS = {
  overleaf_list_projects: (args) => listProjects(),
  overleaf_project_info: (args) => projectInfo(args),
  overleaf_list_files: (args) => listFiles(args),
  overleaf_read_file: (args) => readFile(args),
  overleaf_read_file_by_id: (args) => readFileById(args),
  overleaf_write_file: (args) => writeFile(args),
  overleaf_compile: (args) => compile(args),
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
    return {
      content: [{ type: 'text', text: `Ferramenta desconhecida: ${name}` }],
      isError: true,
    };
  }

  try {
    const result = await handler(args || {});
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Erro: ${err.message}` }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
