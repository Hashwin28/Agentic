'use client';

/**
 * Project Aegis — Next.js 14 Single-Page Dashboard (`src/app/page.tsx`)
 * Seamlessly connects the frontend (http://localhost:3001) to the running NitroStack MCP backend (http://localhost:3000/mcp)
 * via Next.js `/api/mcp` proxy rewrites to prevent CORS errors.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { AegisMcpClient, TelemetryData, SwarmEvent } from './lib/mcpClient';

// 1. MCP Transport Integration: Client helper targeting proxied /api/mcp endpoint
const MCP_ENDPOINT_URL = typeof window !== 'undefined' ? '/api/mcp' : 'http://localhost:3000/mcp';

export default function AegisDashboardPage() {
  // Initialize MCP client targeting /api/mcp (proxied by next.config.js to http://localhost:3000/mcp)
  const [mcpClient] = useState(() => new AegisMcpClient(MCP_ENDPOINT_URL, (connected) => setIsConnected(connected)));
  
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [systemStatus, setSystemStatus] = useState<string>('NOMINAL');
  const [swarmLogs, setSwarmLogs] = useState<SwarmEvent[]>([]);
  const [activeAction, setActiveAction] = useState<string | null>(null);

  // Poll Swarm logs from MCP backend
  const pollLogs = useCallback(async () => {
    try {
      const res = await mcpClient.callTool<{ events: SwarmEvent[] }>('get_swarm_log', {});
      if (res && res.events) {
        setSwarmLogs(res.events);
      }
    } catch (_) {}
  }, [mcpClient]);

  useEffect(() => {
    const timer = setInterval(pollLogs, 1500);
    return () => clearInterval(timer);
  }, [pollLogs]);

  // 3. Dashboard Tool Actions: Trigger live tool calls to NitroStack MCP backend
  const handleTriggerAction = async (toolName: string, label: string) => {
    setActiveAction(toolName);
    try {
      // Execute JSON-RPC 2.0 tool call (e.g. simulate_salary_day_storm)
      await mcpClient.callTool(toolName, {});
      setSwarmLogs(prev => [
        {
          time: new Date().toISOString(),
          source: 'FRONTEND',
          type: 'info',
          message: `[MCP-CLIENT] Executed tool call '${toolName}' (${label}) -> http://localhost:3000/mcp`
        },
        ...prev
      ]);
    } catch (err: any) {
      alert(`Action '${label}' failed: ${err.message}`);
    } finally {
      setTimeout(() => setActiveAction(null), 1000);
    }
  };

  return (
    <main className="min-h-screen bg-[#070A12] text-slate-100 p-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex justify-between items-center bg-slate-900/80 p-5 rounded-2xl border border-slate-800 backdrop-blur-lg">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              PROJECT AEGIS <span className="text-xs font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800">// Autonomous Banking SRE</span>
            </h1>
            <p className="text-xs text-slate-400 font-mono mt-0.5">Frontend (3001) → MCP Backend Proxy (/api/mcp → 3000)</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-xs font-mono">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-ping' : 'bg-red-400'}`}></span>
              <span className={isConnected ? 'text-emerald-400' : 'text-red-400'}>{isConnected ? 'MCP Proxy Connected' : 'Disconnected'}</span>
            </div>
          </div>
        </header>

        {/* Stress Test Trigger Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => handleTriggerAction('simulate_salary_day_storm', 'Salary Day Thundering Herd')}
            disabled={activeAction === 'simulate_salary_day_storm'}
            className="bg-slate-900/80 hover:bg-slate-800 p-5 rounded-xl border border-slate-800 text-left transition group"
          >
            <div className="text-xs text-cyan-400 font-mono mb-1">STRESS TOOL #1</div>
            <div className="font-bold text-sm text-white group-hover:text-cyan-300">Salary Day Thundering Herd ⚡</div>
            <div className="text-xs text-slate-400 mt-1">Dispatches simulate_salary_day_storm tool call to localhost:3000</div>
          </button>

          <button
            onClick={() => handleTriggerAction('simulate_p2p_transfer_surge', 'P2P Transfer Surge')}
            disabled={activeAction === 'simulate_p2p_transfer_surge'}
            className="bg-slate-900/80 hover:bg-slate-800 p-5 rounded-xl border border-slate-800 text-left transition group"
          >
            <div className="text-xs text-purple-400 font-mono mb-1">STRESS TOOL #2</div>
            <div className="font-bold text-sm text-white group-hover:text-purple-300">P2P Transfer Surge 💸</div>
            <div className="text-xs text-slate-400 mt-1">Dispatches simulate_p2p_transfer_surge tool call to localhost:3000</div>
          </button>

          <button
            onClick={() => handleTriggerAction('simulate_eod_batch_collision', 'EOD Batch Collision')}
            disabled={activeAction === 'simulate_eod_batch_collision'}
            className="bg-slate-900/80 hover:bg-slate-800 p-5 rounded-xl border border-slate-800 text-left transition group"
          >
            <div className="text-xs text-amber-400 font-mono mb-1">STRESS TOOL #3</div>
            <div className="font-bold text-sm text-white group-hover:text-amber-300">EOD Batch Collision 📦</div>
            <div className="text-xs text-slate-400 mt-1">Dispatches simulate_eod_batch_collision tool call to localhost:3000</div>
          </button>
        </div>

        {/* Agentic Swarm Log Console */}
        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 font-mono">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
              <span>AGENTIC SWARM LOG TERMINAL (STREAMING LIVE FROM localhost:3000)</span>
            </div>
          </div>
          <div className="h-48 overflow-y-auto space-y-1.5 text-xs text-slate-300 pr-2">
            {swarmLogs.length === 0 && <div className="text-slate-500">[SYSTEM] Listening for live MCP events from backend...</div>}
            {swarmLogs.map((ev, i) => (
              <div key={i} className={ev.type === 'error' ? 'text-red-400' : ev.type === 'warn' ? 'text-amber-300' : 'text-emerald-400'}>
                [{ev.source || 'SWARM'}] {ev.message}
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
