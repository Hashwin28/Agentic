import { Module, McpApp } from '@nitrostack/core';

// Engine & Services
import { IncrementalSVDEngine } from './engine/incremental-svd.engine.js';
import { MockCBSService } from './mock-cbs.service.js';
import { BankApiService } from './bank-api.service.js';

// Patterns
import { SingleFlightGate } from './patterns/single-flight.js';
import { IdempotencyEnforcer } from './patterns/idempotency.js';
import { QosShunting } from './patterns/qos-shunting.js';

// Agents
import { PrimeOrchestrator } from './agents/prime.orchestrator.js';
import { AtlasSreAgent } from './agents/atlas.sre.js';
import { CerberusSecurityAgent } from './agents/cerberus.security.js';
import { HermesComplianceAgent } from './agents/hermes.compliance.js';
import { LibranReconAgent } from './agents/libran.recon.js';

@Module({
  name: 'AppModule',
  providers: [
    MockCBSService,
    BankApiService,
    IncrementalSVDEngine,
    SingleFlightGate,
    IdempotencyEnforcer,
    QosShunting,
    PrimeOrchestrator,
    AtlasSreAgent,
    CerberusSecurityAgent,
    HermesComplianceAgent,
    LibranReconAgent
  ],
  controllers: [
    PrimeOrchestrator,
    AtlasSreAgent,
    CerberusSecurityAgent,
    HermesComplianceAgent,
    LibranReconAgent
  ]
})
export class AppModule {}

@McpApp({
  module: AppModule,
  server: {
    name: 'Project Aegis MAS',
    version: '2.0.0'
  }
})
export class AegisApplication {}
