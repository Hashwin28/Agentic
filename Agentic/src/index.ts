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

  // Auto-generate fallback HTML file if missing
  const fallbackPath = path.join(process.cwd(), 'src/widgets/out', 'aegis-kinetic-canvas.html');
  try {
    fs.mkdirSync(path.dirname(fallbackPath), { recursive: true });
    fs.writeFileSync(fallbackPath, `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PROJECT AEGIS // Autonomous Banking SRE Engine</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/recharts@2.12.7/umd/Recharts.min.js"></script>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;800&family=Outfit:wght@400;600;700;900&display=swap" rel="stylesheet">
  <style>body { font-family: 'Outfit', sans-serif; background-color: #070A12; color: #F3F4F6; }</style>
</head>
<body class="min-h-screen p-6 antialiased">
  <div id="root"></div>
  <script type="text/babel">
    const { useState, useEffect } = React;
    const { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, AreaChart, Area, ReferenceLine } = Recharts;
    function AegisDashboard() {
      const [telemetryHistory, setTelemetryHistory] = useState([]);
      const [status, setStatus] = useState('NOMINAL');
      useEffect(() => {
        const interval = setInterval(() => {
          const now = new Date().toLocaleTimeString();
          const qDepth = Math.floor(Math.random() * 25) + 5;
          const tOcc = Math.floor(Math.random() * 30) + 15;
          const residualNorm = status === 'ANOMALY_DETECTED' ? 18.45 : (Math.random() * 3.5 + 0.5);
          setTelemetryHistory(prev => [...prev.slice(-19), { time: now, qDepth, tOcc, residualNorm }]);
        }, 1000);
        return () => clearInterval(interval);
      }, [status]);
      return (
        <div className="max-w-7xl mx-auto space-y-6">
          <header className="flex justify-between items-center bg-slate-900/80 p-5 rounded-2xl border border-slate-800">
            <h1 className="text-xl font-bold text-white">PROJECT AEGIS // Autonomous Core Banking SRE</h1>
            <div className="px-3 py-1.5 rounded-lg text-xs font-bold font-mono border bg-emerald-950/80 border-emerald-500/50 text-emerald-400">● {status}</div>
          </header>
          <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={telemetryHistory}>
                <XAxis dataKey="time" stroke="#475569" />
                <YAxis stroke="#475569" domain={[0, 25]} />
                <ReferenceLine y={15} stroke="#EF4444" strokeDasharray="3 3" />
                <Area type="monotone" dataKey="residualNorm" stroke="#EF4444" fill="rgba(239, 68, 68, 0.2)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }
    ReactDOM.render(<AegisDashboard />, document.getElementById('root'));
  </script>
</body>
</html>`);
    return fallbackPath;
  } catch (e) {
    return null;
  }
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
        // PRODUCTION ROUTING FIX (3): Serve static frontend assets & Next.js JS chunks dynamically
        expressApp.use('/_next', express.static(path.join(process.cwd(), 'src/widgets/out/_next')));
        expressApp.use('/_next', express.static(path.join(process.cwd(), 'widgets/out/_next')));
        expressApp.use('/_next', express.static(path.join(process.cwd(), 'dist/widgets/out/_next')));
        expressApp.use('/_next', express.static(path.join(process.cwd(), 'out/_next')));

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

        // PRODUCTION ROUTING FIX (3): Middleware fallback route serving UI while bypassing internal MCP and API routes
        expressApp.use((req: Request, res: Response, next: NextFunction) => {
          if (req.method !== 'GET') {
            return next();
          }
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
