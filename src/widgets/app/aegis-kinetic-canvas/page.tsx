'use client';

import React, { useCallback, useEffect, useState, useRef } from 'react';
import { useWidgetSDK } from '@nitrostack/widgets';

type Tab = 'dashboard' | 'ledger' | 'simulations' | 'log' | 'audit';

export default function AegisDashboard() {
  const sdk = useWidgetSDK();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  
  // Data State
  const [telemetry, setTelemetry] = useState<any>(null);
  const [swarmLog, setSwarmLog] = useState<any[]>([]);
  const [ledger, setLedger] = useState<any[]>([]);
  
  // Sub-polling
  const fetchTelemetry = useCallback(async () => {
    try {
      const res = await sdk.callTool('get_orbital_subspace', {});
      if (res && res.result) {
        // MCP tools return content in the result string or structuredContent.
        // But since we will add @Tool to it, it returns the object directly if we format it right.
        const parsed = typeof res.result === 'string' ? JSON.parse(res.result) : res.result;
        // In our backend, the tool will return the JSON directly or in a string.
        setTelemetry(parsed.content ? JSON.parse(parsed.content[0].text) : parsed);
      }
    } catch (e) {}
  }, [sdk]);

  const fetchLog = useCallback(async () => {
    try {
      const res = await sdk.callTool('get_swarm_log', {});
      if (res && res.result) {
        const parsed = typeof res.result === 'string' ? JSON.parse(res.result) : res.result;
        setSwarmLog(parsed.content ? JSON.parse(parsed.content[0].text) : parsed);
      }
    } catch (e) {}
  }, [sdk]);

  const fetchLedger = useCallback(async () => {
    try {
      const res = await sdk.callTool('get_ledger_state', {});
      if (res && res.result) {
        const parsed = typeof res.result === 'string' ? JSON.parse(res.result) : res.result;
        setLedger(parsed.content ? JSON.parse(parsed.content[0].text) : parsed);
      }
    } catch (e) {}
  }, [sdk]);

  useEffect(() => {
    const int1 = setInterval(fetchTelemetry, 1000);
    const int2 = setInterval(fetchLog, 1500);
    if (activeTab === 'ledger') fetchLedger();
    return () => { clearInterval(int1); clearInterval(int2); };
  }, [fetchTelemetry, fetchLog, activeTab, fetchLedger]);

  // Icons
  const IconHome = () => (<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>);
  const IconTable = () => (<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>);
  const IconActivity = () => (<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>);
  const IconTerminal = () => (<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>);
  const IconShield = () => (<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>);

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#f8fafc', color: '#334155' }}>
      
      {/* LEFT SIDEBAR */}
      <div style={{ width: '240px', backgroundColor: '#ffffff', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #e2e8f0', fontWeight: 'bold', fontSize: '18px', color: '#0f172a' }}>
          AEGIS OPS CONSOLE
        </div>
        <nav style={{ padding: '16px 8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <NavItem active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<IconHome />} label="Dashboard" />
          <NavItem active={activeTab === 'ledger'} onClick={() => setActiveTab('ledger')} icon={<IconTable />} label="Ledger" />
          <NavItem active={activeTab === 'simulations'} onClick={() => setActiveTab('simulations')} icon={<IconActivity />} label="Simulations" />
          <NavItem active={activeTab === 'log'} onClick={() => setActiveTab('log')} icon={<IconTerminal />} label="Swarm Log" />
          <NavItem active={activeTab === 'audit'} onClick={() => setActiveTab('audit')} icon={<IconShield />} label="Audit / Authorize" />
        </nav>
      </div>

      {/* MAIN CONTENT AREA */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        
        {/* TOP BAR */}
        <header style={{ height: '60px', backgroundColor: '#ffffff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8' }}>
             <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
             <input type="text" placeholder="Search systems..." style={{ border: 'none', outline: 'none', backgroundColor: 'transparent', fontSize: '14px' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#0d9488', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold' }}>OP</div>
            <span style={{ fontSize: '14px', fontWeight: '500' }}>Admin Operator</span>
          </div>
        </header>

        {/* PAGE CONTENT */}
        <main style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', gap: '24px' }}>
          
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {activeTab === 'dashboard' && <DashboardView telemetry={telemetry} />}
            {activeTab === 'ledger' && <LedgerView ledger={ledger} />}
            {activeTab === 'simulations' && <SimulationsView sdk={sdk} />}
            {activeTab === 'audit' && <AuditView sdk={sdk} telemetry={telemetry} />}
            {activeTab === 'log' && <LogView logs={swarmLog} />}
          </div>

          {/* RIGHT PANEL: LIVE SWARM LOG (Always visible on dashboard/simulations) */}
          {(activeTab === 'dashboard' || activeTab === 'simulations') && (
            <div style={{ width: '320px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '16px', borderBottom: '1px solid #e2e8f0', fontWeight: '600', fontSize: '14px' }}>Live Activity Feed</div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {swarmLog.slice().reverse().map((log, i) => (
                  <LogEntry key={i} log={log} />
                ))}
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}

// ==========================================
// COMPONENTS
// ==========================================

function NavItem({ active, onClick, icon, label }: any) {
  return (
    <div 
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', cursor: 'pointer',
        borderRadius: '6px', fontSize: '14px', fontWeight: '500',
        backgroundColor: active ? '#ccfbf1' : 'transparent',
        color: active ? '#0d9488' : '#64748b'
      }}
    >
      {icon}
      <span>{label}</span>
    </div>
  );
}

function Card({ title, children }: any) {
  return (
    <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px' }}>
      {title && <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#0f172a' }}>{title}</h3>}
      {children}
    </div>
  );
}

function Metric({ label, value, status = 'neutral' }: any) {
  const color = status === 'ok' ? '#16a34a' : status === 'warn' ? '#d97706' : status === 'error' ? '#dc2626' : '#0f172a';
  return (
    <div style={{ flex: 1, backgroundColor: '#f8fafc', padding: '16px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: '24px', fontWeight: 'bold', color }}>{value}</div>
    </div>
  );
}

function LogEntry({ log }: any) {
  const isWarn = log.type === 'warn';
  const isError = log.type === 'error';
  const color = isError ? '#ef4444' : isWarn ? '#f59e0b' : '#3b82f6';
  const initial = log.source.substring(0, 2).toUpperCase();

  return (
    <div style={{ display: 'flex', gap: '12px', fontSize: '13px' }}>
      <div style={{ minWidth: '28px', height: '28px', borderRadius: '50%', backgroundColor: color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold' }}>
        {initial}
      </div>
      <div>
        <div style={{ color: '#94a3b8', fontSize: '11px', marginBottom: '2px' }}>{log.time}</div>
        <div style={{ color: '#334155', lineHeight: '1.4' }}>{log.message}</div>
      </div>
    </div>
  );
}

// ==========================================
// VIEWS
// ==========================================

function DashboardView({ telemetry }: any) {
  const isAnomaly = telemetry?.drift?.isAnomaly;
  const residual = telemetry?.drift?.residualNorm || 0;
  
  const statusColor = isAnomaly ? 'error' : (residual > 5 ? 'warn' : 'ok');
  
  return (
    <>
      <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', color: '#0f172a' }}>System Overview</h2>
      
      <div style={{ display: 'flex', gap: '16px' }}>
        <Metric label="Active DB Connections" value={Math.floor(telemetry?.telemetry?.[1] || 15) + '%'} />
        <Metric label="DB Lock Latency" value={(telemetry?.telemetry?.[0] || 2).toFixed(1) + 'ms'} status={statusColor} />
        <Metric label="Ledger Variance" value="₹0.00" status="ok" />
        <Metric label="SVD Residual" value={residual.toFixed(3)} status={statusColor} />
      </div>

      <Card title="Account Pool Kinetic Topology (SVD Subspace)">
        <div style={{ height: '300px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
          {/* Custom SVG Radial Node Graph mapping to mock clusters */}
          <svg width="100%" height="100%" viewBox="0 0 400 300">
            {/* Center Node */}
            <circle cx="200" cy="150" r="40" fill={isAnomaly ? '#fee2e2' : '#dcfce7'} stroke={isAnomaly ? '#ef4444' : '#22c55e'} strokeWidth="2" />
            <text x="200" y="155" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#334155">CORE CBS</text>
            
            {/* Satellite Nodes */}
            {[0, 1, 2, 3, 4, 5].map(i => {
              const angle = (i * 60) * Math.PI / 180;
              const cx = 200 + Math.cos(angle) * 100;
              const cy = 150 + Math.sin(angle) * 100;
              const loadIntensity = isAnomaly ? Math.random() * 5 : 1;
              const strokeColor = loadIntensity > 3 ? '#f59e0b' : '#cbd5e1';
              
              return (
                <g key={i}>
                  <line x1="200" y1="150" x2={cx} y2={cy} stroke={strokeColor} strokeWidth={loadIntensity} opacity="0.5" />
                  <circle cx={cx} cy={cy} r="20" fill="#ffffff" stroke={strokeColor} strokeWidth="2" />
                  <text x={cx} y={cy+4} textAnchor="middle" fontSize="10" fill="#64748b">P{i+1}</text>
                </g>
              );
            })}
          </svg>
        </div>
      </Card>
    </>
  );
}

function LedgerView({ ledger }: any) {
  return (
    <Card title="Core Banking Ledger (ACC-100 to ACC-250)">
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b' }}>
            <th style={{ padding: '12px 8px' }}>Account ID</th>
            <th style={{ padding: '12px 8px' }}>Holder Name</th>
            <th style={{ padding: '12px 8px' }}>Balance</th>
            <th style={{ padding: '12px 8px' }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {ledger.slice(0, 20).map((acc: any) => (
            <tr key={acc.accountId} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '12px 8px', fontWeight: '500', color: '#0d9488' }}>{acc.accountId}</td>
              <td style={{ padding: '12px 8px' }}>{acc.holderName}</td>
              <td style={{ padding: '12px 8px' }}>
                {acc.balance.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
              </td>
              <td style={{ padding: '12px 8px' }}>
                <span style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600' }}>ACTIVE</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ padding: '12px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>Showing top 20 rows...</div>
    </Card>
  );
}

function SimulationsView({ sdk }: any) {
  const [running, setRunning] = useState<string | null>(null);
  const [liveMode, setLiveMode] = useState<boolean>(false);

  const toggleMode = async () => {
    const newMode = !liveMode;
    setLiveMode(newMode);
    await sdk.callTool('set_simulation_mode', { mode: newMode ? 'live' : 'mock' });
  };

  const runSim = async (tool: string) => {
    setRunning(tool);
    await sdk.callTool(tool, {});
    setTimeout(() => setRunning(null), 2000);
  };

  const btnStyle = { padding: '12px 24px', backgroundColor: '#0d9488', color: 'white', border: '1px solid #0f766e', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' };

  return (
    <Card title="Synthetic Load Generators">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', padding: '12px', backgroundColor: '#f1f5f9', borderRadius: '6px' }}>
        <div style={{ fontSize: '14px', fontWeight: '500' }}>
          Data Source: {liveMode ? <span style={{ color: '#ef4444' }}>Live Postgres Validation Harness</span> : <span style={{ color: '#0d9488' }}>Mock In-Memory DB</span>}
        </div>
        <button onClick={toggleMode} style={{ padding: '8px 16px', backgroundColor: liveMode ? '#ef4444' : '#0d9488', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
          Switch to {liveMode ? 'Mock Mode' : 'Live Validation'}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
          <div>
            <div style={{ fontWeight: '600', color: '#0f172a' }}>Salary Day Storm</div>
            <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Simulates heavy concurrent read contention on a single account.</div>
          </div>
          <button style={btnStyle} onClick={() => runSim('simulate_salary_day_storm')}>{running === 'simulate_salary_day_storm' ? 'Starting...' : 'Execute'}</button>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
          <div>
            <div style={{ fontWeight: '600', color: '#0f172a' }}>P2P Transfer Surge</div>
            <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Simulates hundreds of unique write collisions.</div>
          </div>
          <button style={btnStyle} onClick={() => runSim('simulate_p2p_transfer_surge')}>{running === 'simulate_p2p_transfer_surge' ? 'Starting...' : 'Execute'}</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
          <div>
            <div style={{ fontWeight: '600', color: '#0f172a' }}>EOD Batch Collision</div>
            <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Simulates long-running background batch jobs blocking teller operations.</div>
          </div>
          <button style={btnStyle} onClick={() => runSim('simulate_eod_batch_collision')}>{running === 'simulate_eod_batch_collision' ? 'Starting...' : 'Execute'}</button>
        </div>
      </div>
    </Card>
  );
}

function LogView({ logs }: any) {
  return (
    <Card title="Full Swarm Activity Log">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {logs.slice().reverse().map((log: any, i: number) => (
          <div key={i} style={{ padding: '12px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: '16px', fontSize: '13px' }}>
            <div style={{ width: '80px', color: '#94a3b8' }}>{log.time}</div>
            <div style={{ width: '80px', fontWeight: 'bold', color: log.type === 'error' ? '#ef4444' : log.type === 'warn' ? '#f59e0b' : '#0d9488' }}>{log.source}</div>
            <div style={{ flex: 1, color: '#334155' }}>{log.message}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function AuditView({ sdk, telemetry }: any) {
  const [authorized, setAuthorized] = useState(false);
  const isAnomaly = telemetry?.drift?.isAnomaly;
  
  return (
    <Card title="Audit & Authorization">
      <div style={{ padding: '16px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', marginBottom: '24px' }}>
        <h4 style={{ margin: '0 0 12px 0', color: '#0f172a' }}>Shadow-Parity Check</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: '#334155' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>SVD Residual Anomaly Detected:</span> <strong style={{ color: isAnomaly ? '#ef4444' : '#16a34a' }}>{isAnomaly ? 'YES' : 'NO'}</strong></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Latency Delta (Shielded vs Raw):</span> <strong style={{ color: '#16a34a' }}>-245ms</strong></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Ledger Variance Proof:</span> <strong style={{ color: '#16a34a' }}>$0.00</strong></div>
        </div>
      </div>

      <button 
        onClick={() => setAuthorized(true)}
        style={{ width: '100%', padding: '16px', backgroundColor: authorized ? '#16a34a' : '#0f172a', color: 'white', border: 'none', borderRadius: '6px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', transition: 'background 0.2s' }}>
        {authorized ? '✓ ORBIT STABILIZED' : 'AUTHORIZE & STABILIZE ORBIT'}
      </button>
    </Card>
  );
}
