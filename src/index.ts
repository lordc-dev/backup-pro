#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readFile } from './utils/fs.js';
import { BackupResource } from './types/index.js';
import { BackupStore } from './utils/store.js';
import { config, SERVER_VERSION } from './utils/config.js';
import { backupNotFoundError } from './utils/validate.js';
import { allTools } from './tools/index.js';
import { log } from './utils/logger.js';
import { backupRateLimiter } from './utils/concurrency.js';

export class BackupServer {
  private server: McpServer;
  private backups!: BackupStore;

  constructor() {
    this.server = new McpServer(
      { name: "backup-server", version: SERVER_VERSION },
      { capabilities: { resources: {}, tools: {}, prompts: {} } }
    );
  }

  async init(): Promise<void> {
    this.backups = await BackupStore.create();
    this.setupHandlers();
    this.backups.startAutoSave(config.autoSaveIntervalMs);

    const gracefulShutdown = async () => {
      this.backups.stopAutoSave();
      await this.backups.save();
      await this.server.close();
      process.exit(0);
    };
    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);
  }

  private setupHandlers(): void {
    this.setupToolHandlers();
    this.setupResourceHandlers();
    this.setupPromptsHandler();
  }

  private setupToolHandlers(): void {
    this.server.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: allTools.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    }));

    this.server.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const tool = allTools.find(t => t.name === name);

      if (!tool) {
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }

      try {
        await backupRateLimiter.acquire();
        const result = await tool.handler(args, this.backups);
        if (tool.persistAfter) {
          await this.backups.save();
        }
        return { content: [{ type: "text" as const, text: result.text }] };
      } catch (error) {
        if (error instanceof McpError) throw error;
        throw new McpError(ErrorCode.InternalError, `Error: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  }

  private setupResourceHandlers(): void {
    this.server.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      const resources: BackupResource[] = [];
      for (const [id, info] of this.backups.entries()) {
        const tags = info.metadata.tags.length > 0 ? ` [${info.metadata.tags.join(', ')}]` : '';
        resources.push({
          uri: `backup://${id}`,
          name: `Backup of ${info.metadata.originalPath}${tags}`,
          description: `${info.metadata.description} - ${new Date(info.metadata.timestamp).toLocaleString()}`,
          mimeType: "text/plain",
        });
      }

      if (config.allowedRoots.length > 0) {
        resources.push({
          uri: "backup://config/allowed-roots",
          name: "Allowed backup roots",
          description: `Directories where backup/restore operations are permitted: ${config.allowedRoots.join(', ')}`,
          mimeType: "text/plain",
        });
      }

      resources.push({
        uri: "backup://config/health",
        name: "Server health",
        description: "Backup server health status, uptime, and statistics",
        mimeType: "application/json",
      });

      return { resources };
    });

    this.server.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      
      if (uri === "backup://config/health") {
        const stats = {
          status: this.backups.loadError ? 'degraded' : 'healthy',
          version: SERVER_VERSION,
          backupCount: this.backups.size,
          backupDir: config.backupDir,
          allowedRoots: config.allowedRoots.length > 0 ? config.allowedRoots : ['(all paths)'],
          logLevel: config.logLevel,
          ...(this.backups.loadError ? { loadError: this.backups.loadError } : {}),
        };
        return { contents: [{ uri, mimeType: "application/json", text: JSON.stringify(stats, null, 2) }] };
      }

      if (uri === "backup://config/allowed-roots") {
        const roots = config.allowedRoots.length > 0 
          ? config.allowedRoots.join('\n')
          : '(all paths allowed)';
        return { contents: [{ uri, mimeType: "text/plain", text: `Allowed backup roots:\n${roots}` }] };
      }

      if (!uri.startsWith("backup://")) {
        throw new McpError(ErrorCode.InvalidParams, `Invalid URI: ${uri}`);
      }
      const backupId = uri.substring("backup://".length);
      const backupInfo = this.backups.get(backupId);
      if (!backupInfo) throw backupNotFoundError(backupId);

      try {
        const content = (await readFile(backupInfo.backupPath)).toString('utf-8');
        return { contents: [{ uri, mimeType: "text/plain", text: content }] };
      } catch (error) {
        throw new McpError(ErrorCode.InternalError, `Error reading backup: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  }

  private setupPromptsHandler(): void {
    this.server.server.setRequestHandler(ListPromptsRequestSchema, async () => ({ prompts: [] }));
  }

  getAllTools() { return allTools; }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    log.info('backup-server', `MCP Backup Server v${SERVER_VERSION} running`);
  }
}

const server = new BackupServer();
server.init().then(() => server.run()).catch(err => {
  log.error('backup-server', 'Fatal error starting server', { error: String(err) });
  process.exit(1);
});