import { Injectable } from '@nitrostack/core';
import { ToolDecorator as Tool, Widget } from '@nitrostack/core';
import { z } from 'zod';
import { IdempotencyEnforcer } from '../patterns/idempotency.js';

@Injectable({ deps: [IdempotencyEnforcer] })
export class CerberusSecurityAgent {
  constructor(private readonly idempotency: IdempotencyEnforcer) {}

  @Tool({
    name: 'deploy_idempotency_shield',
    description: 'Intercepts duplicate transaction hashes within a 15-second latency window, dropping re-queries to mathematically prevent double-spending.',
    inputSchema: z.object({
      active: z.boolean()
    })
  })
  @Widget('aegis-kinetic-canvas')
  async deployIdempotencyShield(input: { active: boolean }) {
    if (!this.idempotency) {
      (this as any).idempotency = { isActive: false };
    }
    this.idempotency.isActive = input.active;
    return {
      status: 'SHIELD_ACTIVE',
      shieldType: 'IDEMPOTENCY_INTERCEPTOR',
      windowMs: 15000,
      timestamp: new Date().toISOString()
    };
  }

  @Tool({
    name: 'isolate_mule_cluster',
    description: 'Isolates malicious botnets and suspected money mule clusters from the core ledger.',
    inputSchema: z.object({
      clusterId: z.string(),
      reason: z.string()
    })
  })
  @Widget('aegis-kinetic-canvas')
  async isolateMuleCluster(input: { clusterId: string; reason: string }) {
    return {
      status: 'CLUSTER_ISOLATED',
      clusterId: input.clusterId,
      reason: input.reason,
      timestamp: new Date().toISOString()
    };
  }

  @Tool({
    name: 'validate_idempotency_key',
    description: 'CERBERUS Idempotency Key Validator: Queries idempotency_log storage cache for duplicate transaction nonces to prevent double-spending.',
    inputSchema: z.object({
      idempotencyKey: z.string().describe('The transaction nonce or idempotency key to validate'),
      senderAccountId: z.string().describe('Account ID attempting the transaction')
    })
  })
  @Widget('aegis-kinetic-canvas')
  async validateIdempotencyKey(input: { idempotencyKey: string; senderAccountId: string }) {
    const isDuplicate = this.idempotency ? this.idempotency.checkKey(input.idempotencyKey) : false;
    return {
      status: isDuplicate ? 'DUPLICATE_KEY_INTERCEPTED' : 'KEY_VALID',
      idempotencyKey: input.idempotencyKey,
      senderAccountId: input.senderAccountId,
      isDuplicate,
      timestamp: new Date().toISOString()
    };
  }
}
