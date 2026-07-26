/**
 * Project Aegis — NitroStack MCP Cloud Connection Client
 * Manages HTTP/SSE JSON-RPC 2.0 communication with the NitroStack MCP Server.
 */

export interface TelemetryData {
  timestamp: string;
  system_status: 'NOMINAL' | 'ANOMALY_DETECTED' | 'REMEDIATING' | 'RECOVERED';
  telemetry_analysis: {
    normalized_vector: [number, number, number, number];
    svd_residual_norm: number;
    is_warmup_period: boolean;
  };
  forensic_justification: string;
  orchestration_plan: Array<{
    step: number;
    target_agent: string;
    action: string;
    parameters: Record<string, unknown>;
  }>;
}

export interface SwarmEvent {
  time: string;
  source: string;
  type: 'info' | 'warn' | 'error' | 'success';
  message: string;
}

export class AegisMcpClient {
  private serverUrl: string;
  private isConnected: boolean = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private onStatusChange?: (status: boolean) => void;

  constructor(serverUrl: string, onStatusChange?: (status: boolean) => void) {
    this.serverUrl = serverUrl;
    this.onStatusChange = onStatusChange;
  }

  /**
   * Executes an MCP Tool call over standard HTTP/JSON-RPC 2.0
   */
  async callTool<T = any>(name: string, args: Record<string, unknown> = {}): Promise<T> {
    try {
      const response = await fetch(this.serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tools/call',
          params: { name, arguments: args }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
      }

      const json = await response.json();
      
      if (json.error) {
        throw new Error(`MCP Error ${json.error.code}: ${json.error.message}`);
      }

      this.setConnectedStatus(true);
      return json.result as T;
    } catch (err: any) {
      console.warn(`[MCP-CLIENT] Tool call '${name}' failed:`, err.message);
      this.setConnectedStatus(false);
      this.scheduleReconnect();
      throw err;
    }
  }

  /**
   * Reads an MCP Resource by URI
   */
  async readResource<T = any>(uri: string): Promise<T> {
    try {
      const response = await fetch(this.serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'resources/read',
          params: { uri }
        })
      });

      const json = await response.json();
      this.setConnectedStatus(true);

      const contentText = json.result?.contents?.[0]?.text;
      return contentText ? JSON.parse(contentText) : json.result;
    } catch (err: any) {
      this.setConnectedStatus(false);
      this.scheduleReconnect();
      throw err;
    }
  }

  private setConnectedStatus(status: boolean) {
    if (this.isConnected !== status) {
      this.isConnected = status;
      this.onStatusChange?.(status);
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      // Ping health resource on reconnect attempt
      this.readResource('health://checks').catch(() => {});
    }, 3000);
  }
}
