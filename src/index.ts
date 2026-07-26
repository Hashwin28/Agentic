import 'reflect-metadata';
import { McpApplicationFactory } from '@nitrostack/core';
import { AegisApplication } from './app.module.js';
import * as path from 'path';
import * as fs from 'fs';
import type { Request, Response } from 'express';

function findWidgetHtmlFile(widgetName: string): string | null {
  const cleanName = widgetName.replace(/\.html$/, '');
  const candidatePaths = [
    path.join(process.cwd(), 'src/widgets/out', `${cleanName}.html`),
    path.join(process.cwd(), 'widgets/out', `${cleanName}.html`),
    path.join(process.cwd(), 'dist/widgets/out', `${cleanName}.html`),
    path.join(process.cwd(), 'out', `${cleanName}.html`),
    path.join(process.cwd(), 'src/widgets/out', 'aegis-kinetic-canvas.html'),
    path.join(process.cwd(), 'widgets/out', 'aegis-kinetic-canvas.html'),
  ];
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

async function bootstrap() {
  // Initialize the MCP server with the NitroStack factory
  const server = await McpApplicationFactory.create(AegisApplication);
  
  // Start the server (dual/http mode in production)
  await server.start();

  // Attach static web UI routes directly to NitroStack's primary HTTP server (Port 3000 / NitroCloud ingress)
  const httpTransport = server.getHttpTransport();
  if (httpTransport && typeof httpTransport.getApp === 'function') {
    const expressApp = httpTransport.getApp();
    if (expressApp) {
      const handleWidgetRequest = (req: Request, res: Response) => {
        const rawParam = req.params.widgetName || 'aegis-kinetic-canvas';
        const name = Array.isArray(rawParam) ? rawParam[0] : rawParam;
        const file = findWidgetHtmlFile(name);
        if (file) {
          return res.sendFile(file);
        }
        const fallbackFile = findWidgetHtmlFile('aegis-kinetic-canvas');
        if (fallbackFile) {
          return res.sendFile(fallbackFile);
        }
        return res.status(404).send('Bank SRE Control Panel widget build not found');
      };

      expressApp.get('/aegis-kinetic-canvas', handleWidgetRequest);
      expressApp.get('/sre-control-panel', handleWidgetRequest);
      expressApp.get('/aegis-resilience-widget', handleWidgetRequest);
      expressApp.get('/widgets/:widgetName', handleWidgetRequest);
    }
  }

  console.error('Project Aegis MAS MCP Server running on stdio/http');
}

bootstrap().catch((err) => {
  console.error('Fatal error during bootstrap:', err);
  process.exit(1);
});
