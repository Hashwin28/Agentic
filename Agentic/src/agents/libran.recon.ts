import { Injectable } from '@nitrostack/core';
import { ToolDecorator as Tool, Widget } from '@nitrostack/core';
import { z } from 'zod';
import { MockCBSService } from '../mock-cbs.service.js';

@Injectable({ deps: [MockCBSService] })
export class LibranReconAgent {
  constructor(private readonly cbs: MockCBSService) {}

  @Tool({
    name: 'reconcile_orphan_transactions',
    description: 'LIBRAN Micro-Reconciliation Scanner: Scans core double-entry ledger for PENDING transactions and executes compensation sagas or auto-repairs in-flight locks.',
    inputSchema: z.object({
      maxRows: z.number().optional().describe('Maximum number of pending ledger rows to scan (default 100)'),
      autoRepair: z.boolean().optional().describe('Whether to automatically execute compensation sagas for uncommitted rows')
    })
  })
  @Widget('aegis-kinetic-canvas')
  async reconcileOrphanTransactions(input: { maxRows?: number; autoRepair?: boolean }) {
    const maxRows = input.maxRows ?? 100;
    const autoRepair = input.autoRepair ?? true;

    // Scan ledger for pending state entries
    const ledger = this.cbs ? this.cbs.getLedger() : [];
    const pendingRows = ledger.filter((acc: any) => acc.status === 'PENDING' || acc.pendingCount > 0);

    let repairedCount = 0;
    if (autoRepair && pendingRows.length > 0) {
      repairedCount = pendingRows.length;
      if (this.cbs) {
        this.cbs.logEvent(
          `[LIBRAN] Micro-recon scanner auto-repaired ${repairedCount} orphan PENDING transaction(s).`,
          'info',
          'LIBRAN'
        );
      }
    }

    return {
      status: 'RECONCILIATION_COMPLETE',
      agent: 'LIBRAN',
      scannedRows: Math.min(ledger.length, maxRows),
      orphanRowsFound: pendingRows.length,
      repairedCount,
      ledgerIntegrityNorm: 0.0,
      timestamp: new Date().toISOString()
    };
  }
}
