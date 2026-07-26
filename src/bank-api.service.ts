import { Injectable } from '@nitrostack/core';
import express, { Express } from 'express';
import * as path from 'path';
import cors from 'cors';
import { MockCBSService } from './mock-cbs.service.js';
import { SingleFlightGate } from './patterns/single-flight.js';
import { IdempotencyEnforcer } from './patterns/idempotency.js';
import { QosShunting, TrafficClass } from './patterns/qos-shunting.js';

@Injectable({ deps: [MockCBSService, SingleFlightGate, IdempotencyEnforcer, QosShunting] })
export class BankApiService {
  private app: Express;
  private server: any;

  constructor(
    private readonly cbs: MockCBSService,
    private readonly singleFlight: SingleFlightGate,
    private readonly idempotency: IdempotencyEnforcer,
    private readonly qos: QosShunting
  ) {
    this.app = express();
    this.app.use(cors());
    this.app.use(express.json());

    // Explicitly serve widgets from Next.js export for NitroStudio's proxy
    this.app.get('/widgets/:widgetName', (req, res) => {
      const widgetName = req.params.widgetName;
      const widgetPath = path.join(process.cwd(), 'src/widgets/out', `${widgetName}.html`);
      res.sendFile(widgetPath);
    });
    this.app.get('/:widgetName', (req, res) => {
      const widgetName = req.params.widgetName;
      const widgetPath = path.join(process.cwd(), 'src/widgets/out', `${widgetName}.html`);
      res.sendFile(widgetPath);
    });

    this.app.use(express.static(path.join(process.cwd(), 'src/widgets/out')));

    this.setupRoutes();
    this.startServer();
  }

  private setupRoutes() {
    // 1. Transfer Endpoint
    this.app.post('/api/v1/transfer', async (req, res) => {
      const { from, to, amount, nonce } = req.body;

      // Input Validation Phase (Prevent exploits & self-transfer lockup)
      if (!from || !to || typeof from !== 'string' || typeof to !== 'string') {
        return res.status(400).json({ error: 'Bad Request - Invalid sender or recipient account' });
      }

      if (from === to) {
        return res.status(400).json({ error: 'Bad Request - Self-transfers are not permitted' });
      }

      if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ error: 'Bad Request - Amount must be a positive finite number' });
      }

      // Admission Control Phase (QoS)
      if (!this.qos.admit(TrafficClass.MONEY_TRANSFER)) {
        return res.status(429).json({ error: 'Too Many Requests - QoS Shunting Active' });
      }

      // Idempotency Phase (Double-Spend Protection)
      if (!this.idempotency.checkAndRegister(from, to, amount, nonce || '')) {
        return res.status(409).json({ error: 'Conflict - Duplicate Transaction Intercepted' });
      }

      // Simulate Lock Contention & Process
      try {
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate write latency
        await this.cbs.processTransaction({
          fromAccountId: from,
          toAccountId: to,
          amount,
          currency: 'USD',
          timestamp: new Date().toISOString()
        });
        return res.status(200).json({ status: 'SUCCESS' });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    });

    // 2. Balance Endpoint
    this.app.get('/api/v1/balance/:id', async (req, res) => {
      const accountId = req.params.id;

      // Admission Control Phase (QoS)
      if (!this.qos.admit(TrafficClass.NON_CRITICAL)) {
        return res.status(429).json({ error: 'Too Many Requests - QoS Shunting Active' });
      }

      try {
        // Single-Flight Coalescing Phase
        const balance = await this.singleFlight.coalesce(`balance:${accountId}`, async () => {
          return (await this.cbs.getBalance(accountId)) || 0;
        });

        return res.status(200).json({ accountId, balance });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    });

    // 3. Synthetic Storm Trigger
    this.app.post('/api/v1/simulate-storm', (req, res) => {
      this.simulateStorm();
      return res.status(202).json({ status: 'STORM_INITIATED' });
    });
  }

  private simulateStorm() {
    console.log('[AEGIS-SIM] Salary Day Storm Initiated...');
    
    // Simulate 500 concurrent transfers with highly duplicated nonces (retry storms)
    for (let i = 0; i < 500; i++) {
      const nonce = `storm-nonce-${Math.floor(i / 10)}`; // Duplicate every 10 requests
      fetch('http://localhost:3001/api/v1/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'MOCK-CORP-ACCOUNT',
          to: `EMP-${i}`,
          amount: 5000,
          nonce
        })
      }).catch(() => null);
    }

    // Simulate 1000 concurrent balance checks for the same account
    for (let i = 0; i < 1000; i++) {
      fetch('http://localhost:3001/api/v1/balance/MOCK-CORP-ACCOUNT').catch(() => null);
    }
  }

  private startServer() {
    const PORT = 3001;
    this.server = this.app.listen(PORT, () => {
      console.log(`[AEGIS] Replicate Bank System API listening on port ${PORT}`);
    });
  }
}
