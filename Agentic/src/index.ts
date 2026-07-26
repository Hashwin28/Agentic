import 'reflect-metadata';
import { McpApplicationFactory } from '@nitrostack/core';
import { AegisApplication } from './app.module.js';
import * as path from 'path';
import * as fs from 'fs';
import type { Request, Response, NextFunction } from 'express';
import express from 'express';

// PRODUCTION ROUTING FIX (1 & 2): Dynamic Environment Port Binding & 0.0.0.0 Host Binding
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

process.env.HOST = process.env.HOST || HOST;
process.env.PORT = String(PORT);

/** Helper to resolve static widget HTML files across diverse environment CWD layouts. */
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
  try {
    // Initialize the MCP server with the NitroStack factory
    const server = await McpApplicationFactory.create(AegisApplication);
    
    // Start the server (dual/http mode in production)
    await server.start();

    // Attach static web UI routes directly to NitroStack's primary HTTP server for NitroCloud container ingress
    const httpTransport = server.getHttpTransport();
    if (httpTransport && typeof httpTransport.getApp === 'function') {
      const expressApp = httpTransport.getApp();
      if (expressApp) {
        // PRODUCTION ROUTING FIX (3): Serve static frontend assets dynamically from build/public directories
        expressApp.use(express.static(path.join(process.cwd(), 'src/widgets/out')));
        expressApp.use(express.static(path.join(process.cwd(), 'widgets/out')));
        expressApp.use(express.static(path.join(process.cwd(), 'dist/widgets/out')));
        expressApp.use(express.static(path.join(process.cwd(), 'out')));

        const handleWidgetRequest = (req: Request, res: Response) => {
          const rawParam = req.params.widgetName || 'aegis-kinetic-canvas';
          const name = Array.isArray(rawParam) ? rawParam[0] : rawParam;
          const file = findWidgetHtmlFile(name) || findWidgetHtmlFile('aegis-kinetic-canvas');
          if (file) {
            return res.sendFile(file);
          }
          return res.status(404).send('Bank SRE Control Panel widget build not found');
        };

        // Explicit static UI endpoints
        expressApp.get('/aegis-kinetic-canvas', handleWidgetRequest);
        expressApp.get('/sre-control-panel', handleWidgetRequest);
        expressApp.get('/aegis-resilience-widget', handleWidgetRequest);
        expressApp.get('/widgets/:widgetName', handleWidgetRequest);

        // PRODUCTION ROUTING FIX (3): Wildcard fallback route serving UI while bypassing internal MCP and API routes
        expressApp.get('*', (req: Request, res: Response, next: NextFunction) => {
          if (
            req.path.startsWith('/mcp') ||
            req.path.startsWith('/sse') ||
            req.path.startsWith('/api') ||
            req.path.startsWith('/health')
          ) {
            return next();
          }
          const widgetName = req.path.substring(1) || 'aegis-kinetic-canvas';
          const file = findWidgetHtmlFile(widgetName) || findWidgetHtmlFile('aegis-kinetic-canvas');
          if (file) {
            return res.sendFile(file);
          }
          return next();
        });
      }
    }

    // PRODUCTION ROUTING FIX (4): Clean Error Boundary & Startup Host Logging
    console.log(`Project Aegis MAS MCP Server listening on http://${HOST}:${PORT}`);
  } catch (err: any) {
    console.error(`[AEGIS] Bootstrap initialization error: ${err.message}`);
    process.exit(1);
  }
}

bootstrap().catch((err) => {
  console.error('Fatal error during bootstrap:', err);
  process.exit(1);
});
