'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine 
} from 'recharts';
import { 
  Shield, ShieldAlert, ShieldCheck, Activity, Cpu, Database, RefreshCw, Zap,
  Terminal, AlertTriangle, FileText, Lock, Radio, Play, TrendingUp, Layers,
  Bell, Settings, Moon, Sun, GitMerge, Sliders, Power, CheckCircle2, AlertOctagon
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
  const [systemStatus, setSystemStatus] = useState<'NOMINAL' | 'ANOMALY_DETECTED' | 'AUTONOMOUS_REMEDIATION' | 'SYSTEM_RECOVERED'>('NOMINAL');
  const [alertCount, setAlertCount] = useState<number>(0);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  
  // Real-time Data
  const [currentTelemetry, setCurrentTelemetry] = useState<TelemetryData | null>(null);
  const [metricHistory, setMetricHistory] = useState<MetricHistoryPoint[]>([]);
  const [swarmLogs, setSwarmLogs] = useState<SwarmEvent[]>([]);
  
  // Active Shields State
  const [shields, setShields] = useState({
    singleFlight: { active: true, count: 2840, latencyDeltaMs: -185 },
    idempotency: { active: true, blocked: 142, lruUsage: '1.4%' },
    qosShunting: { active: true, shedRatio: '10%', transferPool: '90%' },
    circuitBreaker: { active: false, status: 'CLOSED', healthPct: 100 }
  });

  // UI Modal State
  const [showRcaModal, setShowRcaModal] = useState<boolean>(false);
  const [rcaReport, setRcaReport] = useState<any | null>(null);
  const [activeAction, setActiveAction] = useState<string | null>(null);

  // ──────────────────────────────────────────────────────────────────────────
  // Real-Time Telemetry & Log Polling Loop
  // ──────────────────────────────────────────────────────────────────────────
  const pollTelemetry = useCallback(async () => {
    try {
      const data: TelemetryData = await mcpClient.callTool('get_orbital_subspace', {});
      if (data && data.telemetry_analysis) {
        setCurrentTelemetry(data);
        
        // Map status strings to 4-state machine
        const rawStatus = data.system_status as string;
        if (rawStatus === 'ANOMALY_DETECTED') {
          setSystemStatus('ANOMALY_DETECTED');
          setAlertCount(prev => prev + 1);
        } else if (rawStatus === 'REMEDIATING') {
          setSystemStatus('AUTONOMOUS_REMEDIATION');
        } else if (rawStatus === 'RECOVERED') {
          setSystemStatus('SYSTEM_RECOVERED');
        } else {
          setSystemStatus('NOMINAL');
        }

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
          return next.slice(-30); // 30 second rolling window
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
          singleFlight: { ...prev.singleFlight, active: res.checks?.find((c: any) => c.name === 'singleFlightShield')?.status === 'active' },
          qosShunting: { ...prev.qosShunting, active: res.checks?.find((c: any) => c.name === 'qosShunting')?.status === 'active' },
          idempotency: { ...prev.idempotency, active: res.checks?.find((c: any) => c.name === 'idempotencyShield')?.status === 'active' }
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
  // Action Handlers
  // ──────────────────────────────────────────────────────────────────────────
  const handleTriggerAction = async (toolName: string, label: string) => {
    setActiveAction(toolName);
    try {
      await mcpClient.callTool(toolName, {});
    } catch (err: any) {
      alert(`Action failed: ${err.message}`);
    } finally {
      setTimeout(() => setActiveAction(null), 1200);
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
  const statusBadgeConfig = useMemo(() => {
    switch (systemStatus) {
      case 'ANOMALY_DETECTED': 
        return { style: 'bg-amber-500/20 text-amber-300 border-amber-500/50 animate-pulse', icon: AlertTriangle, text: 'ANOMALY_DETECTED' };
      case 'AUTONOMOUS_REMEDIATION': 
        return { style: 'bg-purple-500/20 text-purple-300 border-purple-500/50 animate-pulse', icon: Cpu, text: 'AUTONOMOUS_REMEDIATION' };
      case 'SYSTEM_RECOVERED': 
        return { style: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50', icon: CheckCircle2, text: 'SYSTEM_RECOVERED' };
      default: 
        return { style: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50', icon: ShieldCheck, text: 'NOMINAL' };
    }
  }, [systemStatus]);

  const currentResidual = currentTelemetry?.telemetry_analysis?.svd_residual_norm || 0;
  const isAnomalyBreached = currentResidual > 15.0 || systemStatus === 'ANOMALY_DETECTED' || systemStatus === 'AUTONOMOUS_REMEDIATION';
  const StatusIcon = statusBadgeConfig.icon;

  return (
    <div className="min-h-screen bg-[#070A12] text-slate-100 font-sans p-3 lg:p-5 space-y-4 select-none">
      
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 1. APP HEADER & STATUS BAR */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <header className="bg-[#111827]/80 backdrop-blur-md border border-slate-800/80 rounded-xl px-4 py-3 flex flex-col md:flex-row items-center justify-between gap-3 shadow-2xl">
        
        {/* Title & Brand */}
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-gradient-to-br from-purple-600/30 to-cyan-600/30 border border-purple-500/40 rounded-lg shadow-inner">
            <Shield className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-black tracking-wider text-white">AEGIS</h1>
              <span className="text-xs font-mono text-purple-400 font-bold bg-purple-950/80 px-2 py-0.5 rounded border border-purple-800/60">
                // CORE BANKING SRE ENGINE
              </span>
            </div>
            <p className="text-[11px] text-slate-400 tracking-tight">Incremental SVD Subspace Subspace Anomaly Detection & Autonomic Remediation</p>
          </div>
        </div>

        {/* Status Center & Controls */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          
          {/* Environment Indicator */}
          <div className="flex items-center space-x-2 bg-[#070A12] px-3 py-1.5 rounded-lg border border-slate-800">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-ping' : 'bg-red-500'}`} />
            <span className="text-slate-400 font-medium">NitroStack Cloud MCP:</span>
            <span className="font-mono text-cyan-400 text-[11px]">agentic.nitrocloud.ai</span>
          </div>

          {/* Global Status Badge */}
          <div className={`px-3.5 py-1.5 rounded-lg border font-bold text-[11px] tracking-wider flex items-center space-x-1.5 ${statusBadgeConfig.style}`}>
            <StatusIcon className="w-3.5 h-3.5" />
            <span>{statusBadgeConfig.text}</span>
          </div>

          {/* Mode Switch Toggle */}
          <div className="flex items-center space-x-2 bg-[#070A12] px-3 py-1.5 rounded-lg border border-slate-800">
            <span className="text-[11px] text-slate-400 font-medium">Simulation Mode</span>
            <button 
              onClick={handleToggleMode}
              className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors duration-300 ${liveValidationMode ? 'bg-purple-600' : 'bg-slate-700'}`}
              title="Toggle between Mock Database and Live Postgres Validation Mode"
            >
              <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${liveValidationMode ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
          </div>

          {/* Control Utility Icons */}
          <div className="flex items-center space-x-1 pl-2 border-l border-slate-800">
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
              title="Toggle Theme"
            >
              {isDarkMode ? <Moon className="w-4 h-4 text-purple-400" /> : <Sun className="w-4 h-4 text-amber-400" />}
            </button>

            <button className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors relative">
              <Bell className="w-4 h-4 text-slate-300" />
              {alertCount > 0 && (
                <span className="absolute top-0 right-0 w-4 h-4 bg-rose-500 text-white font-bold text-[9px] rounded-full flex items-center justify-center animate-pulse">
                  {alertCount > 9 ? '9+' : alertCount}
                </span>
              )}
            </button>

            <button className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
              <Settings className="w-4 h-4 text-slate-300" />
            </button>
          </div>
        </div>
      </header>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 2. TOP BANNER — ALERT & AUTONOMOUS ACTION CENTER */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {isAnomalyBreached && (
        <div className="bg-gradient-to-r from-red-950/90 via-purple-950/80 to-slate-900 border border-red-500/60 rounded-xl p-3.5 flex flex-col md:flex-row items-center justify-between gap-3 shadow-xl animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-red-500/20 border border-red-500/40 rounded-lg animate-pulse">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-black text-red-400 uppercase tracking-widest">SVD Subspace Anomaly Breached</span>
                <span className="text-[10px] font-mono bg-red-900/60 text-red-200 px-2 py-0.5 rounded border border-red-700">
                  Residual ‖(I-P_S)x‖: {currentResidual.toFixed(2)} &gt; 15.0
                </span>
              </div>
              <p className="text-xs text-purple-200 mt-0.5 font-medium">
                ⚡ <strong>PRIME Orchestrator:</strong> Autonomous SRE Cascade Active — Zero Human Intervention Required. (ATLAS → CERBERUS → HERMES)
              </p>
            </div>
          </div>

          {/* Quick Action Override Buttons */}
          <div className="flex items-center space-x-2 shrink-0">
            <button 
              onClick={() => handleTriggerAction('simulate_salary_day_storm', 'Manual Approve')}
              className="bg-purple-900/60 hover:bg-purple-800 border border-purple-500/40 text-purple-200 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
            >
              Manual Approve
            </button>
            <button 
              onClick={() => handleTriggerAction('emergency_hardcoded_shield_activation', 'Emergency Fail-Safe')}
              className="bg-red-600 hover:bg-red-500 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg shadow-lg hover:shadow-red-600/40 transition-all flex items-center space-x-1.5"
            >
              <AlertOctagon className="w-3.5 h-3.5" />
              <span>🚨 EMERGENCY SHIELD FALLBACK</span>
            </button>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 3. MAIN GRID TOP ROW — STRESS TESTING & SIMULATION TRIGGER CARDS */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        
        {/* Card 1: Salary Day Storm */}
        <div className="bg-[#111827]/90 border border-slate-800/90 rounded-xl p-4 flex flex-col justify-between space-y-3 hover:border-rose-500/40 transition-colors shadow-lg group">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-rose-500/10 border border-rose-500/30 rounded-lg group-hover:scale-105 transition-transform">
              <Zap className="w-5 h-5 text-rose-400" />
            </div>
            <span className="text-[10px] font-mono text-slate-500">TOOL: STAGED_READ</span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Salary Day Storm</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">500+ concurrent read requests targeting payroll ledger accounts.</p>
          </div>
          <button
            onClick={() => handleTriggerAction('simulate_salary_day_storm', 'Salary Day Storm')}
            disabled={activeAction !== null}
            className="w-full bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 text-white font-bold text-xs py-2 px-3 rounded-lg shadow transition-all duration-200 disabled:opacity-50 flex items-center justify-center space-x-1.5"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Trigger Salary Day Storm</span>
          </button>
        </div>

        {/* Card 2: P2P Surge */}
        <div className="bg-[#111827]/90 border border-slate-800/90 rounded-xl p-4 flex flex-col justify-between space-y-3 hover:border-amber-500/40 transition-colors shadow-lg group">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg group-hover:scale-105 transition-transform">
              <TrendingUp className="w-5 h-5 text-amber-400" />
            </div>
            <span className="text-[10px] font-mono text-slate-500">TOOL: WRITE_SURGE</span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">P2P Transfer Surge</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">High-frequency write contention over peer transaction streams.</p>
          </div>
          <button
            onClick={() => handleTriggerAction('simulate_p2p_transfer_surge', 'P2P Surge')}
            disabled={activeAction !== null}
            className="w-full bg-gradient-to-r from-amber-600 to-orange-700 hover:from-amber-500 hover:to-orange-600 text-white font-bold text-xs py-2 px-3 rounded-lg shadow transition-all duration-200 disabled:opacity-50 flex items-center justify-center space-x-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Simulate P2P Surge</span>
          </button>
        </div>

        {/* Card 3: EOD Batch Collision */}
        <div className="bg-[#111827]/90 border border-slate-800/90 rounded-xl p-4 flex flex-col justify-between space-y-3 hover:border-yellow-500/40 transition-colors shadow-lg group">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg group-hover:scale-105 transition-transform">
              <Layers className="w-5 h-5 text-yellow-400" />
            </div>
            <span className="text-[10px] font-mono text-slate-500">TOOL: BATCH_COLLISION</span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">EOD Batch Collision</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Simulates background batch jobs locking teller transaction queues.</p>
          </div>
          <button
            onClick={() => handleTriggerAction('simulate_eod_batch_collision', 'EOD Batch')}
            disabled={activeAction !== null}
            className="w-full bg-gradient-to-r from-yellow-600 to-amber-700 hover:from-yellow-500 hover:to-amber-600 text-white font-bold text-xs py-2 px-3 rounded-lg shadow transition-all duration-200 disabled:opacity-50 flex items-center justify-center space-x-1.5"
          >
            <Database className="w-3.5 h-3.5" />
            <span>Simulate EOD Collision</span>
          </button>
        </div>

        {/* Card 4: Security Attack / Mule Cluster Isolation */}
        <div className="bg-[#111827]/90 border border-slate-800/90 rounded-xl p-4 flex flex-col justify-between space-y-3 hover:border-purple-500/40 transition-colors shadow-lg group">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-purple-500/10 border border-purple-500/30 rounded-lg group-hover:scale-105 transition-transform">
              <ShieldAlert className="w-5 h-5 text-purple-400" />
            </div>
            <span className="text-[10px] font-mono text-slate-500">CERBERUS: SECURITY</span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Isolate Mule Cluster</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">CERBERUS graph analytics isolating illicit mule account nodes.</p>
          </div>
          <button
            onClick={() => handleTriggerAction('isolate_mule_cluster', 'Mule Isolation')}
            disabled={activeAction !== null}
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-500 hover:to-indigo-600 text-white font-bold text-xs py-2 px-3 rounded-lg shadow transition-all duration-200 disabled:opacity-50 flex items-center justify-center space-x-1.5"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Isolate Mule Ring</span>
          </button>
        </div>

      </div>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 4. MAIN GRID MIDDLE ROW — TELEMETRY & SVD MATH ENGINE CHARTS */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Left Chart: 4D System Health Metrics */}
        <div className="bg-[#111827]/90 border border-slate-800/90 rounded-xl p-4 space-y-3 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <h2 className="text-xs font-bold text-slate-200 tracking-wide uppercase">4D Normalized Telemetry Stream</h2>
            </div>
            <div className="flex items-center space-x-3 text-[10px] font-mono">
              <span className="text-cyan-400 font-semibold">● Queue Depth</span>
              <span className="text-purple-400 font-semibold">● Thread Occupancy</span>
              <span className="text-amber-400 font-semibold">● DB Saturation</span>
              <span className="text-rose-400 font-semibold">● Retry Rate</span>
            </div>
          </div>
          
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metricHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                <XAxis dataKey="time" stroke="#4B5563" tick={{ fontSize: 9 }} />
                <YAxis stroke="#4B5563" tick={{ fontSize: 9 }} domain={[0, 100]} />
                <Tooltip contentStyle={{ backgroundColor: '#070A12', borderColor: '#374151', fontSize: '11px', borderRadius: '8px' }} />
                <Line type="monotone" dataKey="queueDepth" stroke="#06B6D4" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="threadOccupancy" stroke="#A855F7" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="dbSaturation" stroke="#F59E0B" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="retryRate" stroke="#EF4444" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Chart: Incremental SVD Residual Error Norm */}
        <div className="bg-[#111827]/90 border border-slate-800/90 rounded-xl p-4 space-y-3 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
            <div className="flex items-center space-x-2">
              <Cpu className="w-4 h-4 text-purple-400" />
              <h2 className="text-xs font-bold text-slate-200 tracking-wide uppercase">Incremental SVD Subspace Residual Norm ‖(I - P_S)x‖</h2>
            </div>
            <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded border ${isAnomalyBreached ? 'bg-rose-950 text-rose-300 border-rose-700 animate-pulse' : 'bg-purple-950/60 text-purple-300 border-purple-800/60'}`}>
              Error: {currentResidual.toFixed(2)}
            </span>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metricHistory}>
                <defs>
                  <linearGradient id="residualGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={isAnomalyBreached ? '#EF4444' : '#A855F7'} stopOpacity={0.5}/>
                    <stop offset="95%" stopColor={isAnomalyBreached ? '#EF4444' : '#A855F7'} stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                <XAxis dataKey="time" stroke="#4B5563" tick={{ fontSize: 9 }} />
                <YAxis stroke="#4B5563" tick={{ fontSize: 9 }} domain={[0, 40]} />
                <Tooltip contentStyle={{ backgroundColor: '#070A12', borderColor: '#374151', fontSize: '11px', borderRadius: '8px' }} />
                <ReferenceLine y={15.0} stroke="#EF4444" strokeDasharray="4 4" label={{ value: 'THRESHOLD: 15.0', fill: '#EF4444', fontSize: 9 }} />
                <Area type="monotone" dataKey="residualNorm" stroke={isAnomalyBreached ? '#EF4444' : '#A855F7'} strokeWidth={2.5} fillOpacity={1} fill="url(#residualGradient)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 5. BOTTOM ROW — ACTIVE SHIELDS GRID & AGENTIC SWARM CONSOLE */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Bottom Left: Active Middleware Shield Status Grid */}
        <div className="bg-[#111827]/90 border border-slate-800/90 rounded-xl p-4 space-y-3 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <h2 className="text-xs font-bold text-slate-200 tracking-wide uppercase">Autonomic Resilience Middleware Shields</h2>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
              SAGA ROLLBACK READY
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            
            {/* 1. SingleFlightGate */}
            <div className="bg-[#070A12]/90 border border-slate-800 rounded-lg p-3 space-y-2 hover:border-cyan-500/40 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <GitMerge className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-bold text-slate-200">SingleFlightGate</span>
                </div>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${shields.singleFlight.active ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-slate-800 text-slate-500'}`}>
                  {shields.singleFlight.active ? 'ACTIVE' : 'STANDBY'}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">Deduplicating identical reads over in-flight Promise maps (0ms data staleness).</p>
              <div className="flex items-center justify-between text-[11px] font-mono text-cyan-400 pt-1 border-t border-slate-900">
                <span>Deduplicated:</span>
                <span className="font-bold">{shields.singleFlight.count} reqs</span>
              </div>
            </div>

            {/* 2. IdempotencyEnforcer */}
            <div className="bg-[#070A12]/90 border border-slate-800 rounded-lg p-3 space-y-2 hover:border-purple-500/40 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <Lock className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-bold text-slate-200">IdempotencyEnforcer</span>
                </div>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${shields.idempotency.active ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-slate-800 text-slate-500'}`}>
                  {shields.idempotency.active ? 'ACTIVE' : 'STANDBY'}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">Intercepting duplicate transaction hashes via LRU eviction cache (10k entries).</p>
              <div className="flex items-center justify-between text-[11px] font-mono text-purple-400 pt-1 border-t border-slate-900">
                <span>Duplicates Intercepted:</span>
                <span className="font-bold">{shields.idempotency.blocked} reqs</span>
              </div>
            </div>

            {/* 3. QosShunting */}
            <div className="bg-[#070A12]/90 border border-slate-800 rounded-lg p-3 space-y-2 hover:border-amber-500/40 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <Sliders className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-slate-200">QosShunting</span>
                </div>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${shields.qosShunting.active ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-slate-800 text-slate-500'}`}>
                  {shields.qosShunting.active ? 'ACTIVE' : 'STANDBY'}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">Throttling batch background queues to 10%, reserving 90% bandwidth for transfers.</p>
              <div className="flex items-center justify-between text-[11px] font-mono text-amber-400 pt-1 border-t border-slate-900">
                <span>Batch Shed Ratio:</span>
                <span className="font-bold">{shields.qosShunting.shedRatio}</span>
              </div>
            </div>

            {/* 4. Autonomous CircuitBreaker */}
            <div className="bg-[#070A12]/90 border border-slate-800 rounded-lg p-3 space-y-2 hover:border-rose-500/40 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <Power className="w-4 h-4 text-rose-400" />
                  <span className="text-xs font-bold text-slate-200">CircuitBreaker</span>
                </div>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                  {shields.circuitBreaker.status}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">Failing fast on downstream legacy gateway timeouts with zero variance fallback.</p>
              <div className="flex items-center justify-between text-[11px] font-mono text-emerald-400 pt-1 border-t border-slate-900">
                <span>Gateway Health:</span>
                <span className="font-bold">{shields.circuitBreaker.healthPct}%</span>
              </div>
            </div>

          </div>
        </div>

        {/* Bottom Right: Agentic Swarm Console & SOC2 Compliance Feed */}
        <div className="bg-[#111827]/90 border border-slate-800/90 rounded-xl p-4 space-y-3 shadow-xl flex flex-col justify-between">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
              <div className="flex items-center space-x-2">
                <Terminal className="w-4 h-4 text-purple-400" />
                <h2 className="text-xs font-bold text-slate-200 tracking-wide uppercase">Agentic Swarm Console & Forensic Log</h2>
              </div>
              <button
                onClick={handleGenerateRca}
                className="flex items-center space-x-1.5 text-xs bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 px-3 py-1 rounded-lg transition-colors font-semibold"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>View Compliance RCA Report</span>
              </button>
            </div>

            {/* Dynamic Forensic Justification Banner */}
            {currentTelemetry?.forensic_justification && (
              <div className="bg-[#070A12] border border-slate-800 rounded-lg p-2.5 text-xs text-slate-300 space-y-1">
                <div className="font-bold text-purple-400 flex items-center space-x-1 text-[11px]">
                  <Cpu className="w-3.5 h-3.5 text-purple-400" />
                  <span>PRIME Forensic Justification:</span>
                </div>
                <p className="text-[10px] text-slate-400 font-mono leading-tight">
                  {currentTelemetry.forensic_justification}
                </p>
              </div>
            )}

            {/* Terminal Output Window */}
            <div className="bg-[#070A12] border border-slate-800 rounded-lg p-3 h-44 overflow-y-auto font-mono text-[10px] space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800">
              {swarmLogs.length === 0 ? (
                <div className="text-slate-600 italic">Listening to NitroStack agent swarm event stream...</div>
              ) : (
                swarmLogs.slice(-20).map((log, idx) => (
                  <div key={idx} className="flex space-x-2">
                    <span className="text-slate-500 shrink-0">{log.time}</span>
                    <span className={`font-bold shrink-0 ${log.source === 'PRIME' ? 'text-purple-400' : log.source === 'ATLAS' ? 'text-cyan-400' : log.source === 'CERBERUS' ? 'text-amber-400' : 'text-emerald-400'}`}>
                      [{log.source}]
                    </span>
                    <span className={log.type === 'error' ? 'text-rose-400' : log.type === 'warn' ? 'text-amber-300' : 'text-slate-300'}>
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
      {/* 6. SOC2 COMPLIANCE RCA MODAL */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {showRcaModal && rcaReport && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-slate-700 rounded-xl max-w-2xl w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3.5">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-500/20 border border-purple-500/40 rounded-lg">
                  <FileText className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">SOC2 Type II Compliance RCA Report</h3>
                  <p className="text-xs text-slate-400">Document Ref: {rcaReport.documentRef}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowRcaModal(false)}
                className="text-slate-400 hover:text-white text-xl font-bold px-2"
              >
                ×
              </button>
            </div>

            <div className="space-y-3 text-xs font-mono bg-[#070A12] p-4 rounded-lg border border-slate-800">
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Incident ID:</span>
                <span className="text-purple-400 font-bold">{rcaReport.incidentId}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Timestamp:</span>
                <span className="text-slate-200">{rcaReport.filedAt}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">SVD Subspace Residual Norm:</span>
                <span className="text-rose-400 font-bold">{rcaReport.svdResidualNorm}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Deployed Middleware Shields:</span>
                <span className="text-emerald-400 font-bold">{rcaReport.activeShields?.join(', ')}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Remediation Latency:</span>
                <span className="text-cyan-400 font-bold">{rcaReport.remediationLatencyMs} ms</span>
              </div>
              <div className="pt-1">
                <span className="text-slate-400 block mb-1">Auditable Resolution Summary:</span>
                <p className="text-slate-300 font-sans leading-relaxed bg-[#111827] p-3 rounded border border-slate-800">
                  {rcaReport.auditTrail?.resolution}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-emerald-400 font-mono flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Verified by HERMES Compliance Agent</span>
              </span>
              <button
                onClick={() => setShowRcaModal(false)}
                className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-4 py-2 rounded-lg text-xs transition-colors shadow"
              >
                Close Audit Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
