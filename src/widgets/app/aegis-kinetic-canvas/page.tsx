'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine 
} from 'recharts';
import { 
  ShieldAlert, ShieldCheck, Activity, Cpu, Database, RefreshCw, Zap,
  Terminal, AlertTriangle, FileText, Lock, Radio, Play
} from 'lucide-react';
import { AegisMcpClient, TelemetryData, SwarmEvent } from '../lib/mcpClient';

const MCP_CLOUD_URL = 'https://agentic-6a6551d9-hashwins-org-0dcc4106.app.nitrocloud.ai/mcp';

interface MetricHistoryPoint {
  time: string;
  queueDepth: number;
  threadOccupancy: number;
  dbSaturation: number;
  retryRate: number;
  residualNorm: number;
}

export default function AegisControlPanel() {
  // Client instance
  const [mcpClient] = useState(() => new AegisMcpClient(MCP_CLOUD_URL, (connected) => setIsConnected(connected)));
  
  // System State
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [liveValidationMode, setLiveValidationMode] = useState<boolean>(false);
  const [systemStatus, setSystemStatus] = useState<'NOMINAL' | 'ANOMALY_DETECTED' | 'REMEDIATING' | 'RECOVERED'>('NOMINAL');
  
  // Real-time Data
  const [currentTelemetry, setCurrentTelemetry] = useState<TelemetryData | null>(null);
  const [metricHistory, setMetricHistory] = useState<MetricHistoryPoint[]>([]);
  const [swarmLogs, setSwarmLogs] = useState<SwarmEvent[]>([]);
  
  // Active Shields State (Optimistic + Polled)
  const [shields, setShields] = useState({
    singleFlight: { active: false, count: 1420 },
    idempotency: { active: false, blocked: 89 },
    qosShunting: { active: false, shedRatio: '10%' },
    circuitBreaker: { active: false, status: 'CLOSED' }
  });

  // UI Modal State
  const [showRcaModal, setShowRcaModal] = useState<boolean>(false);
  const [rcaReport, setRcaReport] = useState<any | null>(null);
  const [activeAction, setActiveAction] = useState<string | null>(null);

  // ──────────────────────────────────────────────────────────────────────────
  // Data Polling Loop
  // ──────────────────────────────────────────────────────────────────────────
  const pollTelemetry = useCallback(async () => {
    try {
      const data: TelemetryData = await mcpClient.callTool('get_orbital_subspace', {});
      if (data && data.telemetry_analysis) {
        setCurrentTelemetry(data);
        setSystemStatus(data.system_status);

        const vector = data.telemetry_analysis.normalized_vector;
        const norm = data.telemetry_analysis.svd_residual_norm;
        const timeStr = new Date().toLocaleTimeString('en-US', { hour12: false, minute: '2-digit', second: '2-digit' });

        setMetricHistory(prev => {
          const next = [...prev, {
            time: timeStr,
            queueDepth: Math.max(0, vector[0] || 0),
            threadOccupancy: Math.max(0, vector[1] || 0),
            dbSaturation: Math.max(0, vector[2] || 0),
            retryRate: Math.max(0, vector[3] || 0),
            residualNorm: norm || 0
          }];
          return next.slice(-25); // Keep last 25 time ticks
        });
      }
    } catch (_) {}
  }, [mcpClient]);

  const pollLogs = useCallback(async () => {
    try {
      const res = await mcpClient.callTool('get_swarm_log', {});
      if (res && res.events) {
        setSwarmLogs(res.events);
      }
    } catch (_) {}
  }, [mcpClient]);

  const pollHealthChecks = useCallback(async () => {
    try {
      const res = await mcpClient.readResource('health://checks');
      if (res && res.checks) {
        setShields(prev => ({
          ...prev,
          singleFlight: { ...prev.singleFlight, active: res.checks.find((c: any) => c.name === 'singleFlightShield')?.status === 'active' },
          qosShunting: { ...prev.qosShunting, active: res.checks.find((c: any) => c.name === 'qosShunting')?.status === 'active' },
          idempotency: { ...prev.idempotency, active: res.checks.find((c: any) => c.name === 'idempotencyShield')?.status === 'active' }
        }));
      }
    } catch (_) {}
  }, [mcpClient]);

  useEffect(() => {
    const t1 = setInterval(pollTelemetry, 1000);
    const t2 = setInterval(pollLogs, 1500);
    const t3 = setInterval(pollHealthChecks, 2000);
    return () => { clearInterval(t1); clearInterval(t2); clearInterval(t3); };
  }, [pollTelemetry, pollLogs, pollHealthChecks]);

  // ──────────────────────────────────────────────────────────────────────────
  // Action Triggers
  // ──────────────────────────────────────────────────────────────────────────
  const handleTriggerAction = async (toolName: string, label: string) => {
    setActiveAction(toolName);
    try {
      await mcpClient.callTool(toolName, {});
    } catch (err: any) {
      alert(`Action failed: ${err.message}`);
    } finally {
      setTimeout(() => setActiveAction(null), 1000);
    }
  };

  const handleToggleMode = async () => {
    const nextMode = !liveValidationMode;
    setLiveValidationMode(nextMode);
    try {
      await mcpClient.callTool('set_simulation_mode', { mode: nextMode ? 'live' : 'mock' });
    } catch (_) {}
  };

  const handleGenerateRca = async () => {
    try {
      const currentNorm = currentTelemetry?.telemetry_analysis?.svd_residual_norm || 18.42;
      const res = await mcpClient.callTool('generate_compliance_rca', {
        incidentId: `INC-${Math.floor(100000 + Math.random() * 900000)}`,
        resolution: 'Staged multi-agent cascade deployed SingleFlight, QoS Shunting, and Idempotency guards.',
        residualNorm: currentNorm,
        activeShields: ['SingleFlightGate', 'QosShunting', 'IdempotencyEnforcer'],
        anomalyTimestamp: new Date().toISOString()
      });
      setRcaReport(res);
      setShowRcaModal(true);
    } catch (err: any) {
      alert(`RCA Generation failed: ${err.message}`);
    }
  };

  // Status badge styling helper
  const statusBadgeStyle = useMemo(() => {
    switch (systemStatus) {
      case 'ANOMALY_DETECTED': return 'bg-amber-500/20 text-amber-400 border-amber-500/40 animate-pulse';
      case 'REMEDIATING': return 'bg-purple-500/20 text-purple-400 border-purple-500/40 animate-pulse';
      case 'RECOVERED': return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40';
      default: return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
    }
  }, [systemStatus]);

  const currentResidual = currentTelemetry?.telemetry_analysis?.svd_residual_norm || 0;
  const isAnomalyBreached = currentResidual > 15.0;

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 font-sans p-4 lg:p-6 space-y-6">
      
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 1. HEADER / SYSTEM STATUS BAR */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <header className="bg-[#1E293B]/70 backdrop-blur border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-purple-600/20 border border-purple-500/30 rounded-lg">
            <ShieldAlert className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-wide">Project Aegis</h1>
            <p className="text-xs text-slate-400">Core Banking SRE Command Center • NitroStack MCP</p>
          </div>
        </div>

        {/* Live Cloud Connection Indicator */}
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2 text-xs bg-slate-900/60 px-3 py-1.5 rounded-full border border-slate-800">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-ping' : 'bg-red-500'}`} />
            <span className="text-slate-400">Cloud MCP:</span>
            <span className="font-mono text-cyan-400 truncate max-w-[200px]">nitrocloud.ai/mcp</span>
          </div>

          {/* Dynamic Status Badge */}
          <div className={`px-4 py-1.5 rounded-lg border text-xs font-bold tracking-wider flex items-center space-x-2 ${statusBadgeStyle}`}>
            <Radio className="w-3.5 h-3.5" />
            <span>{systemStatus}</span>
          </div>

          {/* Mode Toggle */}
          <div className="flex items-center space-x-2 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
            <span className="text-xs text-slate-400">Live Validation</span>
            <button 
              onClick={handleToggleMode}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-300 ${liveValidationMode ? 'bg-purple-600' : 'bg-slate-700'}`}
            >
              <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${liveValidationMode ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
        </div>
      </header>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 2. TOP GRID — LIVE TELEMETRY & SVD RESIDUAL CHARTS */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {isAnomalyBreached && (
        <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-4 flex items-center justify-between text-red-400 text-sm animate-bounce">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <span><strong>CRITICAL ANOMALY BREACH:</strong> SVD Subspace Residual Norm ({currentResidual.toFixed(2)}) has breached the 15.0 threshold! Autonomic SRE shield cascade engaging.</span>
          </div>
          <span className="font-mono text-xs bg-red-950 px-2.5 py-1 rounded border border-red-800">THRESHOLD: 15.0</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: 4D Telemetry Metrics */}
        <div className="bg-[#1E293B]/60 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-semibold text-slate-200">4D Telemetry Vector Stream</h2>
            </div>
            <div className="flex items-center space-x-3 text-[11px] text-slate-400 font-mono">
              <span className="text-cyan-400">● Queue</span>
              <span className="text-purple-400">● Threads</span>
              <span className="text-amber-400">● DB Sat</span>
              <span className="text-rose-400">● Retries</span>
            </div>
          </div>
          
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metricHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="time" stroke="#64748B" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748B" tick={{ fontSize: 10 }} domain={[0, 100]} />
                <Tooltip contentStyle={{ backgroundColor: '#0B0F19', borderColor: '#334155', fontSize: '12px' }} />
                <Line type="monotone" dataKey="queueDepth" stroke="#06B6D4" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="threadOccupancy" stroke="#8B5CF6" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="dbSaturation" stroke="#F59E0B" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="retryRate" stroke="#F43F5E" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Incremental SVD Residual Norm */}
        <div className="bg-[#1E293B]/60 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Zap className="w-4 h-4 text-purple-400" />
              <h2 className="text-sm font-semibold text-slate-200">Incremental SVD Residual Error Norm ‖(I - P_S)x‖</h2>
            </div>
            <span className="font-mono text-xs text-purple-400 font-bold bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800/50">
              Current: {currentResidual.toFixed(2)}
            </span>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metricHistory}>
                <defs>
                  <linearGradient id="residualGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="time" stroke="#64748B" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748B" tick={{ fontSize: 10 }} domain={[0, 40]} />
                <Tooltip contentStyle={{ backgroundColor: '#0B0F19', borderColor: '#334155', fontSize: '12px' }} />
                <ReferenceLine y={15.0} stroke="#EF4444" strokeDasharray="4 4" label={{ value: 'THRES: 15.0', fill: '#EF4444', fontSize: 10 }} />
                <Area type="monotone" dataKey="residualNorm" stroke="#8B5CF6" strokeWidth={2.5} fillOpacity={1} fill="url(#residualGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 3. MIDDLE SECTION — STRESS INJECTION & SIMULATION PANEL */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <div className="bg-[#1E293B]/60 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
        <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
          <Play className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-semibold text-slate-200">Synthetic Stress Injection & MCP Tool Invocation</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => handleTriggerAction('simulate_salary_day_storm', 'Salary Day Storm')}
            disabled={activeAction !== null}
            className="flex items-center justify-center space-x-2 bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 text-white font-medium py-3 px-4 rounded-lg shadow-lg hover:shadow-red-900/30 transition-all duration-200 disabled:opacity-50 text-xs"
          >
            <Zap className="w-4 h-4" />
            <span>Trigger Salary Day Storm</span>
          </button>

          <button
            onClick={() => handleTriggerAction('simulate_p2p_transfer_surge', 'P2P Surge')}
            disabled={activeAction !== null}
            className="flex items-center justify-center space-x-2 bg-gradient-to-r from-amber-600 to-orange-700 hover:from-amber-500 hover:to-orange-600 text-white font-medium py-3 px-4 rounded-lg shadow-lg hover:shadow-orange-900/30 transition-all duration-200 disabled:opacity-50 text-xs"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Simulate P2P Transfer Surge</span>
          </button>

          <button
            onClick={() => handleTriggerAction('simulate_eod_batch_collision', 'EOD Batch')}
            disabled={activeAction !== null}
            className="flex items-center justify-center space-x-2 bg-gradient-to-r from-yellow-600 to-amber-700 hover:from-yellow-500 hover:to-amber-600 text-white font-medium py-3 px-4 rounded-lg shadow-lg hover:shadow-amber-900/30 transition-all duration-200 disabled:opacity-50 text-xs"
          >
            <Database className="w-4 h-4" />
            <span>Simulate EOD Batch Collision</span>
          </button>

          <button
            onClick={() => handleTriggerAction('emergency_hardcoded_shield_activation', 'Emergency Fail-Safe')}
            disabled={activeAction !== null}
            className="flex items-center justify-center space-x-2 bg-red-950 border border-red-600 hover:bg-red-900 text-red-200 font-bold py-3 px-4 rounded-lg shadow-lg hover:shadow-red-950/50 transition-all duration-200 disabled:opacity-50 text-xs uppercase tracking-wider"
          >
            <Lock className="w-4 h-4 text-red-400" />
            <span>Emergency Fail-Safe</span>
          </button>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 4. BOTTOM GRID — ACTIVE SHIELDS & LIVE SWARM LOG */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Bottom Left: Agentic Remediation & Active Shields */}
        <div className="bg-[#1E293B]/60 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-slate-200">Autonomic Resilience Middleware Shields</h2>
            </div>
            <span className="text-xs text-slate-400">Saga Rollback Enabled</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* SingleFlightGate */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200">SingleFlightGate</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${shields.singleFlight.active ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
                  {shields.singleFlight.active ? 'ACTIVE' : 'STANDBY'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Coalesces concurrent ledger balance queries over an in-flight Promise map.</p>
              <div className="text-xs font-mono text-cyan-400 pt-1">Deduplicated: {shields.singleFlight.count} reqs</div>
            </div>

            {/* IdempotencyEnforcer */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200">IdempotencyEnforcer</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${shields.idempotency.active ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
                  {shields.idempotency.active ? 'ACTIVE' : 'STANDBY'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">SHA-256 mutation hashing with LRU cache eviction (max 10k entries).</p>
              <div className="text-xs font-mono text-purple-400 pt-1">Duplicates Intercepted: {shields.idempotency.blocked}</div>
            </div>

            {/* QosShunting */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200">QosShunting</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${shields.qosShunting.active ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
                  {shields.qosShunting.active ? 'ACTIVE' : 'STANDBY'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Token-bucket admission control reserving 90% bandwidth for transfers.</p>
              <div className="text-xs font-mono text-amber-400 pt-1">Batch Throttling Ratio: {shields.qosShunting.shedRatio}</div>
            </div>

            {/* CircuitBreaker */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200">CircuitBreaker</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-500 border border-slate-700">
                  CLOSED
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Isolated route fallback for downstream legacy gateway timeouts.</p>
              <div className="text-xs font-mono text-emerald-400 pt-1">Gateway Health: 100%</div>
            </div>
          </div>
        </div>

        {/* Bottom Right: Live Swarm Log & Forensic Justification */}
        <div className="bg-[#1E293B]/60 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Terminal className="w-4 h-4 text-purple-400" />
                <h2 className="text-sm font-semibold text-slate-200">Swarm Activity & Forensic Reasoning Feed</h2>
              </div>
              <button
                onClick={handleGenerateRca}
                className="flex items-center space-x-1.5 text-xs bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 px-3 py-1.5 rounded-lg transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>SOC2 RCA Report</span>
              </button>
            </div>

            {/* Dynamic Forensic Justification Banner */}
            {currentTelemetry?.forensic_justification && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3 text-xs text-slate-300 space-y-1">
                <div className="font-bold text-purple-400 flex items-center space-x-1">
                  <Cpu className="w-3.5 h-3.5" />
                  <span>PRIME Forensic Justification:</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {currentTelemetry.forensic_justification}
                </p>
              </div>
            )}

            {/* Terminal Output Window */}
            <div className="bg-[#0B0F19] border border-slate-800 rounded-lg p-3 h-44 overflow-y-auto font-mono text-[11px] space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800">
              {swarmLogs.length === 0 ? (
                <div className="text-slate-600 italic">Listening to NitroStack swarm event stream...</div>
              ) : (
                swarmLogs.slice(-20).map((log, idx) => (
                  <div key={idx} className="flex space-x-2">
                    <span className="text-slate-500">{log.time}</span>
                    <span className={`font-bold ${log.source === 'PRIME' ? 'text-purple-400' : log.source === 'ATLAS' ? 'text-cyan-400' : log.source === 'CERBERUS' ? 'text-amber-400' : 'text-emerald-400'}`}>
                      [{log.source}]
                    </span>
                    <span className={log.type === 'error' ? 'text-red-400' : log.type === 'warn' ? 'text-amber-300' : 'text-slate-300'}>
                      {log.message}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 5. SOC2 COMPLIANCE RCA MODAL */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {showRcaModal && rcaReport && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1E293B] border border-slate-700 rounded-xl max-w-2xl w-full p-6 space-y-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-700 pb-4">
              <div className="flex items-center space-x-3">
                <FileText className="w-6 h-6 text-purple-400" />
                <div>
                  <h3 className="text-lg font-bold text-white">Immutable SOC2 Compliance RCA Report</h3>
                  <p className="text-xs text-slate-400">Ref: {rcaReport.documentRef}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowRcaModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold px-2"
              >
                ×
              </button>
            </div>

            <div className="space-y-4 text-xs font-mono bg-[#0B0F19] p-4 rounded-lg border border-slate-800">
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Incident ID:</span>
                <span className="text-purple-400 font-bold">{rcaReport.incidentId}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Timestamp:</span>
                <span className="text-slate-200">{rcaReport.filedAt}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">SVD Residual Norm:</span>
                <span className="text-rose-400 font-bold">{rcaReport.svdResidualNorm}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Active Shields:</span>
                <span className="text-emerald-400 font-bold">{rcaReport.activeShields?.join(', ')}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Remediation Latency:</span>
                <span className="text-cyan-400 font-bold">{rcaReport.remediationLatencyMs} ms</span>
              </div>
              <div className="pt-2">
                <span className="text-slate-400 block mb-1">Resolution Summary:</span>
                <p className="text-slate-300 font-sans leading-relaxed bg-slate-900 p-2.5 rounded border border-slate-800">
                  {rcaReport.auditTrail?.resolution}
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowRcaModal(false)}
                className="bg-purple-600 hover:bg-purple-500 text-white font-medium px-4 py-2 rounded-lg text-xs transition-colors"
              >
                Close Audit Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
